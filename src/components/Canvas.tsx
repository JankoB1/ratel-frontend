import { useState, useEffect, useRef, useMemo, type FC, type FormEvent, type ChangeEvent } from "react";
import {
    Plus, Table2, Type, Image as ImageIcon, LayoutTemplate,
    UploadCloud, Trash2, GripVertical, Settings2, BarChart3, Map as MapIcon,
    X, AlignLeft, AlignCenter, AlignRight
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

export const extractFootnoteIds = (html: string) => {
    const regex = /data-footnote-id="([^"]+)"/g;
    const ids = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        ids.push(match[1]);
    }
    return ids;
};

const hexToRgba = (hex: string, opacity: number) => {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const r = parseInt(cleanHex.slice(0, 2), 16) || 59;
    const g = parseInt(cleanHex.slice(2, 4), 16) || 130;
    const b = parseInt(cleanHex.slice(4, 6), 16) || 246;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
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

// Komponenta za prikaz labela (Tabela 1.1, Slika 1.2...)
const ElementLabel = ({ label, title }: { label: string; title?: string }) => {
    if (!label) return null;
    return (
        <div style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: '8px',
            textAlign: 'left',
            borderLeft: '3px solid #3b82f6',
            paddingLeft: '8px',
            width: '100%',
            wordBreak: 'break-word'
        }}>
            {label}{title ? `: ${title}` : ''}
        </div>
    );
};

