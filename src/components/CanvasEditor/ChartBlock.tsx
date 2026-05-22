import { useState, useEffect, useRef, useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, GripVertical } from "lucide-react";
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    ComposedChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    RadialBarChart, RadialBar, ScatterChart, Scatter, ZAxis,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Label
} from "recharts";
import { CHART_PALETTE } from "./constants";
import { parseVal, formatChartValue } from "./utils";

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

const RenderBars = ({ keys, colors, chartData, isStacked, isHorizontal, isLabelsShown, palette, formatter }: any) => {
    let labelPosition: any;
    if (isStacked) labelPosition = isHorizontal ? 'center' : 'inside';
    else labelPosition = isHorizontal ? 'right' : 'top';
    const labelFill = isStacked ? '#fff' : '#64748b';
    const isSingleSeries = keys.length === 1 && !isStacked;
    return (
        <>
            {keys.map((key: string, idx: number) => {
                const seriesColor = colors[key] || palette[idx % palette.length];
                return (
                    <Bar
                        key={key}
                        dataKey={key}
                        radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                        fill={seriesColor}
                        stackId={isStacked ? "a" : undefined}
                        isAnimationActive={false}
                        activeBar={{ stroke: '#1e293b', strokeWidth: 2 }}
                    >
                        {isSingleSeries && chartData.map((entry: any, i: number) => (
                            <Cell key={`cell-${i}`} fill={colors[entry.name] || seriesColor} />
                        ))}
                        {isLabelsShown && (
                            <LabelList
                                dataKey={key}
                                position={labelPosition}
                                style={{ fill: labelFill, fontSize: 11 }}
                                formatter={formatter}
                            />
                        )}
                    </Bar>
                );
            })}
        </>
    );
};

/**
 * Renders children via a React Portal attached to document.body,
 * positioned with `position:fixed` below the anchor element.
 * This escapes every stacking context so the popover always floats above
 * all canvas pages, regardless of z-index inside the document layout.
 */
const DataEditorPortal = ({ anchorRef, children }: { anchorRef: React.RefObject<HTMLDivElement | null>; children: React.ReactNode }) => {
    const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', top: -9999, left: -9999, zIndex: 2147483647 });

    useEffect(() => {
        const update = () => {
            if (!anchorRef.current) return;
            const r = anchorRef.current.getBoundingClientRect();
            setStyle({ position: 'fixed', top: r.bottom + 8, left: r.left, zIndex: 2147483647 });
        };
        update();
        // Re-position on any scroll (capture phase to catch scrolling containers)
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [anchorRef]);

    return createPortal(<div style={style}>{children}</div>, document.body);
};

const DataEditorPopover = ({ settings, data, keys, colors, updateSettings }: any) => {
    const isPie = settings.chartType === 'circular';
    const isComposed = settings.chartType === 'composed';
    const isSingleSeriesBar = settings.chartType === 'bar' && keys.length === 1 && settings.subChartType !== 'stacked_v' && settings.subChartType !== 'stacked_h';
    const isPerRowColor = isPie || isSingleSeriesBar;
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
                                    style={{ height: '32px', width: '100%', cursor: isSingleSeriesBar ? 'default' : 'pointer', backgroundColor: !isPie && !isSingleSeriesBar ? (colors[k] || CHART_PALETTE[i % CHART_PALETTE.length]) : '#f8fafc' }}
                                    onClick={() => !isPie && !isSingleSeriesBar && updateSettings({ activeColorKey: k })}
                                >
                                    {!isPie && !isSingleSeriesBar && settings.activeColorKey === k && <div style={{position:'absolute', inset:0, border:'3px solid #2563eb', boxShadow:'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'}} />}
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
                                value={settings.xAxisLabel ?? ''}
                                placeholder="Ознака"
                                onChange={e => updateSettings({ xAxisLabel: e.target.value })}
                                className="data-input"
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
                            <td style={{ padding: 0 }} onClick={() => isPerRowColor && updateSettings({ activeColorKey: row.name })}>
                                {isPerRowColor && (
                                    <div
                                        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '12px', cursor: 'pointer', backgroundColor: colors[row.name] || CHART_PALETTE[rIdx % CHART_PALETTE.length] }}
                                    >
                                        {settings.activeColorKey === row.name && <div style={{position:'absolute', inset:0, border:'2px solid #2563eb'}} />}
                                    </div>
                                )}
                                <input value={row.name} onChange={e => handleNameChange(rIdx, e.target.value)} className="data-input data-input-left" style={{ paddingLeft: isPerRowColor ? '20px' : '8px' }} />
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

