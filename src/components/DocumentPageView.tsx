import { useEffect, useMemo, useRef, useState } from "react";
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    ComposedChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    RadialBarChart, RadialBar, ScatterChart, Scatter, ZAxis,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Label
} from "recharts";
import MapGraphic from "./MapGraphic.tsx";
import { extractFootnoteIds, hexToRgba, parseVal, formatChartValue } from "./CanvasEditor/utils";
import { CHART_PALETTE } from "./CanvasEditor/constants";

// --- HELPERS ---

export function buildMaps(sections: any[]) {
    const elementLabelMap: Record<string, string> = {};
    const globalFootnoteOrder: string[] = [];

    sections.forEach((section, sIdx) => {
        const pages = section.canvas_data || [];
        let tableCount = 1;
        let mediaCount = 1;

        pages.forEach((page: any) => {
            page.rows.forEach((row: any) => {
                row.columns.forEach((col: any) => {
                    col.elements.forEach((el: any) => {
                        if (el.type === 'table') {
                            elementLabelMap[el.id] = `Tabela ${sIdx + 1}.${tableCount}`;
                            tableCount++;
                        } else if (el.type === 'image' || el.type === 'chart') {
                            elementLabelMap[el.id] = `Slika ${sIdx + 1}.${mediaCount}`;
                            mediaCount++;
                        }

                        if (el.type === 'text' && el.payload.settings.content) {
                            globalFootnoteOrder.push(...extractFootnoteIds(el.payload.settings.content));
                        } else if (el.type === 'table') {
                            const contentObj = el.payload.sr?.content || {};
                            const sortedKeys = Object.keys(contentObj).sort((a, b) => {
                                const [rA, cA] = a.split('_').map(Number);
                                const [rB, cB] = b.split('_').map(Number);
                                return rA !== rB ? rA - rB : cA - cB;
                            });
                            sortedKeys.forEach(key => {
                                if (typeof contentObj[key] === 'string') {
                                    globalFootnoteOrder.push(...extractFootnoteIds(contentObj[key]));
                                }
                            });
                        }
                    });
                });
            });
        });
    });

    const globalFootnoteMap: Record<string, number> = {};
    let fnCounter = 1;
    globalFootnoteOrder.forEach(id => {
        if (!globalFootnoteMap[id]) globalFootnoteMap[id] = fnCounter++;
    });

    return { elementLabelMap, globalFootnoteMap };
}

export function buildPageFootnotes(page: any, globalFootnoteMap: Record<string, number>) {
    const fns: { id: string; number: number; text: string }[] = [];
    page.rows.forEach((row: any) => {
        row.columns.forEach((col: any) => {
            col.elements.forEach((el: any) => {
                if (el.type === 'text' && el.payload.settings.content) {
                    const ids = extractFootnoteIds(el.payload.settings.content);
                    const fnDict = el.payload.settings.footnotes || {};
                    ids.forEach(id => fns.push({ id, number: globalFootnoteMap[id], text: fnDict[id] || '' }));
                } else if (el.type === 'table') {
                    const contentObj = el.payload.sr?.content || {};
                    const fnDict = el.payload.settings.footnotes || {};
                    const sortedKeys = Object.keys(contentObj).sort((a, b) => {
                        const [rA, cA] = a.split('_').map(Number);
                        const [rB, cB] = b.split('_').map(Number);
                        return rA !== rB ? rA - rB : cA - cB;
                    });
                    sortedKeys.forEach(key => {
                        if (typeof contentObj[key] === 'string') {
                            extractFootnoteIds(contentObj[key]).forEach(id =>
                                fns.push({ id, number: globalFootnoteMap[id], text: fnDict[id] || '' })
                            );
                        }
                    });
                }
            });
        });
    });
    return fns.sort((a, b) => (a.number || 0) - (b.number || 0));
}

// --- READ-ONLY ELEMENT BLOCKS (identical styles to Canvas) ---

const ElementLabel = ({ label, title }: { label: string; title?: string }) => {
    if (!label) return null;
    return (
        <div style={{
            fontSize: '13px', fontWeight: 700, color: '#1e293b',
            marginBottom: '8px', textAlign: 'left',
            borderLeft: '3px solid #3b82f6', paddingLeft: '8px',
            width: '100%', wordBreak: 'break-word'
        }}>
            {label}{title ? `: ${title}` : ''}
        </div>
    );
};

const TextBlockReadonly = ({ el }: any) => {
    const s = el.payload.settings;
    return (
        <div
            className="element-block"
            style={{
                marginTop: `${s.marginTop || 0}px`,
                marginBottom: `${s.marginBottom || 0}px`,
                backgroundColor: s.backgroundColor || 'transparent',
                padding: s.backgroundColor ? '16px' : '0px',
                borderRadius: s.backgroundColor ? '8px' : '0px',
                border: 'none', cursor: 'default',
            }}
        >
            <div
                className="editor-content"
                style={{ color: s.color, textAlign: s.alignment }}
                dangerouslySetInnerHTML={{ __html: s.content || '' }}
            />
        </div>
    );
};