const DataEditorPopover = ({ settings, data, keys, colors, updateSettings }: any) => {
    const isPie = settings.chartType === 'circular';
    const isComposed = settings.chartType === 'composed';
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

        const newSeriesTypes = { ...(settings.seriesTypes || {}) };
        if (newSeriesTypes[oldKey]) {
            newSeriesTypes[newName] = newSeriesTypes[oldKey];
            delete newSeriesTypes[oldKey];
        }

        updateSettings({ activeColorKey: newName, seriesTypes: newSeriesTypes }, { keys: newKeys, data: newData, colors: newColors });
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

        let newSettingsParams = {};
        if (isComposed) {
            newSettingsParams = { seriesTypes: { ...(settings.seriesTypes || {}), [newKey]: 'line' } };
        }

        updateSettings(newSettingsParams, { keys: newKeys, data: newData });
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
        const newSeriesTypes = { ...(settings.seriesTypes || {}) };
        delete newSeriesTypes[key];

        updateSettings({ seriesTypes: newSeriesTypes }, {
            keys: keys.filter((k: string) => k !== key),
            data: data.map((r: any) => { const n = {...r}; delete n[key]; return n; })
        });
    };

    return (
        <div
            className="data-editor-popover"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="data-table-wrap custom-scrollbar">
                <table className="data-table">
                    <tbody>
                    <tr>
                        <td className="bg-light"></td>
                        {displayKeys.map((k: string, i: number) => (
                            <td key={`color-${i}`} className="group" style={{ padding: 0, position: 'relative' }}>
                                <div
                                    style={{ height: '32px', width: '100%', cursor: 'pointer', backgroundColor: !isPie ? (colors[k] || CHART_PALETTE[i % CHART_PALETTE.length]) : '#f8fafc' }}
                                    onClick={() => !isPie && updateSettings({ activeColorKey: k })}
                                >
                                    {!isPie && settings.activeColorKey === k && <div style={{position:'absolute', inset:0, border:'3px solid #2563eb', boxShadow:'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'}} />}
                                </div>
                                <button
                                    onClick={() => removeColumn(k)}
                                    className={keys.length <= 1 ? 'hidden' : ''}
                                    style={{position: 'absolute', top: '-8px', right: '-8px', background: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', color: '#ef4444', zIndex: 50, cursor: 'pointer'}}
                                    title="Обриши колону"
                                >
                                    <Trash2 size={12}/>
                                </button>
                            </td>
                        ))}
                        {!isPie && (
                            <td className="bg-light" style={{ cursor: 'pointer', textAlign: 'center' }} onClick={addColumn}>
                                <div style={{ height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8'}}><Plus size={16} /></div>
                            </td>
                        )}
                    </tr>
                    <tr>
                        <td className="bg-light" style={{ width: '120px', fontWeight: 500, verticalAlign: 'top', paddingTop: '8px' }}>
                            <input
                                value={settings.xAxisLabel || 'Месец'}
                                onChange={e => updateSettings({ xAxisLabel: e.target.value })}
                                className="data-input"
                                placeholder="Ознака"
                            />
                        </td>
                        {displayKeys.map((k: string, i: number) => {
                            const isAreaBar = settings.subChartType === 'composed_area_bar';
                            const isAreaLine = settings.subChartType === 'composed_area_line';
                            const isStackedLine = settings.subChartType === 'composed_stacked_line';

                            let currentType = settings.seriesTypes?.[k];
                            if (!currentType) {
                                if (i === 0) currentType = isAreaLine || isAreaBar ? 'area' : 'bar';
                                else if (i === 1) currentType = isAreaBar ? 'area' : (isStackedLine ? 'bar' : 'line');
                                else currentType = 'line';
                            }

                            return (
                                <td key={`head-${i}`} style={{ minWidth: '80px', verticalAlign: 'top', padding: '4px' }}>
                                    <input value={k} onChange={e => handleKeyChange(i, e.target.value)} className="data-input" style={{ width: '100%' }} />

                                    {isComposed && (
                                        <select
                                            value={currentType}
                                            onChange={e => {
                                                const newTypes = { ...(settings.seriesTypes || {}) };
                                                newTypes[k] = e.target.value;
                                                updateSettings({ seriesTypes: newTypes });
                                            }}
                                            style={{ width: '100%', fontSize: '11px', padding: '2px', marginTop: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', outline: 'none', background: '#f8fafc', color: '#475569', cursor: 'pointer' }}
                                        >
                                            <option value="bar">Stubić</option>
                                            <option value="line">Linija</option>
                                            <option value="area">Površina</option>
                                        </select>
                                    )}
                                </td>
                            );
                        })}
                        {!isPie && <td className="bg-light"></td>}
                    </tr>
                    {data.map((row: any, rIdx: number) => (
                        <tr key={rIdx}>
                            <td style={{ padding: 0 }} onClick={() => isPie && updateSettings({ activeColorKey: row.name })}>
                                {isPie && (
                                    <div
                                        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '12px', cursor: 'pointer', backgroundColor: colors[row.name] || CHART_PALETTE[rIdx % CHART_PALETTE.length] }}
                                    >
                                        {settings.activeColorKey === row.name && <div style={{position:'absolute', inset:0, border:'2px solid #2563eb'}} />}
                                    </div>
                                )}
                                <input value={row.name} onChange={e => handleNameChange(rIdx, e.target.value)} className="data-input data-input-left" style={{ paddingLeft: isPie ? '20px' : '8px' }} />
                            </td>
                            {displayKeys.map((k: string) => (
                                <td key={`cell-${rIdx}-${k}`}>
                                    <input type="text" value={row[k] !== undefined ? row[k] : ''} onChange={e => handleValChange(rIdx, k, e.target.value)} className="data-input" />
                                </td>
                            ))}
                            <td style={{ textAlign: 'center' }}>
                                <button onClick={() => removeRow(rIdx)} className="action-btn" style={{ border: 'none', boxShadow: 'none', margin: '0 auto', opacity: data.length <= 1 ? 0.3 : 1 }} disabled={data.length <= 1}><Trash2 size={14} /></button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                <button onClick={addRow} className="add-row-btn-small">
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
    const baseColor = currentSettings.baseColor || '#3b82f6';
    const width = currentSettings.width || 100;

    const values = data.map((d: any) => parseFloat(d['Вредност'])).filter((v: number) => !isNaN(v));
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;

    const calculatedColors: any = {};
    data.forEach((d: any) => {
        const val = parseFloat(d['Вредност']);
        if (isNaN(val) || d['Вредност'] === '' || d['Вредност'] === undefined) {
            calculatedColors[d.name] = '#f1f5f9';
        } else {
            let opacity = 0.2;
            if (max > min) {
                opacity = 0.2 + 0.8 * ((val - min) / (max - min));
            } else if (max === min && values.length > 0) {
                opacity = 1;
            }
            calculatedColors[d.name] = hexToRgba(baseColor, opacity);
        }
    });

    const activeDistrictsForLegend = data.filter((d: any) => d['Вредност'] && String(d['Вредност']).trim() !== '0' && String(d['Вредност']).trim() !== '');

    return (
        <div
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)}
            onClick={(e) => {
                e.stopPropagation();
                setSelectedElement({
                    pageId,
                    rowId,
                    colId,
                    elementId: el.id,
                    type: 'map',
                    settings: currentSettings,
                    extraPayload: { data: el.payload.data }
                });
            }}
            className={`element-block element-block-map break-inside-avoid ${isSelected ? 'is-selected' : ''}`}
            style={{ marginTop: `${currentSettings.marginTop || 0}px`, marginBottom: `${currentSettings.marginBottom || 0}px` }}
        >
            {isSelected && (
                <div className="element-actions">
                    <div className="action-btn grab"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="action-btn danger"><Trash2 size={14} /></button>
                </div>
            )}

            <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{ width: `${width}%`, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'width 0.2s' }}>
                    <MapGraphic colors={calculatedColors} />
                </div>

                {currentSettings.showLegend && activeDistrictsForLegend.length > 0 && (
                    <div style={{ position: 'absolute', bottom: '16px', left: '16px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255,255,255,0.9)', padding: '8px', borderRadius: '4px', border: '1px solid #f1f5f9', zIndex: 10 }}>
                        {activeDistrictsForLegend.map((row: any, i: number) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: calculatedColors[row.name] || '#e2e8f0' }} />
                                <span style={{ fontSize: '10px', color: '#475569', fontWeight: 500 }}>{row.name} ({row['Вредност']})</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const ChartElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart, elementLabel }: any) => {
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

    const dynamicOuterRadius = Math.max(35, Math.min((chartWidth - 70) / 2, (baseChartHeight - 60) / 2)) * 0.85;
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
        if (!data.length || !keys.length) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#94a3b8', fontSize:'14px'}}>Učitavanje podataka...</div>;

        const axisTickStyle = { fontSize: 12, fill: '#64748b' };
        const axisLineStyle = { stroke: '#cbd5e1' };
        const tooltipStyle = { borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', padding: '10px 14px' };

        const chartMargin = currentSettings.chartType === 'circular' ? { top: 0, right: 0, left: 0, bottom: 0 } : { top: 25, right: 15, left: -20, bottom: 5 };

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
                            {currentSettings.showLegend && <Legend align="left" wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}
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
                            {currentSettings.showLegend && <Legend align="left" wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}
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
                                {currentSettings.showLegend && <Legend align="left" wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}
                            </RadialBarChart>
                        </ResponsiveContainer>
                    );
                }

                const pieData = data.map((d: any) => ({ name: d.name, value: Number(d[keys[0]]) || 0 }));

                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <PieChart margin={chartMargin}>
                            <Tooltip contentStyle={tooltipStyle} />
                            {currentSettings.showLegend && <Legend align="left" wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}
                            <Pie
                                data={pieData} dataKey="value" nameKey="name"
                                cx="50%" cy={isSemicircle ? "75%" : "45%"}
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
                            {currentSettings.showLegend && <Legend align="left" wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}

                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];

                                let typeToRender = currentSettings.seriesTypes?.[key];
                                if (!typeToRender) {
                                    if (idx === 0) typeToRender = isAreaLine || isAreaBar ? 'area' : 'bar';
                                    else if (idx === 1) typeToRender = isAreaBar ? 'area' : (isStackedLine ? 'bar' : 'line');
                                    else typeToRender = 'line';
                                }

                                if (typeToRender === 'area') {
                                    return <Area key={key} type="monotone" dataKey={key} fill={baseColor} stroke={baseColor} fillOpacity={0.3} isAnimationActive={false} label={currentSettings.showLabels ? { position: 'top', fill: '#64748b', fontSize: 11, dy: -10 } : false} />;
                                }
                                if (typeToRender === 'bar') {
                                    return <Bar key={key} dataKey={key} stackId={isStackedLine ? "a" : undefined} barSize={isAreaBar ? 15 : 20} fill={baseColor} radius={[4, 4, 0, 0]} isAnimationActive={false} label={currentSettings.showLabels ? { position: isStackedLine ? 'insideTop' : 'top', fill: isStackedLine ? '#fff' : '#64748b', fontSize: 11 } : false} />;
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
                            {currentSettings.showLegend && <Legend align="left" wrapperStyle={{ fontSize: '12px', paddingTop: '5px' }} iconType="circle" formatter={renderLegendText} />}

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
                            {currentSettings.showLegend && <Legend align="left" wrapperStyle={{ fontSize: '12px' }} iconType="circle" formatter={renderLegendText} />}
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
                setSelectedElement({
                    pageId,
                    rowId,
                    colId,
                    elementId: el.id,
                    type: 'chart',
                    settings: currentSettings,
                    extraPayload: {
                        data: el.payload.data,
                        keys: el.payload.keys,
                        colors: el.payload.colors,
                        subChartType: el.payload.subChartType
                    }
                });
            }}
            className={`element-block element-block-chart break-inside-avoid ${isSelected ? 'is-selected' : ''}`}
            style={{ height: `${dynamicHeight}px`, marginTop: `${currentSettings.marginTop || 0}px`, marginBottom: `${currentSettings.marginBottom || 0}px` }}
        >
            {isSelected && (
                <div className="element-actions">
                    <div className="action-btn grab"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="action-btn danger"><Trash2 size={14} /></button>
                </div>
            )}

            <ElementLabel label={elementLabel} title={currentSettings.title} />

            <div ref={wrapperRef} style={{ width: '100%', height: '100%', flex: 1, pointerEvents: 'none', minWidth: 0, overflow: 'hidden' }}>
                {renderChart()}
            </div>

            {isSelected && currentSettings.showDataEditor && (
                <DataEditorPopover settings={currentSettings} data={data} keys={keys} colors={colors} updateSettings={updateLocalSettings} />
            )}
        </div>
    );
};

const ImageElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart, elementLabel }: any) => {
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
            className={`element-block break-inside-avoid ${isSelected ? 'is-selected' : ''}`}
            style={{ marginTop: `${currentSettings.marginTop || 0}px`, marginBottom: `${currentSettings.marginBottom || 0}px` }}
        >
            {isSelected && (
                <div className="element-actions">
                    <div className="action-btn grab"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="action-btn danger"><Trash2 size={14} /></button>
                </div>
            )}

            <ElementLabel label={elementLabel} title={currentSettings.altText} />

            {currentSettings.url ? (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: currentSettings.alignment === 'left' ? 'flex-start' : currentSettings.alignment === 'right' ? 'flex-end' : 'center', textAlign: currentSettings.alignment === 'left' ? 'left' : currentSettings.alignment === 'right' ? 'right' : 'center' }}>
                    <img
                        src={currentSettings.url}
                        alt={currentSettings.altText}
                        style={{ width: `${currentSettings.width || 100}%`, height: 'auto', borderRadius: '0', transition: 'all 0.2s' }}
                    />
                </div>
            ) : (
                <div style={{ padding: '2rem', width: '100%', minHeight: '180px', backgroundColor: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {isUploading ? (
                        <span style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', fontSize: '14px', fontWeight: 600, color: '#3b82f6' }}>Отпремање...</span>
                    ) : (
                        <label style={{ cursor: 'pointer', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <UploadCloud size={32} />
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>Одабери слику</span>
                            <input type="file" style={{ display: 'none' }} onChange={handleImageUpload} />
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

    const overflowTimeoutRef = useRef<any>(null);
    const isSplitting = useRef(false);
    const savedRangeRef = useRef<Range | null>(null);

    const saveSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (editorRef.current?.contains(range.commonAncestorContainer)) {
                savedRangeRef.current = range.cloneRange();
            }
        }
    };

    useEffect(() => {
        contentAreaRef.current = document.getElementById(`page-content-${pageId}`);
    }, [pageId]);

    useEffect(() => {
        if (editorRef.current && currentSettings.content !== undefined) {
            if (editorRef.current.innerHTML !== currentSettings.content) {
                editorRef.current.innerHTML = currentSettings.content;
            }
            if (overflowTimeoutRef.current) clearTimeout(overflowTimeoutRef.current);
            overflowTimeoutRef.current = setTimeout(() => {
                checkOverflow(currentSettings.content);
            }, 100);
        }
    }, [currentSettings.content]);

    useEffect(() => {
        const handleInsertFn = (e: any) => {
            if (e.detail?.elementId === el.id && isSelected) {
                if (editorRef.current) {
                    editorRef.current.focus();

                    const selection = window.getSelection();
                    if (savedRangeRef.current && selection) {
                        selection.removeAllRanges();
                        selection.addRange(savedRangeRef.current);
                        handleAddFootnote();
                    } else {
                        const range = document.createRange();
                        range.selectNodeContents(editorRef.current);
                        range.collapse(false);
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                        handleAddFootnote();
                    }
                }
            }
        };
        window.addEventListener('insert-footnote', handleInsertFn);
        return () => window.removeEventListener('insert-footnote', handleInsertFn);
    }, [isSelected, el.id, currentSettings.footnotes]);

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

    const checkOverflow = (htmlToCheck: string) => {
        if (isSplitting.current) return;
        const contentArea = contentAreaRef.current;
        if (!contentArea || !editorRef.current) return;

        const areaRect = contentArea.getBoundingClientRect();

        if (editorRef.current.getBoundingClientRect().bottom > areaRect.bottom + 5) {
            isSplitting.current = true;

            let words = htmlToCheck.split(/(<[^>]*>|\s+)/).filter(Boolean);

            let low = 0;
            let high = words.length;
            let bestFitIndex = 0;

            while (low <= high) {
                let mid = Math.floor((low + high) / 2);
                editorRef.current.innerHTML = words.slice(0, mid).join('');

                if (editorRef.current.getBoundingClientRect().bottom > areaRect.bottom) {
                    high = mid - 1;
                } else {
                    bestFitIndex = mid;
                    low = mid + 1;
                }
            }

            editorRef.current.innerHTML = words.slice(0, bestFitIndex).join('');

            while (editorRef.current.getBoundingClientRect().bottom > areaRect.bottom && bestFitIndex > 0) {
                bestFitIndex--;
                editorRef.current.innerHTML = words.slice(0, bestFitIndex).join('');
            }

            const safeHtml = words.slice(0, bestFitIndex).join('');
            const remainingText = words.slice(bestFitIndex).join('');

            if (remainingText.trim() !== '') {
                const oldFootnotes = currentSettings.footnotes || {};

                const safeIds = extractFootnoteIds(safeHtml);
                const remIds = extractFootnoteIds(remainingText);

                const safeFns: any = {};
                const remFns: any = {};

                safeIds.forEach(id => safeFns[id] = oldFootnotes[id] || '');
                remIds.forEach(id => remFns[id] = oldFootnotes[id] || '');

                onAutoSplit({
                    sourcePageId: pageId,
                    elementId: el.id,
                    remainingContent: remainingText,
                    safeHtml: safeHtml,
                    safeFootnotes: safeFns,
                    remainingFootnotes: remFns
                });
            }

            setTimeout(() => { isSplitting.current = false; }, 150);
        }
    };

    const handleAddFootnote = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const id = `fn-${Math.random().toString(36).substr(2, 9)}`;

        const sup = document.createElement('sup');
        sup.setAttribute('data-footnote-id', id);
        sup.setAttribute('contenteditable', 'false');
        sup.style.color = '#3b82f6';
        sup.style.cursor = 'pointer';
        sup.style.fontWeight = 'bold';
        sup.style.padding = '0 1px';
        sup.style.userSelect = 'none';
        sup.style.display = 'inline';
        sup.innerHTML = '[*]';

        range.deleteContents();
        range.insertNode(sup);

        range.setStartAfter(sup);
        range.setEndAfter(sup);
        selection.removeAllRanges();
        selection.addRange(range);

        if (editorRef.current) {
            const newHtml = editorRef.current.innerHTML;
            const currentIds = extractFootnoteIds(newHtml);
            const oldFootnotes = currentSettings.footnotes || {};
            const newFootnotes: any = {};
            currentIds.forEach(cid => { newFootnotes[cid] = oldFootnotes[cid] || ''; });
            newFootnotes[id] = 'Унесите текст фусноте...';

            updateElementSettings({ content: newHtml, footnotes: newFootnotes });
            editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    const handleInput = (e: FormEvent<HTMLDivElement>) => {
        const html = e.currentTarget.innerHTML;
        const currentIds = extractFootnoteIds(html);
        const oldFootnotes = currentSettings.footnotes || {};
        const newFootnotes: any = {};

        currentIds.forEach(id => {
            newFootnotes[id] = oldFootnotes[id] !== undefined ? oldFootnotes[id] : '';
        });

        if (isSelected) {
            updateElementSettings({ content: html, footnotes: newFootnotes });
        }

        if (overflowTimeoutRef.current) clearTimeout(overflowTimeoutRef.current);
        overflowTimeoutRef.current = setTimeout(() => {
            checkOverflow(html);
        }, 50);
    };

    return (
        <div
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)}
            onClick={(e) => {
                e.stopPropagation();
                setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'text', settings: { ...currentSettings, content: editorRef.current?.innerHTML || currentSettings.content } });
            }}
            className={`element-block cursor-text ${isSelected ? 'is-selected' : ''}`}
            style={{
                marginTop: `${currentSettings.marginTop || 0}px`,
                marginBottom: `${currentSettings.marginBottom || 0}px`,
                backgroundColor: currentSettings.backgroundColor || 'transparent',
                padding: currentSettings.backgroundColor ? '16px' : '0px',
                borderRadius: currentSettings.backgroundColor ? '8px' : '0px'
            }}
        >
            {isSelected && (
                <div className="element-actions">
                    <div className="action-btn grab"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="action-btn danger"><Trash2 size={14} /></button>
                </div>
            )}

            <div
                id={`editor-${el.id}`}
                ref={editorRef} contentEditable suppressContentEditableWarning data-placeholder="Унесите текст..."
                onInput={handleInput}
                onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain');
                    document.execCommand('insertText', false, text);
                }}
                onBlur={saveSelection}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                className="editor-content"
                style={{ color: currentSettings.color, textAlign: currentSettings.alignment }}
            />
        </div>
    );
};

const TableElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart, onAutoSplit, globalFootnoteMap, elementLabel }: any) => {
    const defaultSettings = el.payload.settings;
    const currentSettings = isSelected ? selectedElement.settings : defaultSettings;
    const content = el.payload.sr?.content || {};

    const tableContainerRef = useRef<HTMLDivElement>(null);
    const contentAreaRef = useRef<HTMLElement | null>(null);
    const isSplitting = useRef(false);

    const colsCount = currentSettings.columns || 1;
    const defaultWidths = Array(colsCount).fill(100 / colsCount);
    const [localWidths, setLocalWidths] = useState<number[]>(currentSettings.columnWidths || defaultWidths);
    const startDragRef = useRef<{ startX: number, startWidths: number[], index: number } | null>(null);

    useEffect(() => {
        if (currentSettings.columnWidths && currentSettings.columnWidths.length === colsCount) {
            setLocalWidths(currentSettings.columnWidths);
        } else {
            setLocalWidths(Array(colsCount).fill(100 / colsCount));
        }
    }, [currentSettings.columnWidths, colsCount]);

    const onResizeMouseDown = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        startDragRef.current = {
            startX: e.clientX,
            startWidths: [...localWidths],
            index
        };
        document.addEventListener('mousemove', onResizeMouseMove);
        document.addEventListener('mouseup', onResizeMouseUp);
    };

    const onResizeMouseMove = (e: MouseEvent) => {
        if (!startDragRef.current || !tableContainerRef.current) return;
        const { startX, startWidths, index } = startDragRef.current;
        const tableWidth = tableContainerRef.current.offsetWidth;
        const deltaX = e.clientX - startX;
        const deltaPct = (deltaX / tableWidth) * 100;

        const newWidths = [...startWidths];
        const maxDelta = startWidths[index] - 5;
        const minDelta = -(startWidths[index + 1] - 5);
        const clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaPct));

        newWidths[index] = startWidths[index] + clampedDelta;
        newWidths[index + 1] = startWidths[index + 1] - clampedDelta;

        setLocalWidths(newWidths);
    };

    const onResizeMouseUp = () => {
        if (startDragRef.current) {
            setLocalWidths((currentLocal) => {
                updateElementSettings({ ...currentSettings, columnWidths: currentLocal });
                return currentLocal;
            });
        }
        startDragRef.current = null;
        document.removeEventListener('mousemove', onResizeMouseMove);
        document.removeEventListener('mouseup', onResizeMouseUp);
    };

    const updateCellSetting = (prop: string, value: string) => {
        if (!selectedElement?.activeCell) return;
        const key = selectedElement.activeCell;
        const currentCells = currentSettings.cells || {};
        const cellSt = currentCells[key] || {};

        const newSettings = {
            ...currentSettings,
            cells: {
                ...currentCells,
                [key]: { ...cellSt, [prop]: value }
            }
        };
        updateElementSettings(newSettings);
    };

    useEffect(() => {
        contentAreaRef.current = document.getElementById(`page-content-${pageId}`);
    }, [pageId]);

    const checkTableOverflow = () => {
        if (isSplitting.current) return;
        const contentArea = contentAreaRef.current;
        const tableContainer = tableContainerRef.current;
        if (!contentArea || !tableContainer) return;

        const areaRect = contentArea.getBoundingClientRect();
        const tableRect = tableContainer.getBoundingClientRect();

        if (tableRect.bottom > areaRect.bottom + 5) {
            const trs = tableContainer.querySelectorAll('tbody tr');
            let splitIndex = -1;
            for (let i = 0; i < trs.length; i++) {
                const trRect = trs[i].getBoundingClientRect();
                if (trRect.bottom > areaRect.bottom) {
                    splitIndex = i;
                    break;
                }
            }
            if (splitIndex === 0) splitIndex = 1;
            if (splitIndex > 0 && splitIndex < (currentSettings.rows || 1)) {
                isSplitting.current = true;
                const rowsToKeep = splitIndex;
                const rowsToMove = currentSettings.rows - rowsToKeep;
                const keepContent: any = {};
                const keepCells: any = {};
                const moveContent: any = {};
                const moveCells: any = {};
                const cols = currentSettings.columns || 1;

                for (let r = 0; r < currentSettings.rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const oldKey = `${r}_${c}`;
                        if (r < rowsToKeep) {
                            if (content[oldKey] !== undefined) keepContent[oldKey] = content[oldKey];
                            if (currentSettings.cells?.[oldKey]) keepCells[oldKey] = currentSettings.cells[oldKey];
                        } else {
                            const newR = r - rowsToKeep;
                            const newKey = `${newR}_${c}`;
                            if (content[oldKey] !== undefined) moveContent[newKey] = content[oldKey];
                            if (currentSettings.cells?.[oldKey]) moveCells[newKey] = currentSettings.cells[oldKey];
                        }
                    }
                }
                onAutoSplit({
                    sourcePageId: pageId,
                    elementId: el.id,
                    remainingContent: "TABLE_SPLIT",
                    tableSettings: { ...currentSettings, rows: rowsToMove, cells: moveCells },
                    tableContent: moveContent,
                    originalTableSettings: { ...currentSettings, rows: rowsToKeep, cells: keepCells },
                    originalTableContent: keepContent
                });
                setTimeout(() => { isSplitting.current = false; }, 300);
            }
        }
    };

    useEffect(() => {
        const timer = setTimeout(checkTableOverflow, 200);
        return () => clearTimeout(timer);
    }, [currentSettings.rows, currentSettings.columns, content]);

    const handleCellChange = (rIdx: number, cIdx: number, html: string, newFnId?: string) => {
        const cellKey = `${rIdx}_${cIdx}`;
        const newContent = { ...content, [cellKey]: html };

        let newSettings = { ...currentSettings };
        if (newFnId) {
            newSettings.footnotes = { ...(newSettings.footnotes || {}), [newFnId]: 'Унесите текст фусноте...' };
        }

        const allHtml = Object.values(newContent).join(' ');
        const currentIds = extractFootnoteIds(allHtml);
        const finalFootnotes: any = {};
        const oldFootnotes = newSettings.footnotes || {};
        currentIds.forEach(id => {
            finalFootnotes[id] = oldFootnotes[id] !== undefined ? oldFootnotes[id] : '';
        });

        newSettings.footnotes = finalFootnotes;

        updateElementSettings(newSettings, { sr: { content: newContent } });
    };

    return (
        <div
            ref={tableContainerRef}
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)}
            className={`element-block break-inside-avoid ${isSelected ? 'is-selected' : ''}`}
            onClick={(e) => { e.stopPropagation(); setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'table', subType: 'table', settings: currentSettings }); }}
            style={{ marginTop: `${currentSettings.marginTop || 0}px`, marginBottom: `${currentSettings.marginBottom || 0}px` }}
        >
            {isSelected && (
                <div className="element-actions">
                    <div className="action-btn grab"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="action-btn danger"><Trash2 size={14} /></button>
                </div>
            )}

            {isSelected && selectedElement?.activeCell && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-lg shadow-xl p-1 flex gap-1 z-[70] items-center" style={{ width: 'max-content' }}>
                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('alignment', 'left'); }} className={`p-1.5 rounded hover:bg-slate-100 ${currentSettings.cells?.[selectedElement.activeCell]?.alignment === 'left' || !currentSettings.cells?.[selectedElement.activeCell]?.alignment ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Poravnaj levo"><AlignLeft size={16}/></button>
                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('alignment', 'center'); }} className={`p-1.5 rounded hover:bg-slate-100 ${currentSettings.cells?.[selectedElement.activeCell]?.alignment === 'center' ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Centriraj horizontalno"><AlignCenter size={16}/></button>
                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('alignment', 'right'); }} className={`p-1.5 rounded hover:bg-slate-100 ${currentSettings.cells?.[selectedElement.activeCell]?.alignment === 'right' ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Poravnaj desno"><AlignRight size={16}/></button>

                    <div className="w-px h-5 bg-slate-200 mx-1" />

                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('verticalAlignment', 'top'); }} className={`p-1.5 px-2 rounded hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider ${currentSettings.cells?.[selectedElement.activeCell]?.verticalAlignment === 'top' || !currentSettings.cells?.[selectedElement.activeCell]?.verticalAlignment ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Poravnaj gore">Gore</button>
                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('verticalAlignment', 'middle'); }} className={`p-1.5 px-2 rounded hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider ${currentSettings.cells?.[selectedElement.activeCell]?.verticalAlignment === 'middle' ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Centriraj vertikalno">Sredina</button>
                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('verticalAlignment', 'bottom'); }} className={`p-1.5 px-2 rounded hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider ${currentSettings.cells?.[selectedElement.activeCell]?.verticalAlignment === 'bottom' ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Poravnaj dole">Dole</button>
                </div>
            )}

            <ElementLabel label={elementLabel} title={currentSettings.title} />

            <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', borderRadius: '0', position: 'relative' }}>
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: '1px solid #cbd5e1', background: 'white', borderRadius: '0', position: 'relative', zIndex: 0 }}>
                    <colgroup>
                        {localWidths.map((w, i) => (
                            <col key={i} style={{ width: `${w}%` }} />
                        ))}
                    </colgroup>
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
                                        elId={el.id}
                                        value={content[key] || ''}
                                        cellSt={cellSt}
                                        isActive={selectedElement?.activeCell === key}
                                        globalFootnoteMap={globalFootnoteMap}
                                        style={{
                                            backgroundColor: cellSt.backgroundColor || '#ffffff',
                                            textAlign: cellSt.alignment || 'left',
                                            verticalAlign: cellSt.verticalAlignment || 'top',
                                            color: cellSt.textColor || '#1E293B'
                                        }}
                                        colSpan={cellSt.colSpan || 1}
                                        rowSpan={cellSt.rowSpan || 1}
                                        onClick={(e: any) => { e.stopPropagation(); setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'table', subType: 'cell', activeCell: key, settings: currentSettings }); }}
                                        onBlur={(html: string, fnId?: string) => handleCellChange(rIdx, cIdx, html, fnId)}
                                    />
                                );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>

                {isSelected && localWidths.map((w, i) => {
                    if (i === localWidths.length - 1) return null;
                    const leftPct = localWidths.slice(0, i + 1).reduce((a, b) => a + b, 0);
                    return (
                        <div
                            key={`resizer-${i}`}
                            onMouseDown={(e) => onResizeMouseDown(e, i)}
                            style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: `calc(${leftPct}% - 3px)`,
                                width: '6px',
                                cursor: 'col-resize',
                                zIndex: 20,
                                backgroundColor: startDragRef.current?.index === i ? '#3b82f6' : 'transparent',
                            }}
                            className="hover:bg-blue-400 transition-colors"
                            title="Povuci za promenu širine"
                        />
                    );
                })}
            </div>
        </div>
    );
};