export const ChartElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart, elementLabel }: any) => {
    const defaultSettings = el.payload.settings || {};
    const currentSettings = isSelected && selectedElement?.elementId === el.id ? selectedElement.settings : defaultSettings;

    const data = el.payload.data || currentSettings.data || [];
    const keys = el.payload.keys || currentSettings.keys || [];
    const colors = el.payload.colors || currentSettings.colors || {};
    const subType = el.payload.subChartType || selectedElement?.extraPayload?.subChartType || currentSettings.subChartType;

    const updateLocalSettings = (newSettings: any, newPayload: any = {}) => {
        updateElementSettings(newSettings, newPayload);
    };

    const chartData = useMemo(() =>
        data.map((row: any) => {
            const out: any = { name: row.name };
            keys.forEach((k: string) => { out[k] = parseVal(row[k]); });
            return out;
        }), [data, keys]);

    // Hoisted pie data — sorted by value desc, used by Pie and by label-layout
    const pieData = useMemo(() => {
        if (currentSettings.chartType !== 'circular' || !data.length || !keys.length) return [];
        return [...chartData.map((d: any) => ({ name: d.name, value: d[keys[0]] || 0 }))].sort((a: any, b: any) => b.value - a.value);
    }, [currentSettings.chartType, chartData, keys, data.length]);

    // Cache for collision-adjusted pie label positions (recomputed when chart geometry changes)
    const pieLabelCache = useRef<{ key: string; positions: any[] }>({ key: '', positions: [] });

    const formatVal = (v: any) => formatChartValue(v, currentSettings.decimals, currentSettings.isPercentage);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const blockRef = useRef<HTMLDivElement>(null);   // anchor for the data-editor portal
    const [chartWidth, setChartWidth] = useState(400);
    const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

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

    const legendPosition = currentSettings.legendPosition || 'bottom';
    const isRightLegend = legendPosition === 'right';
    const isTopLegend = legendPosition === 'top';

    // showRechartsLegend  → let Recharts render its own built-in legend (bottom only)
    // showTopLegend       → we render a custom legend div *above* the chart (avoids Recharts z-index overlap)
    const showRechartsLegend = !!(currentSettings.showLegend && !isRightLegend && !isTopLegend);
    const showTopLegend     = !!(currentSettings.showLegend && isTopLegend);

    const baseChartHeight = isPie ? Math.max(180, Math.min(280, chartWidth)) : 280;

    const legendItemCount = isPie ? data.length : keys.length;
    const itemsPerRow = Math.max(1, Math.min(6, Math.floor(chartWidth / 85)));
    const legendRows = Math.ceil(legendItemCount / itemsPerRow);

    // Total container height accounts for legend rows regardless of position
    const showAnyInternalLegend = showRechartsLegend || showTopLegend;
    const chartAreaHeight = baseChartHeight + (showAnyInternalLegend ? legendRows * 22 : 0);

    // Custom vertical legend for right-side layout
    const renderSideLegend = () => {
        const items = isPie
            ? chartData
                .map((d: any, i: number) => ({ label: d.name, color: colors[d.name] || CHART_PALETTE[i % CHART_PALETTE.length], val: d[keys[0]] ?? 0 }))
                .sort((a: any, b: any) => b.val - a.val)
            : keys.map((key: string, i: number) => ({ label: key, color: colors[key] || CHART_PALETTE[i % CHART_PALETTE.length] }));

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: '14px', justifyContent: 'center', overflowY: 'auto', maxHeight: '100%' }}>
                {items.map((item: any, i: number) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#1E293B', lineHeight: '1.35' }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <circle cx="5" cy="5" r="5" fill={item.color} />
                        </svg>
                        {item.label}
                    </span>
                ))}
            </div>
        );
    };

    // Custom top-legend rendered as a normal div above the chart (no z-index conflict with Recharts)
    const renderTopLegend = () => {
        const items = isPie
            ? pieData.map((d: any, i: number) => ({ label: d.name, color: colors[d.name] || CHART_PALETTE[i % CHART_PALETTE.length] }))
            : keys.map((key: string, i: number) => ({ label: key, color: colors[key] || CHART_PALETTE[i % CHART_PALETTE.length] }));
        const align = currentSettings.legendAlign || 'center';
        const justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent, gap: '4px 14px', paddingLeft: '24px', paddingBottom: '4px', fontSize: '12px', flexShrink: 0 }}>
                {items.map((item: any, i: number) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                            <circle cx="5" cy="5" r="5" fill={item.color} />
                        </svg>
                        <span style={{ color: '#1E293B', fontWeight: 600 }}>{item.label}</span>
                    </span>
                ))}
            </div>
        );
    };

    const dynamicOuterRadius = Math.max(35, Math.min((chartWidth - 70) / 2, (baseChartHeight - 60) / 2)) * 0.85;
    const dynamicInnerRadius = isDoughnut ? dynamicOuterRadius * 0.6 : 0;

    const renderLegendText = (value: string) => (
        <span style={{ color: '#1E293B', fontWeight: 600, paddingLeft: '4px' }}>{value}</span>
    );

    // Y-axis custom domain: use setting value when defined, otherwise 'auto'
    const yMin = currentSettings.yAxisMin !== undefined && currentSettings.yAxisMin !== '' ? Number(currentSettings.yAxisMin) : 'auto';
    const yMax = currentSettings.yAxisMax !== undefined && currentSettings.yAxisMax !== '' ? Number(currentSettings.yAxisMax) : 'auto';
    const yDomain: [any, any] = [yMin, yMax];
    const hasCustomYDomain = yMin !== 'auto' || yMax !== 'auto';

    // X-axis custom domain (used for horizontal bar value axis)
    const xMin = currentSettings.xAxisMin !== undefined && currentSettings.xAxisMin !== '' ? Number(currentSettings.xAxisMin) : 'auto';
    const xMax = currentSettings.xAxisMax !== undefined && currentSettings.xAxisMax !== '' ? Number(currentSettings.xAxisMax) : 'auto';
    const xDomain: [any, any] = [xMin, xMax];
    const hasCustomXDomain = xMin !== 'auto' || xMax !== 'auto';

    // X-axis padding (offset first/last point from edge)
    const xPaddingLeft = currentSettings.xAxisPaddingLeft ? Number(currentSettings.xAxisPaddingLeft) : 0;
    const xPaddingRight = currentSettings.xAxisPaddingRight ? Number(currentSettings.xAxisPaddingRight) : 0;
    const xAxisPadding = { left: xPaddingLeft, right: xPaddingRight };

    // Data table below chart (Excel-style) — available for all chart types
    const dataTableEnabled = !!currentSettings.showDataTable && data.length > 0 && keys.length > 0;

    const renderDataTable = () => {
        if (!dataTableEnabled) return null;
        return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px', tableLayout: 'fixed' }}>
                <thead>
                    <tr>
                        <th style={{ width: '110px', padding: '4px 8px', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}></th>
                        {chartData.map((d: any, i: number) => (
                            <th key={i} style={{ padding: '4px 6px', borderBottom: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 700, color: '#1e293b', fontSize: '11px' }}>
                                {d.name}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {keys.map((key: string, idx: number) => {
                        const color = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                        return (
                            <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '4px 8px', fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ width: '10px', height: '10px', backgroundColor: color, flexShrink: 0, display: 'inline-block', borderRadius: '2px' }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{key}</span>
                                    </span>
                                </td>
                                {chartData.map((d: any, i: number) => (
                                    <td key={i} style={{ padding: '4px 6px', textAlign: 'center', fontSize: '11px', color: '#334155' }}>
                                        {formatVal(d[key])}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        );
    };

    const renderCustomPieLabel = (props: any) => {
        const { cx, cy, outerRadius, value, index } = props;
        if (value === 0 || value === '0' || value === '') return null;

        const isNarrow = chartWidth < 250;
        const isSemi = subType === 'semicircle_doughnut';
        const cacheKey = `${cx}-${cy}-${outerRadius}-${pieData.length}-${isSemi}-${isNarrow}`;

        if (pieLabelCache.current.key !== cacheKey) {
            pieLabelCache.current.key = cacheKey;
            const total = pieData.reduce((s: number, d: any) => s + (d.value || 0), 0);
            if (!total) {
                pieLabelCache.current.positions = [];
            } else {
                const sweep = isSemi ? -180 : 360;
                const startAng = isSemi ? 180 : 0;
                const RADIAN = Math.PI / 180;
                const labelOffset = isNarrow ? 14 : 22;
                const minSpacing = isNarrow ? 12 : 14;

                let cumulative = 0;
                const positions = pieData.map((d: any) => {
                    const v = d.value || 0;
                    const span = (v / total) * sweep;
                    const midAngle = startAng + cumulative + span / 2;
                    cumulative += span;
                    const cos = Math.cos(-midAngle * RADIAN);
                    const sin = Math.sin(-midAngle * RADIAN);
                    const lineStartX = cx + outerRadius * cos;
                    const lineStartY = cy + outerRadius * sin;
                    const idealX = cx + (outerRadius + labelOffset) * cos;
                    const idealY = cy + (outerRadius + labelOffset) * sin;
                    return {
                        lineStartX, lineStartY, idealX, idealY,
                        x: idealX, y: idealY,
                        isRight: cos >= 0,
                        side: cos >= 0 ? 'right' : 'left' as const,
                    };
                });

                // Approximate full chart bounds from cy (cy is at 45% or 75% of pie area)
                const totalChartHeight = isSemi ? cy / 0.75 : cy / 0.45;
                const topBound = 8;
                const bottomBound = totalChartHeight - 8;

                // Push apart vertically per side with bounds enforcement
                (['right', 'left'] as const).forEach((sideName) => {
                    const sideArr = positions.map((p: any, idx: number) => ({ p, idx })).filter(({ p }) => p.side === sideName);
                    if (!sideArr.length) return;
                    sideArr.sort((a, b) => a.p.y - b.p.y);

                    // Pass 1: push DOWN for spacing
                    for (let i = 1; i < sideArr.length; i++) {
                        const prev = sideArr[i - 1].p;
                        const cur = sideArr[i].p;
                        if (cur.y - prev.y < minSpacing) cur.y = prev.y + minSpacing;
                    }

                    // Pass 2: if bottom-most exceeds bottomBound, shift whole stack up
                    const lastP = sideArr[sideArr.length - 1].p;
                    if (lastP.y > bottomBound) {
                        const shift = lastP.y - bottomBound;
                        sideArr.forEach(({ p }) => { p.y -= shift; });
                    }

                    // Pass 3: if top-most goes above topBound, clamp it and re-push subsequent
                    if (sideArr[0].p.y < topBound) {
                        sideArr[0].p.y = topBound;
                        for (let i = 1; i < sideArr.length; i++) {
                            const prev = sideArr[i - 1].p;
                            const cur = sideArr[i].p;
                            if (cur.y - prev.y < minSpacing) cur.y = prev.y + minSpacing;
                        }
                    }
                });

                pieLabelCache.current.positions = positions;
            }
        }

        const layout = pieLabelCache.current.positions[index];
        if (!layout) return null;

        const labelX = layout.x + (layout.isRight ? 4 : -4);
        const labelY = layout.y;
        const wasMoved = Math.abs(layout.y - layout.idealY) > 0.5;
        const pathD = wasMoved
            ? `M${layout.lineStartX},${layout.lineStartY} L${layout.idealX},${layout.idealY} L${labelX},${labelY}`
            : `M${layout.lineStartX},${layout.lineStartY} L${labelX},${labelY}`;

        return (
            <g>
                <path d={pathD} stroke="#cbd5e1" strokeWidth={1} fill="none" />
                <text x={labelX} y={labelY} fill="#1E293B" textAnchor={layout.isRight ? 'start' : 'end'} dominantBaseline="central" fontSize={isNarrow ? 9 : 11} fontWeight="bold">
                    {formatVal(value)}
                </text>
            </g>
        );
    };

    const renderChart = () => {
        if (!data.length || !keys.length) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#94a3b8', fontSize:'14px'}}>Učitavanje podataka...</div>;

        const axisTickStyle = { fontSize: 12, fill: '#64748b' };
        const axisLineStyle = { stroke: '#cbd5e1' };
        const tooltipStyle = { borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', padding: '10px 14px' };

        const chartMargin = currentSettings.chartType === 'circular' ? { top: 0, right: 0, left: 0, bottom: 0 } : { top: 25, right: 15, left: 5, bottom: 5 };

        switch (currentSettings.chartType) {
            case 'bar': {
                const isStacked = subType === 'stacked_v' || subType === 'stacked_h';
                const isHorizontal = subType === 'grouped_h' || subType === 'stacked_h';
                const yAxisWidth = isHorizontal
                    ? Math.min(200, Math.max(60, Math.max(...chartData.map((d: any) => String(d.name || '').length), 0) * 6.5))
                    : undefined;
                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <BarChart data={chartData} layout={isHorizontal ? "vertical" : "horizontal"} margin={chartMargin}>
                            {currentSettings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={isHorizontal} horizontal={!isHorizontal} stroke="#E2E8F0" />}
                            {isHorizontal ? (
                                <>
                                    <XAxis type="number" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={xDomain} allowDataOverflow={hasCustomXDomain} />
                                    <YAxis type="category" dataKey="name" width={yAxisWidth} tick={{ ...axisTickStyle, width: yAxisWidth }} axisLine={axisLineStyle} tickLine={false} />
                                </>
                            ) : (
                                <>
                                    <XAxis type="category" dataKey="name" tick={dataTableEnabled ? false : axisTickStyle} axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} />
                                    <YAxis type="number" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain} />
                                </>
                            )}
                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} formatter={(v: any, n: any) => [formatVal(v), n]} />
                            {showRechartsLegend && (() => {
                                const legendProps: any = {
                                    verticalAlign: 'bottom' as const,
                                    align: currentSettings.legendAlign || 'center',
                                    wrapperStyle: { fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' },
                                    iconType: 'circle',
                                    formatter: renderLegendText,
                                    payload: keys.map((key: string, idx: number) => ({ value: key, type: 'circle' as const, color: colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length] })),
                                };
                                return <Legend {...legendProps} />;
                            })()}
                            <RenderBars keys={keys} colors={colors} chartData={chartData} isStacked={isStacked} isHorizontal={isHorizontal} isLabelsShown={currentSettings.showLabels} palette={CHART_PALETTE} formatter={formatVal} />
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
                        <ChartComponent data={chartData} margin={chartMargin}>
                            {currentSettings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis dataKey="name" tick={dataTableEnabled ? false : axisTickStyle} axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} />
                            <YAxis tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [formatVal(v), n]} />
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={currentSettings.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}
                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                if (isArea) return (
                                    <Area
                                        key={key} type="monotone" dataKey={key} stackId={isStackedArea ? "1" : undefined}
                                        stroke={baseColor} fill={baseColor} fillOpacity={0.6} strokeWidth={2}
                                        dot={hasDots ? { r: 4 } : false}
                                        activeDot={{ r: 7, stroke: '#1e293b', strokeWidth: 2, fill: baseColor }}
                                        isAnimationActive={false}
                                        label={currentSettings.showLabels ? (p: any) => <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#64748b" fontSize={11}>{formatVal(p.value)}</text> : false}
                                    />
                                );
                                return (
                                    <Line
                                        key={key} type="monotone" dataKey={key} stroke={baseColor} strokeWidth={3}
                                        dot={hasDots ? { r: 4, fill: baseColor, strokeWidth: 2, stroke: '#fff' } : { r: 0 }}
                                        activeDot={{ r: 7, stroke: '#1e293b', strokeWidth: 2, fill: baseColor }}
                                        isAnimationActive={false}
                                        label={currentSettings.showLabels ? (p: any) => <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#64748b" fontSize={11}>{formatVal(p.value)}</text> : false}
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
                        value: parseVal(d[keys[0]]),
                        fill: colors[d.name] || CHART_PALETTE[i % CHART_PALETTE.length]
                    }));
                    return (
                        <ResponsiveContainer width="99%" height="100%">
                            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="100%" barSize={12} data={radialData}>
                                <RadialBar
                                    background={{ fill: '#f1f5f9' }}
                                    dataKey="value"
                                    cornerRadius={10}
                                    label={currentSettings.showLabels ? (p: any) => <text x={p.x} y={p.y} textAnchor="middle" fill="#64748b" fontSize={11}>{formatVal(p.value)}</text> : false}
                                />
                                <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [formatVal(v), n]} />
                                {showRechartsLegend && <Legend verticalAlign="bottom" align={currentSettings.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}
                            </RadialBarChart>
                        </ResponsiveContainer>
                    );
                }

                const align = currentSettings.legendAlign || 'center';
                const justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
                const renderPieLegend = () => (
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent, gap: '4px 14px', paddingLeft: '24px', paddingTop: '5px', fontSize: '12px' }}>
                        {pieData.map((entry: any, index: number) => (
                            <span key={entry.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                                    <circle cx="5" cy="5" r="5" fill={colors[entry.name] || CHART_PALETTE[index % CHART_PALETTE.length]} />
                                </svg>
                                <span style={{ color: '#1E293B', fontWeight: 600 }}>{entry.name}</span>
                            </span>
                        ))}
                    </div>
                );
                // When legend is on the right, we skip the internal pie legend too
                const internalPieLegend = showRechartsLegend ? renderPieLegend : () => null;

                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <PieChart margin={chartMargin}>
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [formatVal(v), n]} />
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={currentSettings.legendAlign || 'center'} content={internalPieLegend} />}
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
                                onMouseEnter={(_, index) => setActiveIndex(index)}
                                onMouseLeave={() => setActiveIndex(undefined)}
                            >
                                {pieData.map((entry: any, index: number) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={colors[entry.name] || CHART_PALETTE[index % CHART_PALETTE.length]}
                                        stroke="#fff"
                                        strokeWidth={2}
                                        style={{
                                            opacity: activeIndex === undefined || activeIndex === index ? 1 : 0.3,
                                            transition: 'opacity 0.2s',
                                            outline: 'none'
                                        }}
                                    />
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
                        <ComposedChart data={chartData} margin={chartMargin}>
                            {currentSettings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis dataKey="name" tick={dataTableEnabled ? false : axisTickStyle} axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} />
                            <YAxis tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain} />
                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} formatter={(v: any, n: any) => [formatVal(v), n]} />
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={currentSettings.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}

                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];

                                let typeToRender = currentSettings.seriesTypes?.[key];
                                if (!typeToRender) {
                                    if (idx === 0) typeToRender = isAreaLine || isAreaBar ? 'area' : 'bar';
                                    else if (idx === 1) typeToRender = isAreaBar ? 'area' : (isStackedLine ? 'bar' : 'line');
                                    else typeToRender = 'line';
                                }

                                if (typeToRender === 'area') {
                                    return <Area key={key} type="monotone" dataKey={key} fill={baseColor} stroke={baseColor} fillOpacity={0.3} isAnimationActive={false} activeDot={{ r: 7, stroke: '#1e293b', strokeWidth: 2, fill: baseColor }} label={currentSettings.showLabels ? (p: any) => <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#64748b" fontSize={11}>{formatVal(p.value)}</text> : false} />;
                                }
                                if (typeToRender === 'bar') {
                                    return <Bar key={key} dataKey={key} stackId={isStackedLine ? "a" : undefined} barSize={isAreaBar ? 15 : 20} fill={baseColor} radius={[4, 4, 0, 0]} isAnimationActive={false} activeBar={{ stroke: '#1e293b', strokeWidth: 2 }}><LabelList dataKey={key} position={isStackedLine ? 'inside' : 'top'} style={{ fill: isStackedLine ? '#fff' : '#64748b', fontSize: 11 }} formatter={formatVal} /></Bar>;
                                }
                                return <Line key={key} type="monotone" dataKey={key} stroke={baseColor} strokeWidth={3} dot={{ r: 4, fill: baseColor, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} activeDot={{ r: 7, stroke: '#1e293b', strokeWidth: 2, fill: baseColor }} label={currentSettings.showLabels ? (p: any) => <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#64748b" fontSize={11}>{formatVal(p.value)}</text> : false} />;
                            })}
                        </ComposedChart>
                    </ResponsiveContainer>
                );
            }
            case 'scatter': {
                const isBubble = subType === 'bubble_basic';
                const shape = subType === 'scatter_star' ? 'star' : subType === 'scatter_diamond' ? 'diamond' : 'circle';
                const xTitle = currentSettings.xAxisTitle;
                const yTitle = currentSettings.yAxisTitle;
                const scatterMargin = { ...chartMargin, bottom: xTitle ? 30 : chartMargin.bottom, left: yTitle ? 0 : chartMargin.left };

                // True bubble mode: each row = one bubble (keys[0]=X, keys[1]=Y, keys[2]=size/label)
                if (isBubble && keys.length >= 2) {
                    const xKey = keys[0];
                    const yKey = keys[1];
                    const zKey = keys[2] || keys[0];
                    const bubbleData = data.map((row: any, i: number) => ({
                        name: row.name,
                        x: parseVal(row[xKey]),
                        y: parseVal(row[yKey]),
                        z: parseVal(row[zKey]),
                        fill: colors[row.name] || CHART_PALETTE[i % CHART_PALETTE.length],
                    }));

                    return (
                        <ResponsiveContainer width="99%" height="100%">
                            <ScatterChart margin={scatterMargin}>
                                {currentSettings.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />}
                                <XAxis type="number" dataKey="x" name={xKey} tickFormatter={formatVal} tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} domain={hasCustomXDomain ? xDomain : ['auto', 'auto']} allowDataOverflow={hasCustomXDomain} padding={xAxisPadding}>
                                    {xTitle && <Label value={xTitle} position="insideBottom" offset={-18} style={{ fill: '#475569', fontSize: 12, fontWeight: 600, textAnchor: 'middle' }} />}
                                </XAxis>
                                <YAxis type="number" dataKey="y" name={yKey} tickFormatter={formatVal} tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain}>
                                    {yTitle && <Label value={yTitle} angle={-90} position="insideLeft" offset={15} style={{ fill: '#475569', fontSize: 12, fontWeight: 600, textAnchor: 'middle' }} />}
                                </YAxis>
                                <ZAxis type="number" dataKey="z" range={[80, 1200]} />
                                <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }} formatter={(v: any, n: any) => [formatVal(v), n]} />
                                <Scatter data={bubbleData} fillOpacity={0.75} isAnimationActive={false} shape={shape}>
                                    {bubbleData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                                    {currentSettings.showLabels && (
                                        <LabelList dataKey="z" position="center" formatter={formatVal} style={{ fill: '#fff', fontSize: 12, fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }} />
                                    )}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    );
                }

                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <ScatterChart margin={scatterMargin}>
                            {currentSettings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis type="category" dataKey="name" allowDuplicatedCategory={false} tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding}>
                                {xTitle && <Label value={xTitle} position="insideBottom" offset={-18} style={{ fill: '#475569', fontSize: 12, fontWeight: 600, textAnchor: 'middle' }} />}
                            </XAxis>
                            <YAxis type="number" dataKey="value" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain}>
                                {yTitle && <Label value={yTitle} angle={-90} position="insideLeft" offset={15} style={{ fill: '#475569', fontSize: 12, fontWeight: 600, textAnchor: 'middle' }} />}
                            </YAxis>
                            <ZAxis type="number" dataKey="value" range={isBubble ? [60, 600] : [50, 50]} />
                            <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }} formatter={(v: any, n: any) => [formatVal(v), n]} />
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={currentSettings.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}

                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                const scatterData = chartData.map((d: any) => ({ name: d.name, value: d[key] || 0 }));
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
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={currentSettings.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}
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
            ref={blockRef}
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
            style={{
                height: 'auto',
                marginTop: `${currentSettings.marginTop || 0}px`,
                marginBottom: `${currentSettings.marginBottom || 0}px`,
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            {isSelected && (
                <div className="element-actions">
                    <div className="action-btn grab"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="action-btn danger"><Trash2 size={14} /></button>
                </div>
            )}

            <ElementLabel label={elementLabel} title={currentSettings.title} />

            {currentSettings.subtitle && (
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', textAlign: (currentSettings.subtitleAlign || 'left') as any, width: '100%' }}>
                    {currentSettings.subtitle}
                </div>
            )}

            <div ref={wrapperRef} style={{ width: '100%', height: `${chartAreaHeight}px`, flexShrink: 0, pointerEvents: 'auto', minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: showTopLegend ? 'column' : 'row' }}>
                {showTopLegend && renderTopLegend()}
                <div style={{ flex: isRightLegend ? '0 0 62%' : '1', minWidth: 0, minHeight: 0, ...(showTopLegend ? {} : { height: '100%' }) }}>
                    {renderChart()}
                </div>
                {isRightLegend && currentSettings.showLegend && (
                    <div style={{ flex: '0 0 38%', display: 'flex', alignItems: 'center', height: '100%' }}>
                        {renderSideLegend()}
                    </div>
                )}
            </div>

            {dataTableEnabled && (
                <div style={{ width: isRightLegend ? '62%' : '100%' }}>
                    {renderDataTable()}
                </div>
            )}

            {currentSettings.description && (
                <div
                    style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', width: '100%', fontStyle: 'italic' }}
                    dangerouslySetInnerHTML={{ __html: currentSettings.description }}
                />
            )}

            {isSelected && currentSettings.showDataEditor && (
                <DataEditorPortal anchorRef={blockRef}>
                    <DataEditorPopover settings={currentSettings} data={data} keys={keys} colors={colors} updateSettings={updateLocalSettings} />
                </DataEditorPortal>
            )}
        </div>
    );
};
