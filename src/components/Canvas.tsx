import { useState, useEffect, useRef, useMemo, type FC, type ClipboardEvent, type FormEvent, type ChangeEvent } from "react";
import {
    Plus, Table2, Type, Image as ImageIcon, LayoutTemplate,
    UploadCloud, Trash2, GripVertical, Settings2, BarChart3, Map as MapIcon,
    X, Bold, Italic, Underline, Heading1, Heading2, List, ListOrdered, AlignLeft, AlignCenter, AlignRight
} from "lucide-react";
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    ComposedChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    RadialBarChart, RadialBar, ScatterChart, Scatter, ZAxis,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from "recharts";

import addIcon from "../assets/apps-add.svg";
import { useEditor } from "../contexts/EditorContext";
import axiosClient from "../axios-client.ts";
import MapGraphic from "./MapGraphic";

const SERBIAN_DISTRICTS = [
    "Град Београд", "Севернобачки", "Средњобачки", "Севернобанатски",
    "Средњобанатски", "Јужнобанатски", "Западнобачки", "Јужнобачки",
    "Сремски", "Мачвански", "Колубарски", "Подунавски", "Браничевски",
    "Шумадијски", "Поморавски", "Борски", "Зајечарски", "Златиборски",
    "Моравички", "Рашки", "Расински", "Нишавски", "Топлички", "Пиротски",
    "Јабланички", "Пчињски"
];

type ElementType = "text" | "image" | "table" | "chart" | "map" | null;
interface ContentElement { id: string; type: ElementType; payload: any; }
interface ColumnData { id: string; widthClass: string; elements: ContentElement[]; }
interface RowData { id: string; columns: ColumnData[]; }

const CHART_PALETTE = ['#8b98ff', '#34d399', '#fef3c7', '#2563eb', '#1e3a8a', '#f59e0b', '#e11d48'];

// ПОМОЋНА ФУНКЦИЈА ЗА ВАЂЕЊЕ ФУСНОТА
export const extractFootnoteIds = (html: string) => {
    const regex = /data-footnote-id="([^"]+)"/g;
    const ids = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        ids.push(match[1]);
    }
    return ids;
};