const EditableCell = ({ value, onBlur, style, isActive, onClick, cellSt, colSpan, rowSpan, elId, globalFootnoteMap }: any) => {
    const cellRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);

    const saveSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (cellRef.current?.contains(range.commonAncestorContainer)) {
                savedRangeRef.current = range.cloneRange();
            }
        }
    };

    useEffect(() => {
        const handleInsertFn = (e: any) => {
            if (e.detail?.elementId === elId && isActive) {
                if (cellRef.current) {
                    cellRef.current.focus();

                    const selection = window.getSelection();
                    if (savedRangeRef.current && selection) {
                        selection.removeAllRanges();
                        selection.addRange(savedRangeRef.current);
                    } else {
                        const range = document.createRange();
                        range.selectNodeContents(cellRef.current);
                        range.collapse(false);
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                    }

                    const id = `fn-${Math.random().toString(36).substr(2, 9)}`;
                    const sup = document.createElement('sup');
                    sup.setAttribute('data-footnote-id', id);
                    sup.setAttribute('contenteditable', 'false');
                    sup.style.color = '#3b82f6';
                    sup.style.cursor = 'pointer';
                    sup.style.fontWeight = 'bold';
                    sup.style.padding = '0 1px';
                    sup.style.userSelect = 'none';
                    sup.style.display = 'inline';
                    sup.innerHTML = '[*]';

                    const range2 = window.getSelection()?.getRangeAt(0);
                    if (range2) {
                        range2.deleteContents();
                        range2.insertNode(sup);
                        range2.setStartAfter(sup);
                        range2.setEndAfter(sup);
                        const sel = window.getSelection();
                        sel?.removeAllRanges();
                        sel?.addRange(range2);
                    }

                    const newHtml = cellRef.current.innerHTML;
                    onBlur(newHtml, id);
                }
            }
        };
        window.addEventListener('insert-footnote', handleInsertFn);
        return () => window.removeEventListener('insert-footnote', handleInsertFn);
    }, [isActive, elId, onBlur]);

    useEffect(() => {
        if (cellRef.current && value !== cellRef.current.innerHTML) {
            cellRef.current.innerHTML = value || '';
        }
    }, [value]);

    useEffect(() => {
        if (!cellRef.current) return;
        const sups = cellRef.current.querySelectorAll('sup[data-footnote-id]');
        sups.forEach(sup => {
            const id = sup.getAttribute('data-footnote-id');
            if (id && globalFootnoteMap && globalFootnoteMap[id]) {
                const numStr = `[${globalFootnoteMap[id]}]`;
                if (sup.innerHTML !== numStr) {
                    sup.innerHTML = numStr;
                }
            }
        });
    }, [value, globalFootnoteMap]);

    return (
        <td
            onClick={onClick}
            style={{ ...style, border: '1px solid #e2e8f0', padding: '0.5rem', transition: 'all 0.2s', position: 'relative', boxShadow: isActive ? 'inset 0 0 0 2px #60a5fa' : 'none', backgroundColor: isActive ? 'rgba(239, 246, 255, 0.3)' : style.backgroundColor }}
            colSpan={colSpan}
            rowSpan={rowSpan}
        >
            <div
                ref={cellRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => onBlur(e.currentTarget.innerHTML)}
                onBlur={saveSelection}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                className="outline-none text-sm break-words"
                style={{ fontWeight: cellSt.type === 'headline' ? 'bold' : 'normal', fontSize: cellSt.type === 'headline' ? '15px' : '14px', outline: 'none', wordBreak: 'break-word', display: 'inline-block', minHeight: '24px', width: '100%' }}
            />
        </td>
    );
};