const ImageBlockReadonly = ({ el, label }: any) => {
    const s = el.payload.settings;
    if (!s.url) return null;
    return (
        <div
            className="element-block break-inside-avoid"
            style={{
                marginTop: `${s.marginTop || 0}px`,
                marginBottom: `${s.marginBottom || 0}px`,
                border: 'none', cursor: 'default',
            }}
        >
            <ElementLabel label={label} title={s.altText} />
            <div style={{
                display: 'flex', flexDirection: 'column', width: '100%',
                alignItems: s.alignment === 'left' ? 'flex-start' : s.alignment === 'right' ? 'flex-end' : 'center',
            }}>
                <img
                    src={s.url} alt={s.altText}
                    style={{ width: `${s.width || 100}%`, height: 'auto', borderRadius: '0' }}
                />
                {s.altText && (
                    <span style={{ fontSize: '13px', fontStyle: 'italic', marginTop: '10px', color: '#64748b' }}>
                        {s.altText}
                    </span>
                )}
            </div>
        </div>
    );
};

const TableBlockReadonly = ({ el, label }: any) => {
    const s = el.payload.settings;
    const content = el.payload.sr?.content || {};
    const colsCount = s.columns || 1;
    const localWidths = (s.columnWidths && s.columnWidths.length === colsCount)
        ? s.columnWidths
        : Array(colsCount).fill(100 / colsCount);
    return (
        <div
            className="element-block break-inside-avoid"
            style={{
                marginTop: `${s.marginTop || 0}px`,
                marginBottom: `${s.marginBottom || 0}px`,
                border: 'none', cursor: 'default',
            }}
        >
            <ElementLabel label={label} title={s.title} />
            <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', borderRadius: '0', position: 'relative' }}>
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: '1px solid #cbd5e1', background: 'white', borderRadius: '0' }}>
                    <colgroup>
                        {localWidths.map((w: number, i: number) => (
                            <col key={i} style={{ width: `${w}%` }} />
                        ))}
                    </colgroup>
                    <tbody>
                    {Array.from({ length: s.rows || 1 }).map((_, rIdx) => (
                        <tr key={rIdx}>
                            {Array.from({ length: s.columns || 1 }).map((_, cIdx) => {
                                const key = `${rIdx}_${cIdx}`;
                                const cellSt = s.cells?.[key] || {};
                                if (cellSt.hidden) return null;
                                return (
                                    <td key={key} style={{
                                        border: '1px solid #e2e8f0',
                                        padding: '0.5rem',
                                        position: 'relative',
                                        backgroundColor: cellSt.backgroundColor || '#ffffff',
                                        textAlign: cellSt.alignment || 'left',
                                        verticalAlign: cellSt.verticalAlignment || 'top',
                                        color: cellSt.textColor || '#1E293B',
                                    }}
                                        colSpan={cellSt.colSpan || 1}
                                        rowSpan={cellSt.rowSpan || 1}
                                    >
                                        <div
                                            className="outline-none text-sm break-words"
                                            style={{
                                            fontWeight: cellSt.type === 'headline' ? 'bold' : 'normal',
                                            fontSize: cellSt.fontSize ? `${cellSt.fontSize}px` : (cellSt.type === 'headline' ? '15px' : '14px'),
                                            wordBreak: 'break-word',
                                            display: 'inline-block',
                                            minHeight: '24px',
                                            width: '100%',
                                        }}
                                            dangerouslySetInnerHTML={{ __html: content[key] || '' }}
                                        />
                                    </td>
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

const ChartBlockReadonly = ({ el, label, isPrint = false }: any) => {
    const s = el.payload.settings || {};
    const data = el.payload.data || [];
    const keys = el.payload.keys || [];
    const colors = el.payload.colors || {};
    const subType = el.payload.subChartType || s.subChartType;
    const pieLabelCache = useRef<{ key: string; positions: any[] }>({ key: '', positions: [] });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [chartWidth, setChartWidth] = useState(400);
    const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

    useEffect(() => {
        if (!wrapperRef.current) return;
        const observer = new ResizeObserver((entries) => {
            window.requestAnimationFrame(() => {
                if (entries[0]) setChartWidth(entries[0].contentRect.width);
            });
        });
        observer.observe(wrapperRef.current);
        return () => observer.disconnect();
    }, []);

    const chartData = data.map((row: any) => {
        const out: any = { name: row.name };
        keys.forEach((k: string) => { out[k] = parseVal(row[k]); });
        return out;
    });

    const formatVal = (v: any) => formatChartValue(v, s.decimals, s.isPercentage);

    if (!data.length || !keys.length) return null;

    const isPie = s.chartType === 'circular';
    const isSemi = subType === 'semicircle_doughnut';
    const isDoughnut = subType === 'doughnut_basic' || isSemi;
    const legendPosition = s.legendPosition || 'bottom';
    const isRightLegend = legendPosition === 'right';
    const isTopLegend = legendPosition === 'top';

    const showRechartsLegend = !!(s.showLegend && !isRightLegend && !isTopLegend);
    const showTopLegend     = !!(s.showLegend && isTopLegend);
    const showAnyInternalLegend = showRechartsLegend || showTopLegend;

    const baseChartHeight = isPie ? Math.max(180, Math.min(280, chartWidth)) : 280;
    const legendItemCount = isPie ? data.length : keys.length;
    const itemsPerRow = Math.max(1, Math.min(6, Math.floor(chartWidth / 85)));
    const legendRows = Math.ceil(legendItemCount / itemsPerRow);
    const chartAreaHeight = baseChartHeight + (showAnyInternalLegend ? legendRows * 22 : 0);

    const pieData = (isPie && data.length && keys.length)
        ? [...chartData.map((d: any) => ({ name: d.name, value: d[keys[0]] || 0 }))].sort((a: any, b: any) => b.value - a.value)
        : [];

    const dynamicOuterRadius = Math.max(35, Math.min((chartWidth - 70) / 2, (baseChartHeight - 60) / 2)) * 0.85;
    const dynamicInnerRadius = isDoughnut ? dynamicOuterRadius * 0.6 : 0;

    // Za pie: prvo sortiramo po vrednosti desc (isto kao i Cell-i u Pie), pa tek tada
    // dodeljujemo palette fallback po sortiranom indeksu — inače legenda i parčad одступају.
    const renderSideLegend = () => {
        const items = isPie
            ? [...chartData.map((d: any) => ({ label: d.name, val: d[keys[0]] ?? 0 }))]
                .sort((a: any, b: any) => b.val - a.val)
                .map((d: any, i: number) => ({ label: d.label, color: colors[d.label] || CHART_PALETTE[i % CHART_PALETTE.length] }))
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

    const renderTopLegend = () => {
        const items = isPie
            ? [...chartData.map((d: any) => ({ label: d.name, val: d[keys[0]] ?? 0 }))]
                .sort((a: any, b: any) => b.val - a.val)
                .map((d: any, i: number) => ({ label: d.label, color: colors[d.label] || CHART_PALETTE[i % CHART_PALETTE.length] }))
            : keys.map((key: string, i: number) => ({ label: key, color: colors[key] || CHART_PALETTE[i % CHART_PALETTE.length] }));
        const align = s.legendAlign || 'center';
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

    const axisTickStyle = { fontSize: 12, fill: '#64748b' };
    const axisLineStyle = { stroke: '#cbd5e1' };
    const chartMargin = isPie ? { top: 0, right: 0, left: 0, bottom: 0 } : { top: 25, right: 15, left: 5, bottom: 5 };
    const tooltipStyle = { borderRadius: '12px', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', padding: '10px 14px' };
    const renderLegendText = (value: string) => (
        <span style={{ color: '#1E293B', fontWeight: 600, paddingLeft: '4px' }}>{value}</span>
    );

    const yMin = s.yAxisMin !== undefined && s.yAxisMin !== '' ? Number(s.yAxisMin) : 'auto';
    const yMax = s.yAxisMax !== undefined && s.yAxisMax !== '' ? Number(s.yAxisMax) : 'auto';
    const yDomain: [any, any] = [yMin, yMax];
    const hasCustomYDomain = yMin !== 'auto' || yMax !== 'auto';

    const dualY = !!s.dualYAxis;
    const yMinRight = s.yAxisMinRight !== undefined && s.yAxisMinRight !== '' ? Number(s.yAxisMinRight) : 'auto';
    const yMaxRight = s.yAxisMaxRight !== undefined && s.yAxisMaxRight !== '' ? Number(s.yAxisMaxRight) : 'auto';
    const yDomainRight: [any, any] = [yMinRight, yMaxRight];
    const hasCustomYDomainRight = yMinRight !== 'auto' || yMaxRight !== 'auto';
    const getYAxisId = (key: string) => (dualY && s.yAxisSide?.[key] === 'right') ? 'right' : 'left';

    const xMin = s.xAxisMin !== undefined && s.xAxisMin !== '' ? Number(s.xAxisMin) : 'auto';
    const xMax = s.xAxisMax !== undefined && s.xAxisMax !== '' ? Number(s.xAxisMax) : 'auto';
    const xDomain: [any, any] = [xMin, xMax];
    const hasCustomXDomain = xMin !== 'auto' || xMax !== 'auto';

    // X-axis padding (offset first/last point from edge)
    const xPaddingLeft = s.xAxisPaddingLeft ? Number(s.xAxisPaddingLeft) : 0;
    const xPaddingRight = s.xAxisPaddingRight ? Number(s.xAxisPaddingRight) : 0;
    const xAxisPadding = { left: xPaddingLeft, right: xPaddingRight };

    // Data table below chart — available for all chart types
    const dataTableEnabled = !!s.showDataTable && data.length > 0 && keys.length > 0;

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
        const cacheKey = `${cx}-${cy}-${outerRadius}-${pieData.length}-${isSemi}-${isNarrow}`;

        if (pieLabelCache.current.key !== cacheKey) {
            pieLabelCache.current.key = cacheKey;
            const total = pieData.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
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

                const totalChartHeight = isSemi ? cy / 0.75 : cy / 0.45;
                const topBound = 8;
                const bottomBound = totalChartHeight - 8;

                (['right', 'left'] as const).forEach((sideName) => {
                    const sideArr = positions.map((p: any, idx: number) => ({ p, idx })).filter(({ p }) => p.side === sideName);
                    if (!sideArr.length) return;
                    sideArr.sort((a, b) => a.p.y - b.p.y);

                    for (let i = 1; i < sideArr.length; i++) {
                        const prev = sideArr[i - 1].p;
                        const cur = sideArr[i].p;
                        if (cur.y - prev.y < minSpacing) cur.y = prev.y + minSpacing;
                    }

                    const lastP = sideArr[sideArr.length - 1].p;
                    if (lastP.y > bottomBound) {
                        const shift = lastP.y - bottomBound;
                        sideArr.forEach(({ p }) => { p.y -= shift; });
                    }

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
        // Compute Y-axis label width based on the longest formatted value in the dataset
        const allYValues = chartData.flatMap((d: any) => keys.map((k: string) => Math.abs(d[k] || 0)));
        const maxYVal = allYValues.length ? Math.max(...allYValues) : 0;
        const maxYLabel = formatVal(yMax !== 'auto' ? yMax : maxYVal);
        const computedYAxisWidth = Math.max(45, Math.min(110, maxYLabel.length * 8 + 8));

        // Smart line label renderer — avoids overlap for close values
        const makeSmartLineLabel = (key: string, keyIdx: number) => (p: any) => {
            const { x, y, value, index } = p;
            if (value === null || value === undefined) return null;

            const isAbove = (() => {
                if (keys.length > 1) return keyIdx % 2 === 0;

                const allVals = chartData.map((d: any) => { const v = Number(d[key]); return isNaN(v) ? 0 : v; });
                const effectiveMin = yMin !== 'auto' ? (yMin as number) : Math.min(...allVals);
                const effectiveMax = yMax !== 'auto' ? (yMax as number) : Math.max(...allVals);
                const range = Math.max(effectiveMax - effectiveMin, 1);
                const pixelsPerUnit = 240 / range;
                const prevVal = index > 0 ? allVals[index - 1] : null;
                const nextVal = index < allVals.length - 1 ? allVals[index + 1] : null;
                const prevClose = prevVal !== null && Math.abs(value - prevVal) * pixelsPerUnit < 16;
                const nextClose = nextVal !== null && Math.abs(value - nextVal) * pixelsPerUnit < 16;
                if (prevClose || nextClose) return index % 2 === 0;
                return true;
            })();

            return (
                <text x={x} y={y + (isAbove ? -14 : 14)} textAnchor="middle" fill="#64748b" fontSize={11}>
                    {formatVal(value)}
                </text>
            );
        };

        switch (s.chartType) {
            case 'bar': {
                const isStacked = subType === 'stacked_v' || subType === 'stacked_h';
                const isHorizontal = subType === 'grouped_h' || subType === 'stacked_h';
                const yAxisWidth = isHorizontal
                    ? Math.min(200, Math.max(60, Math.max(...chartData.map((d: any) => String(d.name || '').length), 0) * 6.5))
                    : undefined;
                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <BarChart data={chartData} layout={isHorizontal ? 'vertical' : 'horizontal'} margin={chartMargin}>
                            {s.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={isHorizontal} horizontal={!isHorizontal} stroke="#E2E8F0" />}
                            {isHorizontal ? (
                                <>
                                    <XAxis type="number" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={xDomain} allowDataOverflow={hasCustomXDomain} />
                                    <YAxis type="category" dataKey="name" width={yAxisWidth} tick={{ ...axisTickStyle, width: yAxisWidth }} axisLine={axisLineStyle} tickLine={false} />
                                </>
                            ) : (
                                <>
                                    <XAxis type="category" dataKey="name" tick={dataTableEnabled ? false : axisTickStyle} axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} />
                                    <YAxis yAxisId="left" type="number" width={computedYAxisWidth} tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain} />
                                    {dualY && <YAxis yAxisId="right" orientation="right" type="number" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomainRight} allowDataOverflow={hasCustomYDomainRight} />}
                                </>
                            )}
                            {!isPrint && <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} formatter={(v: any, n: any) => [formatVal(v), n]} />}
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={s.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}
                            {keys.map((key: string, idx: number) => {
                                let labelPosition: any;
                                if (isStacked) labelPosition = isHorizontal ? 'center' : 'inside';
                                else labelPosition = isHorizontal ? 'right' : 'top';
                                const labelFill = isStacked ? '#fff' : '#64748b';
                                const seriesColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                const isSingleSeries = keys.length === 1 && !isStacked;
                                return (
                                    <Bar key={key} dataKey={key} yAxisId={!isHorizontal ? getYAxisId(key) : undefined} radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} fill={seriesColor} stackId={isStacked ? 'a' : undefined} isAnimationActive={false} activeBar={!isPrint ? { stroke: '#1e293b', strokeWidth: 2 } : undefined}>
                                        {isSingleSeries && chartData.map((entry: any, i: number) => (
                                            <Cell key={`cell-${i}`} fill={colors[entry.name] || seriesColor} />
                                        ))}
                                        {s.showLabels && <LabelList dataKey={key} position={labelPosition} style={{ fill: labelFill, fontSize: 11 }} formatter={formatVal} />}
                                    </Bar>
                                );
                            })}
                        </BarChart>
                    </ResponsiveContainer>
                );
            }
            case 'line': {
                const isArea = subType === 'area_basic' || subType === 'area_stacked';
                const isStackedArea = subType === 'area_stacked';
                const hasDots = subType === 'line_dots';
                const ChartComp = isArea ? AreaChart : LineChart;
                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <ChartComp data={chartData} margin={chartMargin}>
                            {s.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis dataKey="name" tick={dataTableEnabled ? false : axisTickStyle} axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} />
                            <YAxis yAxisId="left" width={computedYAxisWidth} tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain} />
                            {dualY && <YAxis yAxisId="right" orientation="right" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomainRight} allowDataOverflow={hasCustomYDomainRight} />}
                            {!isPrint && <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [formatVal(v), n]} />}
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={s.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}
                            {keys.map((key: string, idx: number) => {
                                const color = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                const yAxisId = getYAxisId(key);
                                if (isArea) return <Area key={key} type="monotone" dataKey={key} yAxisId={yAxisId} stackId={isStackedArea ? '1' : undefined} stroke={color} fill={color} fillOpacity={0.6} strokeWidth={2} dot={hasDots ? { r: 4 } : false} activeDot={!isPrint ? { r: 7, stroke: '#1e293b', strokeWidth: 2, fill: color } : false} isAnimationActive={false} label={s.showLabels ? makeSmartLineLabel(key, idx) : false} />;
                                return <Line key={key} type="monotone" dataKey={key} yAxisId={yAxisId} stroke={color} strokeWidth={3} dot={hasDots ? { r: 4, fill: color, strokeWidth: 2, stroke: '#fff' } : { r: 0 }} activeDot={!isPrint ? { r: 7, stroke: '#1e293b', strokeWidth: 2, fill: color } : false} isAnimationActive={false} label={s.showLabels ? makeSmartLineLabel(key, idx) : false} />;
                            })}
                        </ChartComp>
                    </ResponsiveContainer>
                );
            }
            case 'circular': {
                if (subType === 'radial_progress') {
                    const radialData = data.map((d: any, i: number) => ({ name: d.name, value: parseVal(d[keys[0]]), fill: colors[d.name] || CHART_PALETTE[i % CHART_PALETTE.length] }));
                    return (
                        <ResponsiveContainer width="99%" height="100%">
                            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="100%" barSize={12} data={radialData}>
                                <RadialBar background={{ fill: '#f1f5f9' }} dataKey="value" cornerRadius={10} isAnimationActive={false}
                                    label={s.showLabels ? (p: any) => <text x={p.x} y={p.y} textAnchor="middle" fill="#64748b" fontSize={11}>{formatVal(p.value)}</text> : false}
                                />
                                {!isPrint && <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [formatVal(v), n]} />}
                                {showRechartsLegend && <Legend verticalAlign="bottom" align={s.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}
                            </RadialBarChart>
                        </ResponsiveContainer>
                    );
                }
                const align = s.legendAlign || 'center';
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
                const internalPieLegend = showRechartsLegend ? renderPieLegend : () => null;
                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <PieChart margin={chartMargin}>
                            {!isPrint && <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [formatVal(v), n]} />}
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={s.legendAlign || 'center'} content={internalPieLegend} />}
                            <Pie
                                data={pieData} dataKey="value" nameKey="name"
                                cx="50%" cy={isSemi ? '75%' : '45%'}
                                outerRadius={dynamicOuterRadius}
                                innerRadius={dynamicInnerRadius}
                                isAnimationActive={false}
                                label={s.showLabels ? renderCustomPieLabel : false}
                                labelLine={false}
                                startAngle={isSemi ? 180 : 0}
                                endAngle={isSemi ? 0 : 360}
                                onMouseEnter={!isPrint ? (_, index) => setActiveIndex(index) : undefined}
                                onMouseLeave={!isPrint ? () => setActiveIndex(undefined) : undefined}
                            >
                                {pieData.map((entry: any, index: number) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={colors[entry.name] || CHART_PALETTE[index % CHART_PALETTE.length]}
                                        stroke="#fff"
                                        strokeWidth={2}
                                        style={!isPrint ? {
                                            opacity: activeIndex === undefined || activeIndex === index ? 1 : 0.3,
                                            transition: 'opacity 0.2s',
                                            outline: 'none',
                                        } : undefined}
                                    />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            }
            case 'composed': {
                const seriesTypes = s.seriesTypes || {};
                const isAreaBar = subType === 'composed_area_bar';
                const isAreaLine = subType === 'composed_area_line';
                const isStackedLine = subType === 'composed_stacked_line';
                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <ComposedChart data={chartData} margin={chartMargin}>
                            {s.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis dataKey="name" tick={dataTableEnabled ? false : axisTickStyle} axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} />
                            <YAxis yAxisId="left" width={computedYAxisWidth} tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain} />
                            {dualY && <YAxis yAxisId="right" orientation="right" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomainRight} allowDataOverflow={hasCustomYDomainRight} />}
                            {!isPrint && <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} formatter={(v: any, n: any) => [formatVal(v), n]} />}
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={s.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}
                            {keys.map((key: string, idx: number) => {
                                const color = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                const yAxisId = getYAxisId(key);
                                let t = seriesTypes[key];
                                if (!t) {
                                    if (idx === 0) t = isAreaBar || isAreaLine ? 'area' : 'bar';
                                    else if (idx === 1) t = isAreaBar ? 'area' : (isStackedLine ? 'bar' : 'line');
                                    else t = 'line';
                                }
                                if (t === 'area') return <Area key={key} type="monotone" dataKey={key} yAxisId={yAxisId} fill={color} stroke={color} fillOpacity={0.3} isAnimationActive={false} activeDot={!isPrint ? { r: 7, stroke: '#1e293b', strokeWidth: 2, fill: color } : false} label={s.showLabels ? makeSmartLineLabel(key, idx) : false} />;
                                if (t === 'bar') return <Bar key={key} dataKey={key} yAxisId={yAxisId} stackId={isStackedLine ? 'a' : undefined} barSize={isAreaBar ? 15 : 20} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} activeBar={!isPrint ? { stroke: '#1e293b', strokeWidth: 2 } : undefined}>{s.showLabels && <LabelList dataKey={key} position={isStackedLine ? 'inside' : 'top'} style={{ fill: isStackedLine ? '#fff' : '#64748b', fontSize: 11 }} formatter={formatVal} />}</Bar>;
                                return <Line key={key} type="monotone" dataKey={key} yAxisId={yAxisId} stroke={color} strokeWidth={3} dot={{ r: 4, fill: color, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} activeDot={!isPrint ? { r: 7, stroke: '#1e293b', strokeWidth: 2, fill: color } : false} label={s.showLabels ? makeSmartLineLabel(key, idx) : false} />;
                            })}
                        </ComposedChart>
                    </ResponsiveContainer>
                );
            }
            case 'scatter': {
                const isBubble = subType === 'bubble_basic';
                const shape = subType === 'scatter_star' ? 'star' : subType === 'scatter_diamond' ? 'diamond' : 'circle';
                const xTitle = s.xAxisTitle;
                const yTitle = s.yAxisTitle;
                const scatterMargin = { ...chartMargin, bottom: xTitle ? 30 : chartMargin.bottom, left: yTitle ? 0 : chartMargin.left };

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
                                {s.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />}
                                <XAxis type="number" dataKey="x" name={xKey} tickFormatter={formatVal} tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} domain={hasCustomXDomain ? xDomain : ['auto', 'auto']} allowDataOverflow={hasCustomXDomain} padding={xAxisPadding}>
                                    {xTitle && <Label value={xTitle} position="insideBottom" offset={-18} style={{ fill: '#475569', fontSize: 12, fontWeight: 600, textAnchor: 'middle' }} />}
                                </XAxis>
                                <YAxis type="number" dataKey="y" name={yKey} width={computedYAxisWidth} tickFormatter={formatVal} tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain}>
                                    {yTitle && <Label value={yTitle} angle={-90} position="insideLeft" offset={15} style={{ fill: '#475569', fontSize: 12, fontWeight: 600, textAnchor: 'middle' }} />}
                                </YAxis>
                                <ZAxis type="number" dataKey="z" range={[80, 1200]} />
                                {!isPrint && <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }} formatter={(v: any, n: any) => [formatVal(v), n]} />}
                                <Scatter data={bubbleData} fillOpacity={0.75} isAnimationActive={false} shape={shape}>
                                    {bubbleData.map((d: any, i: number) => <Cell key={i} fill={d.fill} />)}
                                    {s.showLabels && (
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
                            {s.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis type="category" dataKey="name" allowDuplicatedCategory={false} tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding}>
                                {xTitle && <Label value={xTitle} position="insideBottom" offset={-18} style={{ fill: '#475569', fontSize: 12, fontWeight: 600, textAnchor: 'middle' }} />}
                            </XAxis>
                            <YAxis type="number" dataKey="value" width={computedYAxisWidth} tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain}>
                                {yTitle && <Label value={yTitle} angle={-90} position="insideLeft" offset={15} style={{ fill: '#475569', fontSize: 12, fontWeight: 600, textAnchor: 'middle' }} />}
                            </YAxis>
                            <ZAxis type="number" dataKey="value" range={isBubble ? [60, 600] : [50, 50]} />
                            {!isPrint && <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3', stroke: '#cbd5e1' }} formatter={(v: any, n: any) => [formatVal(v), n]} />}
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={s.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}
                            {keys.map((key: string, idx: number) => {
                                const color = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                const scatterData = chartData.map((d: any) => ({ name: d.name, value: d[key] || 0 }));
                                return (
                                    <Scatter key={key} name={key} data={scatterData} fill={color} fillOpacity={isBubble ? 0.7 : 1} shape={shape} isAnimationActive={false}>
                                        {s.showLabels && <LabelList dataKey="value" position="top" fill="#64748b" fontSize={11} offset={10} />}
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
                            <PolarGrid stroke="#e2e8f0" gridType={isCircular ? 'circle' : 'polygon'} />
                            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <PolarRadiusAxis angle={30} domain={['auto', 'auto']} tick={false} axisLine={false} />
                            {!isPrint && <Tooltip contentStyle={tooltipStyle} />}
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={s.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}
                            {keys.map((key: string, idx: number) => {
                                const color = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                return <Radar key={key} name={key} dataKey={key} stroke={color} strokeWidth={isOutline ? 2 : 1} fill={isOutline ? 'transparent' : color} fillOpacity={0.5} isAnimationActive={false} label={s.showLabels ? { fill: '#64748b', fontSize: 11 } : false} />;
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
            className="element-block break-inside-avoid"
            style={{
                height: 'auto',
                marginTop: `${s.marginTop || 0}px`,
                marginBottom: `${s.marginBottom || 0}px`,
                border: 'none', cursor: 'default',
                display: 'flex', flexDirection: 'column',
            }}
        >
            <ElementLabel label={label} title={s.title} />
            {s.subtitle && (
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', textAlign: (s.subtitleAlign || 'left') as any, width: '100%' }}>
                    {s.subtitle}
                </div>
            )}
            <div ref={wrapperRef} style={{ width: '100%', height: `${chartAreaHeight}px`, flexShrink: 0, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: showTopLegend ? 'column' : 'row' }}>
                {showTopLegend && renderTopLegend()}
                <div style={{ flex: isRightLegend ? '0 0 62%' : '1', minWidth: 0, minHeight: 0, ...(showTopLegend ? {} : { height: '100%' }) }}>
                    {renderChart()}
                </div>
                {isRightLegend && s.showLegend && (
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
            {s.description && (
                <div
                    style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', width: '100%', fontStyle: 'italic' }}
                    dangerouslySetInnerHTML={{ __html: s.description }}
                />
            )}

            {s.source && (
                <div style={{ fontSize: '10px', color: '#1e293b', marginTop: '6px', width: '100%', whiteSpace: 'pre-wrap' }}>
                    {s.source}
                </div>
            )}
        </div>
    );
};

const MapBlockReadonly = ({ el }: any) => {
    const s = el.payload.settings || {};
    const data = el.payload.data || s.data || [];
    const baseColor = s.baseColor || '#3b82f6';
    const width = s.width || 100;

    const values = data.map((d: any) => parseFloat(d['Вредност'])).filter((v: number) => !isNaN(v));
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;

    const calculatedColors: any = {};
    const calculatedValues: any = {};
    data.forEach((d: any) => {
        calculatedValues[d.name] = d['Вредност'];
        const val = parseFloat(d['Вредност']);
        if (isNaN(val) || d['Вредност'] === '' || d['Вредност'] === undefined) {
            calculatedColors[d.name] = '#f1f5f9';
        } else {
            let opacity = 0.2;
            if (max > min) opacity = 0.2 + 0.8 * ((val - min) / (max - min));
            else if (max === min && values.length > 0) opacity = 1;
            calculatedColors[d.name] = hexToRgba(baseColor, opacity);
        }
    });

    const formatVal = (v: number) => new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 1 }).format(v);

    const legendItems: any[] = [];
    if (values.length > 0) {
        if (max === min) {
            legendItems.push({ color: hexToRgba(baseColor, 1), label: formatVal(min) });
        } else {
            const step = (max - min) / 3;
            legendItems.push({ color: hexToRgba(baseColor, 0.4), label: `${formatVal(min)} - ${formatVal(min + step)}` });
            legendItems.push({ color: hexToRgba(baseColor, 0.7), label: `${formatVal(min + step)} - ${formatVal(min + 2 * step)}` });
            legendItems.push({ color: hexToRgba(baseColor, 1), label: `${formatVal(min + 2 * step)} - ${formatVal(max)}` });
        }
    }
    legendItems.push({ color: '#f1f5f9', label: 'Нема података', isNoData: true });

    return (
        <div
            className="element-block element-block-map break-inside-avoid"
            style={{
                marginTop: `${s.marginTop || 0}px`,
                marginBottom: `${s.marginBottom || 0}px`,
                border: 'none', cursor: 'default',
            }}
        >
            <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden' }}>
                <div style={{ width: `${width}%`, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    <MapGraphic colors={calculatedColors} values={calculatedValues} />
                </div>
                {s.showLegend && (
                    <div style={{
                        position: 'absolute', bottom: '16px', left: '16px',
                        display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '16px',
                        background: 'rgba(255,255,255,0.95)', padding: '10px 14px',
                        borderRadius: '6px', border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)', zIndex: 10
                    }}>
                        {legendItems.map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    backgroundColor: item.isNoData ? '#ffffff' : item.color,
                                    border: item.isNoData ? '1px solid #cbd5e1' : 'none'
                                }} />
                                <span style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>{item.label}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- COVER PAGE COMPONENT ---

// Same-origin (frontend public/) namerno: tokom PDF export-a Browsershot učitava print
// stranicu sa FRONTEND_URL-a, a php artisan serve je single-threaded i blokiran unutar
// exportPdf() — pa svaki asset sa backend origin-a (localhost:8000) zablokira do timeout-a
// i korica ostane prazna. Sa relativnim URL-om slika stiže sa Vite-a, kao i ostali asseti.
export const COVER_IMAGE_URL = '/images/pdf-naslovna.svg';

export const CoverPage = ({ isPrint = false }: { isPrint?: boolean }) => (
    <div
        className="canvas-page"
        style={isPrint
            ? { boxShadow: 'none', border: 'none', pageBreakAfter: 'always', padding: 0, overflow: 'hidden' }
            : { padding: 0, overflow: 'hidden' }}
    >
        <img
            src={COVER_IMAGE_URL}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
    </div>
);

// --- DOCUMENT PAGE COMPONENT ---

export const DocumentPage = ({ page, pageIndex, globalFootnoteMap, elementLabelMap, isPrint = false, documentTitle, sectionTitle }: {
    page: any;
    pageIndex: number;
    globalFootnoteMap: Record<string, number>;
    elementLabelMap: Record<string, string>;
    isPrint?: boolean;
    documentTitle?: string;
    sectionTitle?: string;
}) => {
    const pageFootnotes = useMemo(() => buildPageFootnotes(page, globalFootnoteMap), [page, globalFootnoteMap]);

    return (
        <div
            className="canvas-page"
            style={isPrint ? { boxShadow: 'none', border: 'none', pageBreakAfter: 'always' } : undefined}
        >
            <div className="page-header">
                <div className="page-header-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', overflow: 'hidden', gap: '16px' }}>
                    <span style={{ flexShrink: 0, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {documentTitle || 'Annual Report'}
                    </span>
                    {sectionTitle && (
                        <span style={{ fontWeight: 400, opacity: 0.7, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                            {sectionTitle}
                        </span>
                    )}
                </div>
            </div>
            <div className="page-content">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', flexShrink: 0 }}>
                    {page.rows.map((row: any) => (
                        row.columns.length === 0 ? null : (
                            <div key={row.id} className="canvas-row break-inside-avoid" style={{ border: 'none' }}>
                                <div className="grid grid-cols-12 gap-0">
                                    {row.columns.map((col: any) => (
                                        <div key={col.id} className={`canvas-col ${col.widthClass}`} style={{ border: 'none' }}>
                                            {col.elements.map((el: any) => {
                                                const label = elementLabelMap[el.id] || '';
                                                if (el.type === 'text') return <TextBlockReadonly key={el.id} el={el} />;
                                                if (el.type === 'image') return <ImageBlockReadonly key={el.id} el={el} label={label} />;
                                                if (el.type === 'table') return <TableBlockReadonly key={el.id} el={el} label={label} />;
                                                if (el.type === 'chart') return <ChartBlockReadonly key={el.id} el={el} label={label} isPrint={isPrint} />;
                                                if (el.type === 'map') return <MapBlockReadonly key={el.id} el={el} />;
                                                return null;
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    ))}
                </div>
            </div>
            <div className="page-footnotes">
                {pageFootnotes.length > 0 && (
                    <div className="footnotes-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pageFootnotes.map(fn => (
                            <div key={fn.id} className="footnote-item" style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <span style={{ fontWeight: 700, flexShrink: 0, minWidth: '15px' }}>{fn.number}.</span>
                                <span style={{ wordBreak: 'break-word', flex: 1 }} dangerouslySetInnerHTML={{ __html: fn.text || '...' }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="page-footer">
                <div className="page-footer-inner">{pageIndex + 1}.</div>
            </div>
        </div>
    );
};