const TextToolbar = ({ editorRef, onAddFootnote }: { editorRef: React.RefObject<HTMLDivElement>, onAddFootnote: () => void }) => {
    const [position, setPosition] = useState({ top: -1000, left: -1000 });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleSelection = () => {
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                setIsVisible(false);
                return;
            }

            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            const editorNode = editorRef.current;

            if (editorNode && (editorNode === container || editorNode.contains(container))) {
                const rect = range.getBoundingClientRect();
                const editorRect = editorNode.getBoundingClientRect();

                setPosition({
                    top: rect.top - editorRect.top - 45,
                    left: rect.left - editorRect.left + (rect.width / 2) - 170
                });
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        document.addEventListener('selectionchange', handleSelection);
        return () => document.removeEventListener('selectionchange', handleSelection);
    }, [editorRef]);

    const execCmd = (e: React.MouseEvent, command: string, value: string | undefined = undefined) => {
        e.preventDefault();
        document.execCommand(command, false, value);
        if (editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
        }
    };

    if (!isVisible) return null;

    return (
        <div
            className="absolute z-[999999] flex items-center gap-1 bg-gray-900 text-white px-2 py-1.5 rounded-lg shadow-xl animate-in fade-in zoom-in-95 pointer-events-auto"
            style={{ top: position.top, left: position.left }}
            onMouseDown={(e) => e.preventDefault()}
        >
            <button onClick={(e) => execCmd(e, 'formatBlock', 'H1')} className="p-1.5 hover:bg-gray-700 rounded transition-colors text-xs font-bold" title="Naslov 1">H1</button>
            <button onClick={(e) => execCmd(e, 'formatBlock', 'H2')} className="p-1.5 hover:bg-gray-700 rounded transition-colors text-xs font-bold" title="Naslov 2">H2</button>
            <button onClick={(e) => execCmd(e, 'formatBlock', 'P')} className="p-1.5 hover:bg-gray-700 rounded transition-colors text-xs" title="Paragraf"><Type size={14}/></button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <button onClick={(e) => execCmd(e, 'bold')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Podebljano"><Bold size={14}/></button>
            <button onClick={(e) => execCmd(e, 'italic')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Kurziv"><Italic size={14}/></button>
            <button onClick={(e) => execCmd(e, 'underline')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Podvučeno"><Underline size={14}/></button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <button onClick={(e) => execCmd(e, 'insertUnorderedList')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Lista"><List size={14}/></button>
            <button onClick={(e) => execCmd(e, 'insertOrderedList')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Numerisana lista"><ListOrdered size={14}/></button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <button onClick={(e) => execCmd(e, 'justifyLeft')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Levo"><AlignLeft size={14}/></button>
            <button onClick={(e) => execCmd(e, 'justifyCenter')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Centar"><AlignCenter size={14}/></button>
            <button onClick={(e) => execCmd(e, 'justifyRight')} className="p-1.5 hover:bg-gray-700 rounded transition-colors" title="Desno"><AlignRight size={14}/></button>
            <div className="w-px h-4 bg-gray-600 mx-1"></div>
            <button onClick={(e) => { e.preventDefault(); onAddFootnote(); }} className="p-1.5 hover:bg-gray-700 rounded transition-colors text-xs font-bold text-blue-400" title="Додај фусноту">[¹]</button>
        </div>
    );
};

const RenderBars = ({ keys, colors, isStacked, isLabelsShown, palette }: any) => {
    return (
        <>
            {keys.map((key: string, idx: number) => (
                <Bar
                    key={key}
                    dataKey={key}
                    radius={[4, 4, 0, 0]}
                    fill={colors[key] || palette[idx % palette.length]}
                    stackId={isStacked ? "a" : undefined}
                    isAnimationActive={false}
                    label={isLabelsShown ? { position: isStacked ? 'inside' : 'top', fill: isStacked ? '#ffffff' : '#64748b', fontSize: 11 } : false}
                />
            ))}
        </>
    );
};

const DataEditorPopover = ({ settings, data, keys, colors, updateSettings }: any) => {
    const isPie = settings.chartType === 'circular';
    const displayKeys = isPie && keys.length > 0 ? [keys[0]] : keys;

    const handleKeyChange = (kIdx: number, newName: string) => {
        const oldKey = keys[kIdx];
        const newKeys = [...keys];
        newKeys[kIdx] = newName;

        const newData = data.map((row: any) => {
            const newRow = { ...row };
            newRow[newName] = newRow[oldKey];
            delete newRow[oldKey];
            return newRow;
        });

        const newColors = { ...colors };
        if (newColors[oldKey]) {
            newColors[newName] = newColors[oldKey];
            delete newColors[oldKey];
        }

        updateSettings({ activeColorKey: newName }, { keys: newKeys, data: newData, colors: newColors });
    };

    const handleNameChange = (rIdx: number, newName: string) => {
        const oldName = data[rIdx].name;
        const newData = [...data];
        newData[rIdx] = { ...newData[rIdx] };
        newData[rIdx].name = newName;

        const newColors = { ...colors };
        if (newColors[oldName]) {
            newColors[newName] = newColors[oldName];
            delete newColors[oldName];
        }

        updateSettings(isPie ? { activeColorKey: newName } : {}, { data: newData, colors: newColors });
    };

    const handleValChange = (rIdx: number, key: string, val: string) => {
        const newData = [...data];
        newData[rIdx] = { ...newData[rIdx] };
        newData[rIdx][key] = val;
        updateSettings({}, { data: newData });
    };

    const addColumn = () => {
        const newKey = `Ново ${keys.length + 1}`;
        const newKeys = [...keys, newKey];
        const newData = data.map((r: any) => ({ ...r, [newKey]: 0 }));
        updateSettings({}, { keys: newKeys, data: newData });
    };

    const addRow = () => {
        const newRow: any = { name: `Регион ${data.length + 1}` };
        keys.forEach((k: string) => newRow[k] = 0);
        updateSettings({}, { data: [...data, newRow] });
    };

    const removeRow = (idx: number) => {
        if (data.length <= 1) return;
        updateSettings({}, { data: data.filter((_: any, i: number) => i !== idx) });
    };

    const removeColumn = (key: string) => {
        if (keys.length <= 1) return;
        updateSettings({}, {
            keys: keys.filter((k: string) => k !== key),
            data: data.map((r: any) => { const n = {...r}; delete n[key]; return n; })
        });
    };

    return (
        <div
            className="absolute top-[calc(100%+15px)] left-0 w-[600px] z-[99999] bg-white rounded-xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] border border-slate-100 overflow-hidden cursor-default animate-in slide-in-from-top-4"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="p-4 overflow-x-auto custom-scrollbar">
                <table className="w-full text-[13px] text-slate-600 border-collapse border border-slate-200">
                    <tbody>
                    <tr>
                        <td className="border border-slate-200 bg-slate-50 p-0"></td>
                        {displayKeys.map((k: string, i: number) => (
                            <td key={`color-${i}`} className="border border-slate-200 p-0 relative group">
                                <div
                                    className="h-8 w-full cursor-pointer transition-all"
                                    style={{ backgroundColor: !isPie ? (colors[k] || CHART_PALETTE[i % CHART_PALETTE.length]) : '#f8fafc' }}
                                    onClick={() => !isPie && updateSettings({ activeColorKey: k })}
                                >
                                    {!isPie && settings.activeColorKey === k && <div className="absolute inset-0 border-[3px] border-blue-600 shadow-inner" />}
                                </div>
                                <button onClick={() => removeColumn(k)} className={`absolute -top-2 -right-2 bg-red-100 text-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 z-10 ${keys.length <= 1 ? 'hidden' : ''}`}><Trash2 size={12}/></button>
                            </td>
                        ))}
                        {!isPie && (
                            <td className="border border-slate-200 p-0 hover:bg-slate-50 cursor-pointer" onClick={addColumn}>
                                <div className="h-8 flex items-center justify-center text-slate-400 hover:text-blue-500"><Plus size={16} /></div>
                            </td>
                        )}
                    </tr>
                    <tr>
                        <td className="border border-slate-200 bg-slate-50 p-1 font-medium text-slate-500 w-[120px]">
                            <input
                                value={settings.xAxisLabel || 'Месец'}
                                onChange={e => updateSettings({ xAxisLabel: e.target.value })}
                                className="w-full outline-none text-center bg-transparent"
                                placeholder="Ознака"
                            />
                        </td>
                        {displayKeys.map((k: string, i: number) => (
                            <td key={`head-${i}`} className="border border-slate-200 p-1 min-w-[80px]">
                                <input value={k} onChange={e => handleKeyChange(i, e.target.value)} className="w-full outline-none text-center bg-transparent" />
                            </td>
                        ))}
                        {!isPie && <td className="border border-slate-200 bg-slate-50"></td>}
                    </tr>
                    {data.map((row: any, rIdx: number) => (
                        <tr key={rIdx} className="hover:bg-slate-50">
                            <td className="border border-slate-200 p-0 relative" onClick={() => isPie && updateSettings({ activeColorKey: row.name })}>
                                {isPie && (
                                    <div
                                        className="absolute left-0 top-0 bottom-0 w-3 cursor-pointer"
                                        style={{ backgroundColor: colors[row.name] || CHART_PALETTE[rIdx % CHART_PALETTE.length] }}
                                    >
                                        {settings.activeColorKey === row.name && <div className="absolute inset-0 border-2 border-blue-600 shadow-inner" />}
                                    </div>
                                )}
                                <input value={row.name} onChange={e => handleNameChange(rIdx, e.target.value)} className={`w-full outline-none py-2 bg-transparent ${isPie ? 'pl-5' : 'pl-2'}`} />
                            </td>
                            {displayKeys.map((k: string) => (
                                <td key={`cell-${rIdx}-${k}`} className="border border-slate-200 p-1">
                                    <input type="text" value={row[k] !== undefined ? row[k] : ''} onChange={e => handleValChange(rIdx, k, e.target.value)} className="w-full outline-none text-center bg-transparent" />
                                </td>
                            ))}
                            <td className="border border-slate-200 p-1 text-center">
                                <button onClick={() => removeRow(rIdx)} className={`text-slate-400 hover:text-red-500 ${data.length <= 1 ? 'opacity-30 cursor-not-allowed' : ''}`} disabled={data.length <= 1}><Trash2 size={14} /></button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                <button onClick={addRow} className="mt-3 text-xs font-bold text-blue-500 hover:bg-blue-50 py-1.5 px-3 rounded-md flex items-center gap-1">
                    <Plus size={14} /> Додај ред
                </button>
            </div>
        </div>
    );
};

const MapElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, onDelete, onDragStart }: any) => {
    const defaultSettings = el.payload.settings || {};
    const currentSettings = isSelected && selectedElement?.elementId === el.id ? selectedElement.settings : defaultSettings;

    const data = el.payload.data || currentSettings.data || [];
    const colors = el.payload.colors || currentSettings.colors || {};

    const activeDistrictsForLegend = data.filter((d: any) => d['Вредност'] && String(d['Вредност']).trim() !== '0' && String(d['Вредност']).trim() !== '');

    return (
        <div
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)}
            onClick={(e) => {
                e.stopPropagation();
                setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'map', settings: currentSettings });
            }}
            className={`break-inside-avoid group relative transition-all bg-white flex flex-col rounded-xl border-2 w-full min-w-0 max-w-full ${isSelected ? 'border-blue-400 shadow-md ring-4 ring-blue-50 z-[99999]' : 'border-transparent hover:border-slate-200 z-10'}`}
            style={{ height: '350px' }}
        >
            {isSelected && (
                <div className="absolute -top-3 right-2 hidden group-hover:flex gap-1 z-20">
                    <div className="p-1 bg-white shadow-md border border-slate-200 rounded text-slate-400 cursor-grab active:cursor-grabbing"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="p-1 bg-white shadow-md border border-slate-200 rounded text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
            )}

            <div className={`w-full h-full flex flex-col items-center justify-center pointer-events-none relative overflow-hidden min-w-0 ${isSelected ? 'rounded-lg border-2 border-dashed border-slate-200 bg-slate-50' : ''}`}>
                <div className="w-full h-full flex items-center justify-center relative min-h-0">
                    <MapGraphic colors={colors} />
                </div>

                {currentSettings.showLegend && activeDistrictsForLegend.length > 0 && (
                    <div className="absolute bottom-4 left-4 flex flex-col gap-1 bg-white/90 backdrop-blur-sm p-2 rounded shadow-sm border border-slate-100 z-10">
                        {activeDistrictsForLegend.map((row: any, i: number) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded" style={{ backgroundColor: colors[row.name] || '#e2e8f0' }} />
                                <span className="text-[10px] text-slate-600 font-medium">{row.name} ({row['Вредност']})</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const ChartElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart }: any) => {
    const defaultSettings = el.payload.settings || {};
    const currentSettings = isSelected && selectedElement?.elementId === el.id ? selectedElement.settings : defaultSettings;

    const data = el.payload.data || currentSettings.data || [];
    const keys = el.payload.keys || currentSettings.keys || [];
    const colors = el.payload.colors || currentSettings.colors || {};
    const subType = el.payload.subChartType || selectedElement?.extraPayload?.subChartType || currentSettings.subChartType;

    const updateLocalSettings = (newSettings: any, newPayload: any = {}) => {
        updateElementSettings(newSettings, newPayload);
    };

    const wrapperRef = useRef<HTMLDivElement>(null);
    const [chartWidth, setChartWidth] = useState(400);

    useEffect(() => {
        if (!wrapperRef.current) return;
        const observer = new ResizeObserver((entries) => {
            window.requestAnimationFrame(() => {
                if (entries[0]) {
                    setChartWidth(entries[0].contentRect.width);
                }
            });
        });
        observer.observe(wrapperRef.current);
        return () => observer.disconnect();
    }, []);

    const isPie = currentSettings.chartType === 'circular';
    const isSemicircle = subType === 'semicircle_doughnut';
    const isDoughnut = subType === 'doughnut_basic' || isSemicircle;

    const baseChartHeight = isPie ? Math.max(180, Math.min(280, chartWidth)) : 280;

    const legendItemCount = isPie ? data.length : keys.length;
    const itemsPerRow = Math.max(1, Math.min(6, Math.floor(chartWidth / 85)));
    const legendRows = Math.ceil(legendItemCount / itemsPerRow);
    const dynamicHeight = baseChartHeight + (currentSettings.showLegend ? legendRows * 22 : 0);

    const dynamicOuterRadius = Math.max(35, Math.min((chartWidth - 70) / 2, (baseChartHeight - 60) / 2));
    const dynamicInnerRadius = isDoughnut ? dynamicOuterRadius * 0.6 : 0;

    const renderLegendText = (value: string) => (
        <span style={{ color: '#1E293B', fontWeight: 600, paddingLeft: '4px' }}>{value}</span>
    );

    const renderCustomPieLabel = (props: any) => {
        const { cx, cy, midAngle, outerRadius, value, index } = props;
        if (value === 0 || value === '0' || value === '') return null;

        const RADIAN = Math.PI / 180;
        const isNarrow = chartWidth < 250;

        const radiusOffset = index % 2 === 0 ? (isNarrow ? 6 : 12) : (isNarrow ? 16 : 28);
        const labelRadius = outerRadius + radiusOffset;

        const x = cx + labelRadius * Math.cos(-midAngle * RADIAN);
        const y = cy + labelRadius * Math.sin(-midAngle * RADIAN);

        const lineStartX = cx + outerRadius * Math.cos(-midAngle * RADIAN);
        const lineStartY = cy + outerRadius * Math.sin(-midAngle * RADIAN);

        return (
            <g>
                <path d={`M${lineStartX},${lineStartY} L${x},${y}`} stroke="#cbd5e1" strokeWidth={1} fill="none" />
                <text x={x + (x > cx ? 4 : -4)} y={y} fill="#1E293B" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={isNarrow ? 9 : 11} fontWeight="bold">
                    {value}
                </text>
            </g>
        );
    };

    const renderChart = () => {
        if (!data.length || !keys.length) return <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium">Učitavanje podataka...</div>;

        const axisTickStyle = { fontSize: 12, fill: '#64748b' };
        const axisLineStyle = { stroke: '#cbd5e1' };
        const tooltipStyle = { borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', padding: '10px 14px' };

        const chartMargin = { top: 25, right: 15, left: -20, bottom: 5 };

        switch (currentSettings.chartType) {
            case 'bar': {
                const isStacked = subType === 'stacked_v' || subType === 'stacked_h';
                const isHorizontal = subType === 'grouped_h' || subType === 'stacked_h';
                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <BarChart data={data} layout={isHorizontal ? "vertical" : "horizontal"} margin={chartMargin}>
                            {currentSettings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={isHorizontal} horizontal={!isHorizontal} stroke="#E2E8F0" />}
                            {isHorizontal ? (
                                <>
                                    <XAxis type="number" tick={axisTickStyle} axisLine={false} tickLine={false} />
                                    <YAxis type="category" dataKey="name" tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} />
                                </>
                            ) : (
                                <>
                                    <XAxis type="category" dataKey="name" tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} />
                                    <YAxis type="number" tick={axisTickStyle} axisLine={false} tickLine={false} />
                                </>
                            )}
                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                            {currentSettings.showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}
                            <RenderBars keys={keys} colors={colors} isStacked={isStacked} isLabelsShown={currentSettings.showLabels} palette={CHART_PALETTE} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            }
            case 'line': {
                const isArea = subType === 'area_basic' || subType === 'area_stacked';
                const isStackedArea = subType === 'area_stacked';
                const hasDots = subType === 'line_dots';
                const ChartComponent = isArea ? AreaChart : LineChart;
                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <ChartComponent data={data} margin={chartMargin}>
                            {currentSettings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis dataKey="name" tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} />
                            <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={tooltipStyle} />
                            {currentSettings.showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}
                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                if (isArea) return (
                                    <Area
                                        key={key} type="monotone" dataKey={key} stackId={isStackedArea ? "1" : undefined}
                                        stroke={baseColor} fill={baseColor} fillOpacity={0.6} strokeWidth={2}
                                        dot={hasDots ? { r: 4 } : false} activeDot={isArea ? { r: 5 } : false} isAnimationActive={false}
                                        label={currentSettings.showLabels ? { position: 'top', fill: '#64748b', fontSize: 11, dy: -10 } : false}
                                    />
                                );
                                return (
                                    <Line
                                        key={key} type="monotone" dataKey={key} stroke={baseColor} strokeWidth={3}
                                        dot={hasDots ? { r: 4, fill: baseColor, strokeWidth: 2, stroke: '#fff' } : { r: 0 }}
                                        activeDot={{ r: 6 }} isAnimationActive={false}
                                        label={currentSettings.showLabels ? { position: 'top', fill: '#64748b', fontSize: 11, dy: -10 } : false}
                                    />
                                );
                            })}
                        </ChartComponent>
                    </ResponsiveContainer>
                );
            }
            case 'circular': {
                if (subType === 'radial_progress') {
                    const radialData = data.map((d: any, i: number) => ({
                        name: d.name,
                        value: Number(d[keys[0]]) || 0,
                        fill: colors[d.name] || CHART_PALETTE[i % CHART_PALETTE.length]
                    }));
                    return (
                        <ResponsiveContainer width="99%" height="100%">
                            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="100%" barSize={12} data={radialData}>
                                <RadialBar
                                    background={{ fill: '#f1f5f9' }}
                                    dataKey="value"
                                    cornerRadius={10}
                                    label={currentSettings.showLabels ? { position: 'end', fill: '#64748b', fontSize: 11 } : false}
                                />
                                <Tooltip contentStyle={tooltipStyle} />
                                {currentSettings.showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}
                            </RadialBarChart>
                        </ResponsiveContainer>
                    );
                }

                const pieData = data.map((d: any) => ({ name: d.name, value: Number(d[keys[0]]) || 0 }));

                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            <Tooltip contentStyle={tooltipStyle} />
                            {currentSettings.showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}
                            <Pie
                                data={pieData} dataKey="value" nameKey="name"
                                cx="50%" cy={isSemicircle ? "75%" : "48%"}
                                outerRadius={dynamicOuterRadius}
                                innerRadius={dynamicInnerRadius}
                                isAnimationActive={false}
                                label={currentSettings.showLabels ? renderCustomPieLabel : false}
                                labelLine={false}
                                startAngle={isSemicircle ? 180 : 0}
                                endAngle={isSemicircle ? 0 : 360}
                            >
                                {pieData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={colors[entry.name] || CHART_PALETTE[index % CHART_PALETTE.length]} stroke="#fff" strokeWidth={2}/>
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            }
            case 'composed': {
                const isAreaBar = subType === 'composed_area_bar';
                const isAreaLine = subType === 'composed_area_line';
                const isStackedLine = subType === 'composed_stacked_line';

                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <ComposedChart data={data} margin={chartMargin}>
                            {currentSettings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis dataKey="name" tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} />
                            <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                            {currentSettings.showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}

                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];

                                if (idx === 0) {
                                    if (isAreaLine) return <Area key={key} type="monotone" dataKey={key} fill={baseColor} stroke={baseColor} fillOpacity={0.3} isAnimationActive={false} label={currentSettings.showLabels ? { position: 'top', fill: '#64748b', fontSize: 11, dy: -10 } : false} />;
                                    if (isStackedLine) return <Bar key={key} dataKey={key} stackId="a" fill={baseColor} isAnimationActive={false} />;
                                    return <Bar key={key} dataKey={key} barSize={isAreaBar ? 15 : 20} fill={baseColor} radius={[4, 4, 0, 0]} isAnimationActive={false} label={currentSettings.showLabels ? { position: 'top', fill: '#64748b', fontSize: 11 } : false} />;
                                }

                                if (idx === 1) {
                                    if (isAreaBar) return <Area key={key} type="monotone" dataKey={key} fill={baseColor} stroke={baseColor} fillOpacity={0.3} isAnimationActive={false} label={currentSettings.showLabels ? { position: 'top', fill: '#64748b', fontSize: 11, dy: -10 } : false} />;
                                    if (isStackedLine) return <Bar key={key} dataKey={key} stackId="a" fill={baseColor} radius={[4, 4, 0, 0]} isAnimationActive={false} label={currentSettings.showLabels ? { position: 'insideTop', fill: '#fff', fontSize: 11 } : false} />;
                                    return <Line key={key} type="monotone" dataKey={key} stroke={baseColor} strokeWidth={3} dot={{ r: 4, fill: baseColor, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} label={currentSettings.showLabels ? { position: 'top', fill: '#64748b', fontSize: 11, dy: -10 } : false} />;
                                }

                                return <Line key={key} type="monotone" dataKey={key} stroke={baseColor} strokeWidth={3} dot={{ r: 4, fill: baseColor, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} label={currentSettings.showLabels ? { position: 'top', fill: '#64748b', fontSize: 11, dy: -10 } : false} />;
                            })}
                        </ComposedChart>
                    </ResponsiveContainer>
                );
            }
            case 'scatter': {
                const isBubble = subType === 'bubble_basic';
                const shape = subType === 'scatter_star' ? 'star' : subType === 'scatter_diamond' ? 'diamond' : 'circle';

                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <ScatterChart margin={chartMargin}>
                            {currentSettings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis type="category" dataKey="name" allowDuplicatedCategory={false} tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} />
                            <YAxis type="number" dataKey="value" tick={axisTickStyle} axisLine={false} tickLine={false} />
                            <ZAxis type="number" dataKey="value" range={isBubble ? [60, 600] : [50, 50]} />
                            <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }} />
                            {currentSettings.showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}

                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                const scatterData = data.map((d: any) => ({ name: d.name, value: Number(d[key]) || 0 }));
                                return (
                                    <Scatter key={key} name={key} data={scatterData} fill={baseColor} fillOpacity={isBubble ? 0.7 : 1} shape={shape} isAnimationActive={false}>
                                        {currentSettings.showLabels && <LabelList dataKey="value" position="top" fill="#64748b" fontSize={11} offset={10} />}
                                    </Scatter>
                                );
                            })}
                        </ScatterChart>
                    </ResponsiveContainer>
                );
            }
            case 'radar': {
                const isCircular = subType === 'radar_circular' || subType === 'radar_circular_outline';
                const isOutline = subType === 'radar_outline' || subType === 'radar_circular_outline';

                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <RadarChart cx="50%" cy="48%" outerRadius={dynamicOuterRadius * 1.3} data={data}>
                            <PolarGrid stroke="#e2e8f0" gridType={isCircular ? "circle" : "polygon"} />
                            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <PolarRadiusAxis angle={30} domain={['auto', 'auto']} tick={false} axisLine={false} />
                            <Tooltip contentStyle={tooltipStyle} />
                            {currentSettings.showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" formatter={renderLegendText} />}
                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                return (
                                    <Radar
                                        key={key}
                                        name={key}
                                        dataKey={key}
                                        stroke={baseColor}
                                        strokeWidth={isOutline ? 2 : 1}
                                        fill={isOutline ? "transparent" : baseColor}
                                        fillOpacity={0.5}
                                        isAnimationActive={false}
                                        label={currentSettings.showLabels ? { fill: '#64748b', fontSize: 11 } : false}
                                    />
                                );
                            })}
                        </RadarChart>
                    </ResponsiveContainer>
                );
            }
            default: return null;
        }
    };

    return (
        <div
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)}
            onClick={(e) => {
                e.stopPropagation();
                setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'chart', settings: currentSettings });
            }}
            className={`break-inside-avoid group relative transition-all bg-white flex flex-col rounded-xl border-2 w-full min-w-0 max-w-full ${isSelected ? 'border-blue-400 shadow-md ring-4 ring-blue-50 z-[99999]' : 'border-transparent hover:border-slate-200 z-10'}`}
            style={{ height: `${dynamicHeight}px` }}
        >
            {isSelected && (
                <div className="absolute -top-3 right-2 hidden group-hover:flex gap-1 z-20">
                    <div className="p-1.5 bg-white shadow-md border border-slate-200 rounded-lg text-slate-400 cursor-grab active:cursor-grabbing hover:bg-slate-50"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="p-1.5 bg-white shadow-md border border-slate-200 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
            )}

            <div ref={wrapperRef} className={`w-full h-full flex-1 pointer-events-none min-w-0 overflow-hidden ${isSelected ? 'rounded-lg border-2 border-dashed border-slate-200 bg-slate-50' : ''}`}>
                {renderChart()}
            </div>

            {isSelected && currentSettings.showDataEditor && (
                <DataEditorPopover settings={currentSettings} data={data} keys={keys} colors={colors} updateSettings={updateLocalSettings} />
            )}
        </div>
    );
};

const ImageElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart }: any) => {
    const defaultSettings = el.payload.settings;
    const currentSettings = isSelected ? selectedElement.settings : defaultSettings;
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData(); formData.append("image", file);
        try {
            const match = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'));
            const csrfToken = match ? decodeURIComponent(match[2]) : '';
            const response = await axiosClient.post("/api/upload-image", formData, { headers: { 'Content-Type': 'multipart/form-data', 'X-XSRF-TOKEN': csrfToken } });
            if (response.data?.url) updateElementSettings({ url: response.data.url });
        } catch (error) { alert("Грешка при отпремању."); } finally { setIsUploading(false); }
    };

    return (
        <div
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)}
            onClick={(e) => { e.stopPropagation(); setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'image', settings: currentSettings }); }}
            className={`break-inside-avoid group relative cursor-pointer transition-all flex flex-col rounded p-1.5 border-2 ${isSelected ? 'border-blue-400 bg-slate-50 shadow-md z-[99999]' : 'border-transparent hover:border-slate-200 bg-transparent z-10'}`}
        >
            {isSelected && (
                <div className="absolute -top-3 right-2 hidden group-hover:flex gap-1 z-20">
                    <div className="p-1.5 bg-white shadow-md border border-slate-200 rounded-lg text-slate-400 cursor-grab active:cursor-grabbing hover:bg-slate-50"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="p-1.5 bg-white shadow-md border border-slate-200 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
            )}

            {currentSettings.url ? (
                <div className={`flex flex-col w-full ${
                    currentSettings.alignment === 'left' ? 'items-start text-left' :
                        currentSettings.alignment === 'right' ? 'items-end text-right' :
                            'items-center text-center'
                }`}>
                    <img
                        src={currentSettings.url}
                        alt={currentSettings.altText}
                        className="h-auto rounded-lg transition-all"
                        style={{ width: `${currentSettings.width || 100}%` }}
                    />
                    {(currentSettings.altText || isSelected) && (
                        <span className={`text-sm italic mt-2.5 block w-full ${!currentSettings.altText ? 'text-slate-400' : 'text-slate-600'}`}>
                            {currentSettings.altText || (isSelected ? "Назив слике (додајте у менију)" : "")}
                        </span>
                    )}
                </div>
            ) : (
                <div className="p-8 w-full min-h-[180px] bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center transition-colors group-hover:border-slate-400">
                    {isUploading ? (
                        <span className="animate-pulse text-sm font-semibold text-blue-500">Отпремање...</span>
                    ) : (
                        <label className="cursor-pointer text-slate-400 hover:text-blue-500 flex flex-col items-center gap-2">
                            <UploadCloud size={32} />
                            <span className="text-xs font-semibold">Одабери слику</span>
                            <input type="file" className="hidden" onChange={handleImageUpload} />
                        </label>
                    )}
                </div>
            )}
        </div>
    );
};

const TextElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart, onAutoSplit, globalFootnoteMap }: any) => {
    const defaultSettings = el.payload.settings;
    const currentSettings = isSelected ? selectedElement.settings : defaultSettings;
    const editorRef = useRef<HTMLDivElement>(null);
    const contentAreaRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        contentAreaRef.current = document.getElementById(`page-content-${pageId}`);
    }, [pageId]);

    // Ажурирање бројева фуснота у тексту на основу глобалне мапе
    useEffect(() => {
        if (!editorRef.current) return;
        const sups = editorRef.current.querySelectorAll('sup[data-footnote-id]');
        sups.forEach(sup => {
            const id = sup.getAttribute('data-footnote-id');
            if (id && globalFootnoteMap[id]) {
                const numStr = `[${globalFootnoteMap[id]}]`;
                if (sup.innerHTML !== numStr) {
                    sup.innerHTML = numStr;
                }
            }
        });
    }, [currentSettings.content, globalFootnoteMap]);

    useEffect(() => {
        if (editorRef.current && currentSettings.content !== editorRef.current.innerHTML) {
            editorRef.current.innerHTML = currentSettings.content || '';
        }
    }, [currentSettings.content]);

    const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    };

    const handleAddFootnote = () => {
        const id = `fn-${Math.random().toString(36).substr(2, 9)}`;
        const html = `<sup data-footnote-id="${id}" class="footnote-marker text-blue-500 cursor-pointer font-bold px-[1px] select-none" contenteditable="false">[*]</sup>`;
        document.execCommand('insertHTML', false, html);

        if (editorRef.current) {
            const newHtml = editorRef.current.innerHTML;
            const currentIds = extractFootnoteIds(newHtml);
            const oldFootnotes = currentSettings.footnotes || {};
            const newFootnotes: any = {};
            currentIds.forEach(cid => {
                newFootnotes[cid] = oldFootnotes[cid] || '';
            });
            newFootnotes[id] = 'Унесите текст фусноте...';
            updateElementSettings({ content: newHtml, footnotes: newFootnotes });
        }
    };

    const handleInput = (e: FormEvent<HTMLDivElement>) => {
        const html = e.currentTarget.innerHTML;
        const currentIds = extractFootnoteIds(html);
        const oldFootnotes = currentSettings.footnotes || {};
        const newFootnotes: any = {};

        // Аутоматско чишћење обрисаних фуснота
        currentIds.forEach(id => {
            newFootnotes[id] = oldFootnotes[id] !== undefined ? oldFootnotes[id] : '';
        });

        const contentArea = contentAreaRef.current;

        if (contentArea && contentArea.scrollHeight > contentArea.clientHeight + 10) {
            e.preventDefault();

            let words = html.split(/(<[^>]*>|\s+)/).filter(Boolean);
            let fitWords = [...words];
            let overflowWords: string[] = [];
            let maxSafety = 2000;

            while (contentArea.scrollHeight > contentArea.clientHeight && fitWords.length > 0 && maxSafety > 0) {
                let w = fitWords.pop();
                if (w) overflowWords.unshift(w);
                if (editorRef.current) editorRef.current.innerHTML = fitWords.join('');
                maxSafety--;
            }

            const safeHtml = fitWords.join('');
            const remainingText = overflowWords.join('');

            if (remainingText.trim() !== '') {
                if (editorRef.current) editorRef.current.blur();

                // Раздвајање фуснота за обе странице
                const safeHtmlIds = extractFootnoteIds(safeHtml);
                const remainingIds = extractFootnoteIds(remainingText);

                const safeFootnotes: any = {};
                const remainingFootnotes: any = {};

                safeHtmlIds.forEach(id => safeFootnotes[id] = newFootnotes[id]);
                remainingIds.forEach(id => remainingFootnotes[id] = newFootnotes[id]);

                onAutoSplit({
                    sourcePageId: pageId,
                    elementId: el.id,
                    remainingContent: remainingText,
                    safeHtml: safeHtml,
                    safeFootnotes,
                    remainingFootnotes
                });
                return;
            }
        }

        if (isSelected) updateElementSettings({ content: html, footnotes: newFootnotes });
    };

    return (
        <div
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)}
            onClick={(e) => {
                e.stopPropagation();
                setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'text', settings: { ...currentSettings, content: editorRef.current?.innerHTML || currentSettings.content } });
            }}
            className={`group relative cursor-text transition-all rounded p-1.5 border-2 ${isSelected ? 'border-blue-400 bg-slate-50 shadow-inner z-[99999]' : 'border-transparent hover:border-slate-200 bg-transparent z-10'}`}
        >
            {isSelected && (
                <div className="absolute -top-3 right-2 hidden group-hover:flex gap-1 z-20">
                    <div className="p-1.5 bg-white shadow-md border border-slate-200 rounded-lg text-slate-400 cursor-grab active:cursor-grabbing hover:bg-slate-50"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="p-1.5 bg-white shadow-md border border-slate-200 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
            )}

            {isSelected && <TextToolbar editorRef={editorRef} onAddFootnote={handleAddFootnote} />}

            <div
                id={`editor-${el.id}`}
                ref={editorRef} contentEditable suppressContentEditableWarning data-placeholder="Унесите текст..."
                onInput={handleInput} onPaste={handlePaste}
                className={`outline-none w-full editor-content empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none empty:before:block [&_ul]:list-disc [&_ul]:ml-5 [&_ol]:list-decimal [&_ol]:ml-5 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_p]:mb-2 min-h-[30px]`}
                style={{ color: currentSettings.color, textAlign: currentSettings.alignment }}
            />
        </div>
    );
};

const TableElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart, onAutoSplit }: any) => {
    const defaultSettings = el.payload.settings;
    const currentSettings = isSelected ? selectedElement.settings : defaultSettings;
    const content = el.payload.sr?.content || {};

    const tableContainerRef = useRef<HTMLDivElement>(null);
    const contentAreaRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        contentAreaRef.current = document.getElementById(`page-content-${pageId}`);
    }, [pageId]);

    useEffect(() => {
        if (!tableContainerRef.current || !contentAreaRef.current) return;

        const pageContent = contentAreaRef.current;

        if (pageContent.scrollHeight > pageContent.clientHeight + 10) {
            const totalRows = currentSettings.rows || 1;
            if (totalRows <= 1) return;

            const rowsToKeep = totalRows - 1;

            const newContent: any = {};
            const newCells: any = {};
            const oldCells = currentSettings.cells || {};
            const cols = currentSettings.columns || 1;

            for (let c = 0; c < cols; c++) {
                const oldKey = `${rowsToKeep}_${c}`;
                const newKey = `0_${c}`;
                if (content[oldKey]) newContent[newKey] = content[oldKey];
                if (oldCells[oldKey]) newCells[newKey] = oldCells[oldKey];
            }

            const newTableSettings = { ...currentSettings, rows: 1, cells: newCells };

            onAutoSplit({
                sourcePageId: pageId,
                elementId: el.id,
                remainingContent: "TABLE_SPLIT",
                tableSettings: newTableSettings,
                tableContent: newContent
            });
        }
    }, [currentSettings.rows, currentSettings.columns, content]);

    const handleCellChange = (rIdx: number, cIdx: number, html: string) => {
        const cellKey = `${rIdx}_${cIdx}`;
        updateElementSettings(currentSettings, { extraPayload: { sr: { content: { ...content, [cellKey]: html } } } });
    };

    return (
        <div
            ref={tableContainerRef}
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)}
            className={`break-inside-avoid group relative transition-all rounded-xl p-1.5 border-2 w-full max-w-full ${isSelected ? 'border-blue-400 bg-slate-50 shadow-md z-[99999]' : 'border-transparent hover:border-slate-200 bg-transparent z-10'}`}
            onClick={(e) => { e.stopPropagation(); setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'table', subType: 'table', settings: currentSettings }); }}
        >
            {isSelected && (
                <div className="absolute -top-3 right-2 hidden group-hover:flex gap-1 z-20">
                    <div className="p-1.5 bg-white shadow-md border border-slate-200 rounded-lg text-slate-400 cursor-grab active:cursor-grabbing hover:bg-slate-50"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="p-1.5 bg-white shadow-md border border-slate-200 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
            )}

            <div className="w-full max-w-full overflow-hidden rounded-lg">
                <table className="w-full table-fixed border-collapse border border-slate-300 bg-white shadow-sm rounded-lg overflow-hidden relative z-0">
                    <tbody>
                    {Array.from({ length: currentSettings.rows || 1 }).map((_, rIdx) => (
                        <tr key={`row-${rIdx}`}>
                            {Array.from({ length: currentSettings.columns || 1 }).map((_, cIdx) => {
                                const key = `${rIdx}_${cIdx}`;
                                const cellSt = currentSettings.cells?.[key] || {};

                                if (cellSt.hidden) return null;

                                return (
                                    <EditableCell
                                        key={`cell-${key}`}
                                        value={content[key] || ''}
                                        cellSt={cellSt}
                                        isActive={selectedElement?.activeCell === key}
                                        style={{
                                            backgroundColor: cellSt.backgroundColor || '#ffffff',
                                            textAlign: cellSt.alignment || 'left',
                                            verticalAlign: cellSt.verticalAlignment || 'top',
                                            color: cellSt.textColor || '#1E293B'
                                        }}
                                        colSpan={cellSt.colSpan || 1}
                                        rowSpan={cellSt.rowSpan || 1}
                                        onClick={(e: any) => { e.stopPropagation(); setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'table', subType: 'cell', activeCell: key, settings: currentSettings }); }}
                                        onBlur={(html: string) => handleCellChange(rIdx, cIdx, html)}
                                    />
                                );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const EditableCell = ({ value, onBlur, style, isActive, onClick, cellSt, colSpan, rowSpan }: any) => {
    const cellRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (cellRef.current && value !== cellRef.current.innerHTML) { cellRef.current.innerHTML = value || ''; } }, [value]);
    return (
        <td
            onClick={onClick}
            className={`border border-slate-200 p-2 transition-all relative ${isActive ? 'ring-2 ring-blue-400 ring-inset bg-blue-50/30' : ''}`}
            style={style}
            colSpan={colSpan}
            rowSpan={rowSpan}
        >
            <div ref={cellRef} contentEditable suppressContentEditableWarning onInput={(e) => onBlur(e.currentTarget.innerHTML)} className="outline-none min-h-[24px] text-sm break-words" style={{ fontWeight: cellSt.type === 'headline' ? 'bold' : 'normal', fontSize: cellSt.type === 'headline' ? '15px' : '14px' }} />
        </td>
    );
};

const LayoutSelector = ({ onSelect, position = "bottom" }: any) => {
    const posClasses = position === "right"
        ? "absolute top-0 left-full ml-3"
        : "absolute top-full mt-2 left-1/2 -translate-x-1/2";

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            className={`${posClasses} z-[99999] bg-white rounded-xl shadow-[0_15px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-3 w-56 flex flex-col gap-2 animate-in fade-in zoom-in-95`}
        >
            <button onClick={() => onSelect('1/1')} className="flex items-center gap-3 w-full p-2.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-sm text-slate-600 font-bold transition-colors">
                <LayoutTemplate size={18} /><span>Пуна ширина</span>
            </button>
            <div className="w-full h-px bg-slate-100 my-1"></div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Две колоне</div>
            <div className="grid grid-cols-2 gap-1.5">
                {['1:1', '1:2', '2:1', '1:3', '3:1'].map(l => (
                    <button key={l} onClick={() => onSelect(l)} className="py-2 hover:bg-slate-50 hover:text-blue-500 rounded-md text-[13px] font-bold text-slate-500 text-center border border-slate-100 hover:border-blue-200 transition-colors shadow-sm">{l}</button>
                ))}
            </div>
            <div className="w-full h-px bg-slate-100 my-1 mt-1"></div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Три колоне</div>
            <div className="grid grid-cols-2 gap-1.5">
                {['1:1:1', '2:1:1', '1:1:2', '1:2:1'].map(l => (
                    <button key={l} onClick={() => onSelect(l)} className="py-2 hover:bg-slate-50 hover:text-blue-500 rounded-md text-[13px] font-bold text-slate-500 text-center border border-slate-100 hover:border-blue-200 transition-colors shadow-sm">{l}</button>
                ))}
            </div>
        </div>
    );
};

const ElementSelector = ({ onSelect }: any) => (
    <div
        onClick={(e) => e.stopPropagation()}
        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-[99999] bg-white rounded-xl shadow-[0_15px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-2.5 w-56 flex flex-col gap-1 animate-in zoom-in-95"
    >
        <button onClick={() => onSelect('text')} className="flex items-center gap-3.5 w-full p-2.5 hover:bg-slate-50 rounded-lg text-sm text-slate-600 font-bold"><Type size={18} className="text-blue-500" /> ТЕКСТ</button>
        <button onClick={() => onSelect('image')} className="flex items-center gap-3.5 w-full p-2.5 hover:bg-slate-50 rounded-lg text-sm text-slate-600 font-bold"><ImageIcon size={18} className="text-green-500" /> СЛИКА</button>
        <button onClick={() => onSelect('table')} className="flex items-center gap-3.5 w-full p-2.5 hover:bg-slate-50 rounded-lg text-sm text-slate-600 font-bold"><Table2 size={18} className="text-orange-500" /> ТАБЕЛА</button>
        <button onClick={() => onSelect('chart')} className="flex items-center gap-3.5 w-full p-2.5 hover:bg-slate-50 rounded-lg text-sm text-slate-600 font-bold border-t border-slate-100 pt-3 mt-1"><BarChart3 size={18} className="text-purple-500" /> ГРАФИКОН</button>
        <button onClick={() => onSelect('map')} className="flex items-center gap-3.5 w-full p-2.5 hover:bg-slate-50 rounded-lg text-sm text-slate-600 font-bold border-t border-slate-100"><MapIcon size={18} className="text-teal-500" /> МАПА</button>
    </div>
);

const PageItem = ({ page, pageIndex, totalPages, onDeletePage, setPages, selectedElement, setSelectedElement, updateElementSettings, handleAutoSplit, onDragStart, onDrop, handleDeleteElement, handleDeleteRow, getGridCols, handleAddElement, activeRowMenu, setActiveRowMenu, activeColMenu, setActiveColMenu, globalFootnoteMap }: any) => {
    const [showAddBtn, setShowAddBtn] = useState(true);
    const innerContentRef = useRef<HTMLDivElement>(null);

    // Извлачење фуснота само за ову страницу
    const pageFootnotes = useMemo(() => {
        const fns: any[] = [];
        page.rows.forEach((row: any) => {
            row.columns.forEach((col: any) => {
                col.elements.forEach((el: any) => {
                    if (el.type === 'text') {
                        const content = el.payload.settings.content || '';
                        const footnotesDict = el.payload.settings.footnotes || {};
                        const ids = extractFootnoteIds(content);
                        ids.forEach(id => {
                            fns.push({
                                id,
                                number: globalFootnoteMap[id],
                                text: footnotesDict[id] || ''
                            });
                        });
                    }
                });
            });
        });
        return fns.sort((a, b) => (a.number || 0) - (b.number || 0));
    }, [page, globalFootnoteMap]);

    useEffect(() => {
        if (!innerContentRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                if (entry.contentRect.height > 800) setShowAddBtn(false);
                else setShowAddBtn(true);
            }
        });
        observer.observe(innerContentRef.current);
        return () => observer.disconnect();
    }, [page.rows]);

    return (
        <div className="w-[794px] h-[1123px] bg-white shadow-2xl flex flex-col relative shrink-0 transition-all rounded-sm border border-slate-100 group/page">

            {totalPages > 1 && (
                <button
                    onClick={() => onDeletePage(page.id)}
                    className="absolute -right-12 top-0 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover/page:opacity-100 transition-opacity hover:bg-red-100 hover:scale-110 shadow-sm z-50"
                    title="Obriši stranicu"
                >
                    <X size={20} />
                </button>
            )}

            <div className="h-[100px] w-full relative shrink-0 z-0">
                <div className="absolute top-[45px] left-[50px] right-[50px]">
                    <div className="w-full text-right text-[11px] font-semibold text-slate-400 uppercase tracking-widest border-b-[2px] border-blue-50 pb-2">
                        Annual Report 2026
                    </div>
                </div>
            </div>

            <div id={`page-content-${page.id}`} className="flex-1 px-[50px] flex flex-col relative" style={{ maxHeight: '923px' }}>
                <div ref={innerContentRef} className="flex flex-col gap-6 w-full shrink-0 relative z-20">
                    {page.rows.map((row: any) => {
                        const isRowActive =
                            (activeRowMenu?.pageId === page.id && activeRowMenu?.rowId === row.id) ||
                            (activeColMenu?.pageId === page.id && row.columns.some((c: any) => c.id === activeColMenu.colId)) ||
                            (selectedElement?.pageId === page.id && selectedElement?.rowId === row.id);

                        return (
                            <div key={row.id} className={`group/row relative w-full border border-dashed border-transparent hover:border-slate-200 min-h-[40px] transition-all break-inside-avoid rounded-xl p-1 ${isRowActive ? 'z-[99999]' : 'z-10'}`}>
                                {row.columns.length > 0 && (
                                    <div className="absolute -left-14 top-1 opacity-0 group-hover/row:opacity-100 transition-opacity flex flex-col gap-2.5 z-30 animate-in fade-in zoom-in-90">
                                        <button onClick={(e) => { e.stopPropagation(); setActiveRowMenu(activeRowMenu?.rowId === row.id ? null : { pageId: page.id, rowId: row.id }); }} className="p-2.5 bg-white border border-slate-200 rounded-full shadow-md text-slate-400 hover:text-blue-500 hover:scale-110 transition-all"><Settings2 size={16} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRow(page.id, row.id); }} className="p-2.5 bg-white border border-slate-200 rounded-full shadow-md text-slate-400 hover:text-red-500 hover:scale-110 transition-all"><Trash2 size={16} /></button>
                                        {activeRowMenu?.rowId === row.id && <LayoutSelector onSelect={(l: string) => { const newCols = getGridCols(l); setPages((prev: any) => prev.map((p: any) => p.id === page.id ? { ...p, rows: p.rows.map((r: any) => r.id === row.id ? { ...r, columns: newCols.map((nc: ColumnData, i: number) => ({ ...nc, elements: r.columns[i]?.elements || [] })) } : r) } : p)); setActiveRowMenu(null); }} position="right" />}
                                    </div>
                                )}
                                {row.columns.length === 0 ? (
                                    <div className="h-[120px] flex items-center justify-center bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 group-hover:border-slate-300 transition-colors relative">
                                        <div className="relative flex flex-col items-center">
                                            <button onClick={(e) => { e.stopPropagation(); setActiveRowMenu({ pageId: page.id, rowId: row.id }); }} className="hover:scale-110 transition-transform active:scale-95"><img src={addIcon} alt="Add" className="w-12 h-12" /></button>
                                            {activeRowMenu?.rowId === row.id && <LayoutSelector onSelect={(l: string) => { setPages((prev: any) => prev.map((p: any) => p.id === page.id ? { ...p, rows: p.rows.map((r: any) => r.id === row.id ? { ...r, columns: getGridCols(l) } : r) } : p)); setActiveRowMenu(null); }} position="bottom" />}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-12 gap-0 relative z-0">
                                        {row.columns.map((col: any) => {
                                            const isColActive =
                                                (activeColMenu?.pageId === page.id && activeColMenu?.colId === col.id) ||
                                                (selectedElement?.pageId === page.id && selectedElement?.colId === col.id);

                                            return (
                                                <div key={col.id} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(page.id, row.id, col.id)} className={`${col.widthClass} min-h-[40px] border border-transparent hover:border-blue-100 rounded-xl transition-all relative group/col p-1 ${isColActive ? 'z-[99999]' : 'z-10'}`}>
                                                    {col.elements.map((el: any) => {
                                                        if (el.type === 'text') return <TextElementBlock key={el.id} el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} onAutoSplit={handleAutoSplit} globalFootnoteMap={globalFootnoteMap} />;
                                                        if (el.type === 'image') return <ImageElementBlock key={el.id} el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} />;
                                                        if (el.type === 'table') return <TableElementBlock key={el.id} el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} onAutoSplit={handleAutoSplit} />;
                                                        if (el.type === 'chart') return <ChartElementBlock key={el.id} el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} />;
                                                        if (el.type === 'map') return <MapElementBlock key={el.id} el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} />;
                                                        return null;
                                                    })}
                                                    <div className="absolute left-1/2 -bottom-3 -translate-x-1/2 opacity-0 group-hover/col:opacity-100 z-30 transition-all flex flex-col items-center animate-in fade-in zoom-in-90">
                                                        <button onClick={(e) => { e.stopPropagation(); setActiveColMenu({ pageId: page.id, colId: col.id }); }} className="p-1.5 bg-white border border-slate-200 rounded-full text-slate-400 shadow-md hover:text-blue-500 hover:bg-slate-50 transition-all hover:scale-110"><Plus size={14} /></button>
                                                        {activeColMenu?.colId === col.id && <ElementSelector onSelect={(t: ElementType) => handleAddElement(page.id, row.id, col.id, t)} />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                {showAddBtn && (
                    <div className="w-full pt-4 pb-8 shrink-0 relative z-10">
                        <button onClick={() => setPages((prev: any) => prev.map((p: any) => p.id === page.id ? { ...p, rows: [...p.rows, { id: Math.random().toString(36).substr(2, 9), columns: [] }] } : p))} className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex justify-center items-center gap-2 font-bold uppercase text-xs tracking-wider active:scale-[0.99]"><Plus size={18} /> Додај нови ред</button>
                    </div>
                )}
            </div>

            {/* ПРИКАЗ ФУСНОТА НА ДНУ СТРАНИЦЕ */}
            <div className="w-full px-[50px] shrink-0 z-10">
                {pageFootnotes.length > 0 && (
                    <div className="border-t-[1.5px] border-slate-200 pt-3 mb-2 flex flex-col gap-1.5 w-1/3">
                        {pageFootnotes.map((fn) => (
                            <div key={fn.id} className="text-[10px] text-slate-500 flex gap-1.5 leading-tight">
                                <span className="font-bold shrink-0">{fn.number}.</span>
                                <span className="break-words" dangerouslySetInnerHTML={{ __html: fn.text || '...' }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="h-[50px] w-full relative shrink-0 mt-auto z-0">
                <div className="absolute bottom-[20px] right-[50px]">
                    <div className="flex items-center text-blue-300 font-extrabold text-sm border-l-2 border-blue-50 pl-3 py-1">
                        {pageIndex + 1}.
                    </div>
                </div>
            </div>
        </div>
    );
};

interface CanvasProps {
    pages: any[];
    setPages: (action: any) => void;
}

const Canvas: FC<CanvasProps> = ({ pages, setPages }) => {
    const { setSelectedElement, selectedElement, updateElementSettings } = useEditor();

    const [activeRowMenu, setActiveRowMenu] = useState<{pageId: string, rowId: string} | null>(null);
    const [activeColMenu, setActiveColMenu] = useState<{pageId: string, colId: string} | null>(null);
    const [draggedItem, setDraggedItem] = useState<any>(null);

    const lastSplitTime = useRef(0);
    const initialPagesRef = useRef<any>(null);

    // ГЛОБАЛНИ РЕДОСЛЕД И НУМЕРАЦИЈА ФУСНОТА
    const globalFootnoteOrder = useMemo(() => {
        const order: string[] = [];
        pages.forEach(page => {
            page.rows.forEach((row: any) => {
                row.columns.forEach((col: any) => {
                    col.elements.forEach((el: any) => {
                        if (el.type === 'text' && el.payload.settings.content) {
                            const ids = extractFootnoteIds(el.payload.settings.content);
                            order.push(...ids);
                        }
                    });
                });
            });
        });
        return order;
    }, [pages]);

    const globalFootnoteMap = useMemo(() => {
        const map: any = {};
        globalFootnoteOrder.forEach((id, index) => {
            map[id] = index + 1; // Креће од 1 унутар целе секције (svih stranica)
        });
        return map;
    }, [globalFootnoteOrder]);

    useEffect(() => {
        if (!initialPagesRef.current && pages.length > 0) {
            initialPagesRef.current = JSON.stringify(pages);
        }

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (initialPagesRef.current !== JSON.stringify(pages)) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [pages]);

    useEffect(() => {
        if (selectedElement) {
            setPages((prev: any[]) => prev.map(page => {
                if (page.id !== selectedElement.pageId) return page;
                return {
                    ...page,
                    rows: page.rows.map((row: any) => ({
                        ...row, columns: row.columns.map((col: any) => ({
                            ...col, elements: col.elements.map((el: any) =>
                                el.id === selectedElement.elementId ? { ...el, payload: { ...el.payload, settings: selectedElement.settings, ...(selectedElement.extraPayload || {}) } } : el
                            )
                        }))
                    }))
                };
            }));
        }
    }, [selectedElement]);

    const handleAutoSplit = (params: any) => {
        const { sourcePageId, elementId, remainingContent, safeHtml, tableSettings, tableContent, safeFootnotes, remainingFootnotes } = params;

        const now = Date.now();
        if (now - lastSplitTime.current < 500) return;
        lastSplitTime.current = now;

        const newElementId = Math.random().toString(36).substr(2, 9);
        const newRowId = Math.random().toString(36).substr(2, 9);
        const newColId = Math.random().toString(36).substr(2, 9);

        setPages((prev: any[]) => {
            const pageIndex = prev.findIndex(p => p.id === sourcePageId);
            if (pageIndex === -1) return prev;

            let originalSettings: any = {};
            let isTableSplit = remainingContent === "TABLE_SPLIT";

            const updatedPages = prev.map((page, idx) => {
                if (idx !== pageIndex) return page;
                return {
                    ...page,
                    rows: page.rows.map((row: any) => ({
                        ...row, columns: row.columns.map((col: any) => ({
                            ...col, elements: col.elements.map((e: any) => {
                                if (e.id === elementId) {
                                    originalSettings = e.payload.settings;
                                    if (isTableSplit) {
                                        return { ...e, payload: { ...e.payload, settings: { ...e.payload.settings, rows: Math.max(1, (e.payload.settings.rows || 1) - 1) } } };
                                    } else {
                                        return { ...e, payload: { ...e.payload, settings: { ...e.payload.settings, content: safeHtml, footnotes: safeFootnotes } } };
                                    }
                                }
                                return e;
                            })
                        }))
                    }))
                };
            });

            let newElementPayload: any = {};
            if (isTableSplit && tableSettings) {
                newElementPayload = {
                    settings: tableSettings,
                    sr: { content: tableContent || {} }
                };
            } else {
                newElementPayload = { settings: { ...originalSettings, content: remainingContent, footnotes: remainingFootnotes } };
            }

            const newRow: RowData = {
                id: newRowId,
                columns: [{
                    id: newColId, widthClass: 'col-span-12',
                    elements: [{ id: newElementId, type: isTableSplit ? 'table' : 'text', payload: newElementPayload }]
                }]
            };

            const nextPageIndex = pageIndex + 1;
            const pageExists = nextPageIndex < updatedPages.length;

            if (pageExists) {
                return updatedPages.map((page, idx) => {
                    if (idx === nextPageIndex) {
                        return { ...page, rows: [newRow, ...page.rows] };
                    }
                    return page;
                });
            } else {
                return [...updatedPages, { id: `page-${Math.random().toString(36).substr(2, 9)}`, rows: [newRow] }];
            }
        });

        if (remainingContent !== "TABLE_SPLIT") {
            setTimeout(() => {
                const newElNode = document.getElementById(`editor-${newElementId}`);
                if (newElNode) {
                    newElNode.focus();
                    try {
                        const selection = window.getSelection();
                        const range = document.createRange();
                        range.selectNodeContents(newElNode);
                        range.collapse(false);
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                    } catch(e) {}
                }
            }, 200);
        }
    };

    const getGridCols = (layout: string): ColumnData[] => {
        const gen = () => Math.random().toString(36).substr(2, 9);
        const layouts: any = { '1/1': ['col-span-12'], '1:1': ['col-span-6', 'col-span-6'], '1:2': ['col-span-4', 'col-span-8'], '2:1': ['col-span-8', 'col-span-4'], '1:3': ['col-span-3', 'col-span-9'], '3:1': ['col-span-9', 'col-span-3'], '1:1:1': ['col-span-4', 'col-span-4', 'col-span-4'], '2:1:1': ['col-span-6', 'col-span-3', 'col-span-3'], '1:1:2': ['col-span-3', 'col-span-3', 'col-span-6'], '1:2:1': ['col-span-3', 'col-span-6', 'col-span-3'] };
        return (layouts[layout] || layouts['1/1']).map((cls: string) => ({ id: gen(), widthClass: cls, elements: [] }));
    };

    const handleAddElement = (pageId: string, rowId: string, colId: string, type: ElementType) => {
        const id = Math.random().toString(36).substr(2, 9);
        let payload: any = { settings: {} };

        if (type === 'text') payload.settings = { type: 'paragraph', alignment: 'left', content: '', color: '#1E293B', bold: false, footnotes: {} };
        else if (type === 'image') payload.settings = { url: '', altText: '', alignment: 'center' };
        else if (type === 'table') {
            payload.settings = { rows: 3, columns: 2, cells: { "0_0": { backgroundColor: "#f3f4f6", type: "headline" }, "0_1": { backgroundColor: "#f3f4f6", type: "headline" } } };
            payload.sr = { content: { "0_0": "Prihodi", "0_1": "Rashodi" } };
        }
        else if (type === 'chart') {
            payload.settings = { chartType: 'bar', subChartType: 'grouped_v', showLegend: true, showGrid: true, showLabels: false, showDataEditor: true, xAxisLabel: 'Месец' };
            payload.data = [{ name: 'Јануар', 'Prihodi': 400, 'Rashodi': 240 }, { name: 'Фебруар', 'Prihodi': 300, 'Rashodi': 139 }, { name: 'Март', 'Prihodi': 200, 'Rashodi': 980 }];
            payload.keys = ['Prihodi', 'Rashodi'];
            payload.colors = { 'Prihodi': '#8b98ff', 'Rashodi': '#34d399' };
        }
        else if (type === 'map') {
            payload.settings = { showLegend: true };
            payload.keys = ['Вредност'];
            payload.data = SERBIAN_DISTRICTS.map(d => ({ name: d, 'Вредност': '' }));
            payload.colors = {};
        }

        setPages((prev: any[]) => prev.map(page => page.id === pageId ? { ...page, rows: page.rows.map((row: any) => row.id === rowId ? { ...row, columns: row.columns.map((col: any) => col.id === colId ? { ...col, elements: [...col.elements, { id, type, payload }] } : col) } : row) } : page));
        setActiveColMenu(null);
    };

    const handleDeleteElement = (pageId: string, _rowId: string, _colId: string, elId: string) => {
        setPages((prev: any[]) => prev.map(page => page.id === pageId ? { ...page, rows: page.rows.map((row: any) => ({ ...row, columns: row.columns.map((col: any) => ({ ...col, elements: col.elements.filter((el: any) => el.id !== elId) })) })) } : page));
        setSelectedElement(null);
    };

    const handleDeleteRow = (pageId: string, rowId: string) => {
        setPages((prev: any[]) => prev.map(page => {
            if (page.id !== pageId) return page;
            return { ...page, rows: page.rows.filter((row: any) => row.id !== rowId) };
        }));
    };

    const handleDeletePage = (pageId: string) => {
        if (pages.length <= 1) return;
        setPages((prev: any[]) => prev.filter(page => page.id !== pageId));
        setSelectedElement(null);
    };

    const onDragStart = (e: any, pageId: string, rowId: string, colId: string, elementId: string) => {
        setDraggedItem({ pageId, rowId, colId, elementId });
        e.dataTransfer.effectAllowed = "move";
    };

    const onDrop = (targetPageId: string, targetRowId: string, targetColId: string) => {
        if (!draggedItem) return;
        setPages((prev: any[]) => {
            let item: any;
            const cleanPages = prev.map(page => ({ ...page, rows: page.rows.map((row: any) => ({ ...row, columns: row.columns.map((col: any) => { if (col.id === draggedItem.colId && page.id === draggedItem.pageId) { item = col.elements.find((e: any) => e.id === draggedItem.elementId); return { ...col, elements: col.elements.filter((e: any) => e.id !== draggedItem.elementId) }; } return col; }) })) }));
            if (!item) return prev;
            return cleanPages.map(page => page.id === targetPageId ? { ...page, rows: page.rows.map((row: any) => row.id === targetRowId ? { ...row, columns: row.columns.map((col: any) => col.id === targetColId ? { ...col, elements: [...col.elements, item] } : col) } : row) } : page);
        });
        setDraggedItem(null);
        setSelectedElement(null);
    };

    return (
        <div
            className="py-10 flex flex-col items-center gap-12 min-h-full"
            onClick={() => {
                setSelectedElement(null);
                setActiveRowMenu(null);
                setActiveColMenu(null);
            }}
        >
            {pages?.map((page, index) => (
                <PageItem
                    key={page.id} page={page} pageIndex={index} totalPages={pages.length} setPages={setPages}
                    selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings}
                    handleAutoSplit={handleAutoSplit} onDragStart={onDragStart} onDrop={onDrop}
                    handleDeleteElement={handleDeleteElement} handleDeleteRow={handleDeleteRow} onDeletePage={handleDeletePage}
                    getGridCols={getGridCols} handleAddElement={handleAddElement}
                    activeRowMenu={activeRowMenu} setActiveRowMenu={setActiveRowMenu} activeColMenu={activeColMenu} setActiveColMenu={setActiveColMenu}
                    globalFootnoteMap={globalFootnoteMap}
                />
            ))}
            <button onClick={(e) => { e.stopPropagation(); setPages((prev: any[]) => [...prev, { id: `page-${Date.now()}`, rows: [{ id: Math.random().toString(36).substr(2, 9), columns: [] }] }]); }} className="px-7 py-3.5 bg-white border border-slate-200 shadow-md rounded-full text-slate-500 font-bold hover:text-blue-600 hover:border-blue-300 hover:shadow-lg transition-all flex gap-2.5 items-center active:scale-95 mb-10">
                <Plus size={20} /> Нова страница
            </button>
        </div>
    );
};

export default Canvas;