const LayoutSelector = ({ onSelect, position = "bottom" }: any) => {
    return (
        <div
            onClick={(e) => e.stopPropagation()}
            className={`popover-menu ${position}`}
        >
            <button onClick={() => onSelect('1/1')} className="menu-btn blue">
                <LayoutTemplate size={18} /><span>Пуна ширина</span>
            </button>
            <div className="divider"></div>
            <div className="menu-title">Две колоне</div>
            <div className="layout-grid">
                {['1:1', '1:2', '2:1', '1:3', '3:1'].map(l => (
                    <button key={l} onClick={() => onSelect(l)} className="layout-btn">{l}</button>
                ))}
            </div>
            <div className="divider"></div>
            <div className="menu-title">Три колоне</div>
            <div className="layout-grid">
                {['1:1:1', '2:1:1', '1:1:2', '1:2:1'].map(l => (
                    <button key={l} onClick={() => onSelect(l)} className="layout-btn">{l}</button>
                ))}
            </div>
        </div>
    );
};

const ElementSelector = ({ onSelect }: any) => (
    <div
        onClick={(e) => e.stopPropagation()}
        className="popover-menu bottom" style={{ width: '12rem' }}
    >
        <button onClick={() => onSelect('text')} className="menu-btn"><Type size={18} color="#3b82f6" /> ТЕКСТ</button>
        <button onClick={() => onSelect('image')} className="menu-btn"><ImageIcon size={18} color="#22c55e" /> СЛИКА</button>
        <button onClick={() => onSelect('table')} className="menu-btn"><Table2 size={18} color="#f97316" /> ТАБЕЛА</button>
        <div className="divider" style={{ margin: '0.25rem 0' }}></div>
        <button onClick={() => onSelect('chart')} className="menu-btn"><BarChart3 size={18} color="#a855f7" /> ГРАФИКОН</button>
        <button onClick={() => onSelect('map')} className="menu-btn"><MapIcon size={18} color="#14b8a6" /> МАПА</button>
    </div>
);

const PageItem = ({ page, pageIndex, totalPages, onDeletePage, setPages, selectedElement, setSelectedElement, updateElementSettings, handleAutoSplit, onDragStart, onDrop, handleDeleteElement, handleDeleteRow, getGridCols, handleAddElement, activeRowMenu, setActiveRowMenu, activeColMenu, setActiveColMenu, globalFootnoteMap, elementLabelMap }: any) => {
    const [showAddBtn, setShowAddBtn] = useState(true);
    const innerContentRef = useRef<HTMLDivElement>(null);

    const pageFootnotes = useMemo(() => {
        const fns: any[] = [];
        page.rows.forEach((row: any) => {
            row.columns.forEach((col: any) => {
                col.elements.forEach((el: any) => {
                    if (el.type === 'text' && el.payload.settings.content) {
                        const content = el.payload.settings.content;
                        const footnotesDict = el.payload.settings.footnotes || {};
                        const ids = extractFootnoteIds(content);
                        ids.forEach(id => { fns.push({ id, number: globalFootnoteMap[id], text: footnotesDict[id] || '' }); });
                    } else if (el.type === 'table') {
                        const contentObj = el.payload.sr?.content || {};
                        const footnotesDict = el.payload.settings.footnotes || {};
                        const sortedKeys = Object.keys(contentObj).sort((a, b) => {
                            const [rA, cA] = a.split('_').map(Number);
                            const [rB, cB] = b.split('_').map(Number);
                            return rA !== rB ? rA - rB : cA - cB;
                        });
                        sortedKeys.forEach(key => {
                            const html = contentObj[key];
                            if (typeof html === 'string') {
                                const ids = extractFootnoteIds(html);
                                ids.forEach(id => { fns.push({ id, number: globalFootnoteMap[id], text: footnotesDict[id] || '' }); });
                            }
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

    const lastRowEmpty = page.rows.length > 0 && page.rows[page.rows.length - 1].columns.length === 0;

    return (
        <div className="canvas-page">
            {totalPages > 1 && (
                <button onClick={() => onDeletePage(page.id)} className="page-delete-btn" title="Obriši stranicu"><X size={20} /></button>
            )}
            <div className="page-header"><div className="page-header-inner">Annual Report 2026</div></div>
            <div id={`page-content-${page.id}`} className="page-content">
                <div ref={innerContentRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', flexShrink: 0, position: 'relative', zIndex: 20 }}>
                    {page.rows.map((row: any) => {
                        const isRowActive = (activeRowMenu?.pageId === page.id && activeRowMenu?.rowId === row.id) || (activeColMenu?.pageId === page.id && row.columns.some((c: any) => c.id === activeColMenu.colId)) || (selectedElement?.pageId === page.id && selectedElement?.rowId === row.id);
                        return (
                            <div key={row.id} className={`canvas-row break-inside-avoid ${isRowActive ? 'is-active' : ''}`}>
                                {row.columns.length > 0 && (
                                    <div className="row-actions-menu">
                                        <button onClick={(e) => { e.stopPropagation(); setActiveRowMenu(activeRowMenu?.rowId === row.id ? null : { pageId: page.id, rowId: row.id }); }} className="action-btn"><Settings2 size={16} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRow(page.id, row.id); }} className="action-btn danger"><Trash2 size={16} /></button>
                                        {activeRowMenu?.rowId === row.id && <LayoutSelector onSelect={(l: string) => { const newCols = getGridCols(l); setPages((prev: any) => prev.map((p: any) => p.id === page.id ? { ...p, rows: p.rows.map((r: any) => r.id === row.id ? { ...r, columns: newCols.map((nc: ColumnData, i: number) => ({ ...nc, elements: r.columns[i]?.elements || [] })) } : r) } : p)); setActiveRowMenu(null); }} position="right" />}
                                    </div>
                                )}
                                {row.columns.length === 0 ? (
                                    <div className="empty-row-container">
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRow(page.id, row.id); }} className="empty-row-delete" title="Обриши празан ред"><Trash2 size={16} /></button>
                                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <button onClick={(e) => { e.stopPropagation(); setActiveRowMenu({ pageId: page.id, rowId: row.id }); }} className="add-icon-btn"><img src={addIcon} alt="Add" style={{ width: '48px', height: '48px' }} /></button>
                                            {activeRowMenu?.rowId === row.id && (
                                                <LayoutSelector
                                                    onSelect={(l: string) => {
                                                        setPages((prev: any) => prev.map((p: any) => {
                                                            if (p.id !== page.id) return p;
                                                            return {
                                                                ...p,
                                                                rows: p.rows.map((r: any) => r.id === row.id ? { ...r, columns: getGridCols(l) } : r)
                                                            };
                                                        }));
                                                        setActiveRowMenu(null);
                                                    }}
                                                    position="bottom"
                                                />
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-12 gap-0" style={{ position: 'relative', zIndex: 0 }}>
                                        {row.columns.map((col: any) => {
                                            const isColActive = (activeColMenu?.pageId === page.id && activeColMenu?.colId === col.id) || (selectedElement?.pageId === page.id && selectedElement?.colId === col.id);
                                            return (
                                                <div key={col.id} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(page.id, row.id, col.id)} className={`canvas-col ${col.widthClass} ${isColActive ? 'is-active' : ''}`}>
                                                    {col.elements.map((el: any) => {
                                                        if (el.type === 'text') return <TextElementBlock key={el.id} el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} onAutoSplit={handleAutoSplit} globalFootnoteMap={globalFootnoteMap} />;
                                                        if (el.type === 'image') return <ImageElementBlock key={el.id} el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} elementLabel={elementLabelMap[el.id]} />;
                                                        if (el.type === 'table') return <TableElementBlock key={el.id} el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} onAutoSplit={handleAutoSplit} globalFootnoteMap={globalFootnoteMap} elementLabel={elementLabelMap[el.id]} />;
                                                        if (el.type === 'chart') return <ChartElementBlock key={el.id} el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} elementLabel={elementLabelMap[el.id]} />;
                                                        if (el.type === 'map') return <MapElementBlock key={el.id} el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} />;
                                                        return null;
                                                    })}
                                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                                                        <button onClick={(e) => { e.stopPropagation(); setActiveColMenu({ pageId: page.id, colId: col.id }); }} className="col-add-btn"><Plus size={14} /></button>
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
                {showAddBtn && !lastRowEmpty && (
                    <div style={{ width: '100%', paddingTop: '1rem', paddingBottom: '2rem', flexShrink: 0, position: 'relative', zIndex: 10 }}>
                        <button onClick={() => setPages((prev: any) => prev.map((p: any) => p.id === page.id ? { ...p, rows: [...p.rows, { id: Math.random().toString(36).substr(2, 9), columns: [] }] } : p))} className="add-row-btn-main"><Plus size={18} /> Додај нови ред</button>
                    </div>
                )}
            </div>
            <div className="page-footnotes">
                {pageFootnotes.length > 0 && (
                    <div className="footnotes-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pageFootnotes.map((fn) => (
                            <div key={fn.id} className="footnote-item" style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <span style={{ fontWeight: 700, flexShrink: 0, minWidth: '15px' }}>{fn.number}.</span>
                                <span style={{ wordBreak: 'break-word', flex: 1 }} dangerouslySetInnerHTML={{ __html: fn.text || '...' }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="page-footer"><div className="page-footer-inner">{pageIndex + 1}.</div></div>
        </div>
    );
};

interface CanvasProps { pages: any[]; setPages: (action: any) => void; sectionNum?: number; }

const Canvas: FC<CanvasProps> = ({ pages, setPages, sectionNum = 1 }) => {
    const { setSelectedElement, selectedElement, updateElementSettings } = useEditor();
    const [activeRowMenu, setActiveRowMenu] = useState<{pageId: string, rowId: string} | null>(null);
    const [activeColMenu, setActiveColMenu] = useState<{pageId: string, colId: string} | null>(null);
    const [draggedItem, setDraggedItem] = useState<any>(null);
    const initialPagesRef = useRef<any>(null);

    // KREIRANA LOGIKA ZA KONTINUIRANO BROJANJE KROZ CELU SEKCIJU
    const elementLabelMap = useMemo(() => {
        const map: Record<string, string> = {};

        let tableCount = 1;
        let mediaCount = 1; // Zajednički brojač za slike i grafikone

        pages.forEach((page) => {
            page.rows.forEach((row: any) => {
                row.columns.forEach((col: any) => {
                    col.elements.forEach((el: any) => {
                        if (el.type === 'table') {
                            map[el.id] = `Tabela ${sectionNum}.${tableCount}`;
                            tableCount++;
                        } else if (el.type === 'image' || el.type === 'chart') {
                            map[el.id] = `Slika ${sectionNum}.${mediaCount}`;
                            mediaCount++;
                        }
                    });
                });
            });
        });

        return map;
    }, [pages, sectionNum]);

    const globalFootnoteOrder = useMemo(() => {
        const order: string[] = [];
        pages.forEach(page => {
            page.rows.forEach((row: any) => {
                row.columns.forEach((col: any) => {
                    col.elements.forEach((el: any) => {
                        if (el.type === 'text' && el.payload.settings.content) {
                            order.push(...extractFootnoteIds(el.payload.settings.content));
                        } else if (el.type === 'table') {
                            const contentObj = el.payload.sr?.content || {};
                            const sortedKeys = Object.keys(contentObj).sort((a, b) => {
                                const [rA, cA] = a.split('_').map(Number);
                                const [rB, cB] = b.split('_').map(Number);
                                return rA !== rB ? rA - rB : cA - cB;
                            });
                            sortedKeys.forEach(key => {
                                const html = contentObj[key];
                                if (typeof html === 'string') {
                                    order.push(...extractFootnoteIds(html));
                                }
                            });
                        }
                    });
                });
            });
        });
        return order;
    }, [pages]);

    const globalFootnoteMap = useMemo(() => {
        const map: any = {};
        globalFootnoteOrder.forEach((id, index) => { map[id] = index + 1; });
        return map;
    }, [globalFootnoteOrder]);

    useEffect(() => {
        if (!initialPagesRef.current && pages.length > 0) initialPagesRef.current = JSON.stringify(pages);
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (initialPagesRef.current !== JSON.stringify(pages)) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [pages]);

    useEffect(() => {
        if (selectedElement) {
            setPages((prev: any[]) => prev.map(page => {
                if (page.id !== selectedElement.pageId) return page;
                return { ...page, rows: page.rows.map((row: any) => ({ ...row, columns: row.columns.map((col: any) => ({ ...col, elements: col.elements.map((el: any) => el.id === selectedElement.elementId ? { ...el, payload: { ...el.payload, settings: selectedElement.settings, ...(selectedElement.extraPayload || {}) } } : el) })) })) };
            }));
        }
    }, [selectedElement]);

    const handleAutoSplit = (params: any) => {
        const {
            sourcePageId,
            elementId,
            remainingContent,
            safeHtml,
            tableSettings,
            tableContent,
            originalTableSettings,
            originalTableContent,
            safeFootnotes,
            remainingFootnotes
        } = params;

        if (selectedElement && selectedElement.elementId === elementId) {
            let updatedSettings = { ...selectedElement.settings };
            let updatedExtra: any = selectedElement.extraPayload ? { ...selectedElement.extraPayload } : {};

            if (remainingContent === "TABLE_SPLIT") {
                updatedSettings = { ...updatedSettings, ...originalTableSettings };
                updatedExtra = { sr: { content: originalTableContent } };
            } else {
                updatedSettings = { ...updatedSettings, content: safeHtml, footnotes: safeFootnotes };
            }

            setSelectedElement({
                ...selectedElement,
                settings: updatedSettings,
                extraPayload: updatedExtra
            });
        }

        const newElementId = Math.random().toString(36).substr(2, 9);
        const newRowId = Math.random().toString(36).substr(2, 9);
        const newColId = Math.random().toString(36).substr(2, 9);

        setPages((prev: any[]) => {
            const pageIndex = prev.findIndex(p => p.id === sourcePageId);
            if (pageIndex === -1) return prev;

            let originalSettings: any = {};
            const isTableSplit = remainingContent === "TABLE_SPLIT";

            const updatedPages = prev.map((page, idx) => {
                if (idx !== pageIndex) return page;
                return {
                    ...page,
                    rows: page.rows.map((row: any) => ({
                        ...row,
                        columns: row.columns.map((col: any) => ({
                            ...col,
                            elements: col.elements.map((e: any) => {
                                if (e.id === elementId) {
                                    originalSettings = e.payload.settings;
                                    if (isTableSplit) {
                                        return { ...e, payload: { ...e.payload, settings: originalTableSettings, sr: { content: originalTableContent } } };
                                    }
                                    return { ...e, payload: { ...e.payload, settings: { ...e.payload.settings, content: safeHtml, footnotes: safeFootnotes } } };
                                }
                                return e;
                            })
                        }))
                    }))
                };
            });

            let newElementPayload: any;
            if (isTableSplit) {
                newElementPayload = { settings: tableSettings, sr: { content: tableContent || {} } };
            } else {
                newElementPayload = {
                    settings: {
                        ...originalSettings,
                        content: remainingContent,
                        footnotes: remainingFootnotes
                    }
                };
            }

            const newRow: RowData = {
                id: newRowId,
                columns: [{ id: newColId, widthClass: 'col-span-12', elements: [{ id: newElementId, type: isTableSplit ? 'table' : 'text', payload: newElementPayload }] }]
            };

            const nextPageIndex = pageIndex + 1;
            if (nextPageIndex < updatedPages.length) {
                return updatedPages.map((page, idx) => idx === nextPageIndex ? { ...page, rows: [newRow, ...page.rows] } : page);
            } else {
                return [...updatedPages, { id: `page-${Math.random().toString(36).substr(2, 9)}`, rows: [newRow] }];
            }
        });

        if (remainingContent !== "TABLE_SPLIT") {
            setTimeout(() => {
                const newElNode = document.getElementById(`editor-${newElementId}`);
                if (newElNode) {
                    newElNode.focus();
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(newElNode);
                    range.collapse(true);
                    sel?.removeAllRanges();
                    sel?.addRange(range);
                }
            }, 50);
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
        else if (type === 'table') { payload.settings = { rows: 3, columns: 2, cells: { "0_0": { backgroundColor: "#f3f4f6", type: "headline" }, "0_1": { backgroundColor: "#f3f4f6", type: "headline" } } }; payload.sr = { content: { "0_0": "Prihodi", "0_1": "Rashodi" } }; }
        else if (type === 'chart') { payload.settings = { chartType: 'bar', subChartType: 'grouped_v', showLegend: true, showGrid: true, showLabels: false, showDataEditor: true, xAxisLabel: 'Месец' }; payload.data = [{ name: 'Јануар', 'Prihodi': 400, 'Rashodi': 240 }, { name: 'Фебруар', 'Prihodi': 300, 'Rashodi': 139 }, { name: 'Март', 'Prihodi': 200, 'Rashodi': 980 }]; payload.keys = ['Prihodi', 'Rashodi']; payload.colors = { 'Prihodi': '#8b98ff', 'Rashodi': '#34d399' }; }
        else if (type === 'map') { payload.settings = { showLegend: true, width: 100, baseColor: '#3b82f6' }; payload.keys = ['Вредност']; payload.data = SERBIAN_DISTRICTS.map(d => ({ name: d, 'Вредност': '' })); }

        setPages((prev: any[]) => prev.map(page => page.id === pageId ? { ...page, rows: page.rows.map((row: any) => row.id === rowId ? { ...row, columns: row.columns.map((col: any) => col.id === colId ? { ...col, elements: [...col.elements, { id, type, payload }] } : col) } : row) } : page));
        setActiveColMenu(null);
    };

    const handleDeleteElement = (pageId: string, _rowId: string, _colId: string, elId: string) => { setPages((prev: any[]) => prev.map(page => page.id === pageId ? { ...page, rows: page.rows.map((row: any) => ({ ...row, columns: row.columns.map((col: any) => ({ ...col, elements: col.elements.filter((el: any) => el.id !== elId) })) })) } : page)); setSelectedElement(null); };
    const handleDeleteRow = (pageId: string, rowId: string) => { setPages((prev: any[]) => prev.map(page => page.id !== pageId ? page : { ...page, rows: page.rows.filter((row: any) => row.id !== rowId) })); };
    const handleDeletePage = (pageId: string) => { if (pages.length <= 1) return; setPages((prev: any[]) => prev.filter(page => page.id !== pageId)); setSelectedElement(null); };

    const onDragStart = (e: any, pageId: string, rowId: string, colId: string, elementId: string) => { setDraggedItem({ pageId, rowId, colId, elementId }); e.dataTransfer.effectAllowed = "move"; };
    const onDrop = (targetPageId: string, targetRowId: string, targetColId: string) => {
        if (!draggedItem) return;
        setPages((prev: any[]) => {
            let item: any;
            const cleanPages = prev.map(page => ({ ...page, rows: page.rows.map((row: any) => ({ ...row, columns: row.columns.map((col: any) => { if (col.id === draggedItem.colId && page.id === draggedItem.pageId) { item = col.elements.find((e: any) => e.id === draggedItem.elementId); return { ...col, elements: col.elements.filter((e: any) => e.id !== draggedItem.elementId) }; } return col; }) })) }));
            if (!item) return prev;
            return cleanPages.map(page => page.id === targetPageId ? { ...page, rows: page.rows.map((row: any) => row.id === targetRowId ? { ...row, columns: row.columns.map((col: any) => col.id === targetColId ? { ...col, elements: [...col.elements, item] } : col) } : row) } : page);
        });
        setDraggedItem(null); setSelectedElement(null);
    };

    return (
        <div className="canvas-wrapper" onClick={() => { setSelectedElement(null); setActiveRowMenu(null); setActiveColMenu(null); }}>
            {pages?.map((page, index) => (
                <PageItem key={page.id} page={page} pageIndex={index} totalPages={pages.length} setPages={setPages} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} handleAutoSplit={handleAutoSplit} onDragStart={onDragStart} onDrop={onDrop} handleDeleteElement={handleDeleteElement} handleDeleteRow={handleDeleteRow} onDeletePage={handleDeletePage} getGridCols={getGridCols} handleAddElement={handleAddElement} activeRowMenu={activeRowMenu} setActiveRowMenu={setActiveRowMenu} activeColMenu={activeColMenu} setActiveColMenu={setActiveColMenu} globalFootnoteMap={globalFootnoteMap} elementLabelMap={elementLabelMap} />
            ))}
            <button onClick={(e) => { e.stopPropagation(); setPages((prev: any[]) => [...prev, { id: `page-${Date.now()}`, rows: [{ id: Math.random().toString(36).substr(2, 9), columns: [] }] }]); }} style={{ padding: '0.875rem 1.75rem', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '9999px', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '2.5rem' }}>
                <Plus size={20} /> Нова страница
            </button>
        </div>
    );
};

export default Canvas;
