import { useState, useEffect, useRef, useMemo, useLayoutEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { sanitizeHtml } from "../../utils/sanitizeHtml";
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    ComposedChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    RadialBarChart, RadialBar, ScatterChart, Scatter, ZAxis,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Label,
    useYAxisScale, useXAxisScale, usePlotArea, ZIndexLayer, DefaultZIndexes
} from "recharts";
import { CHART_PALETTE } from "./constants";
import { parseVal, formatChartValue, wrapLabelLines, buildPieRows } from "./utils";

// White "halo" behind data-value labels so the digits stay legible even when
// they sit on top of bars, lines, areas, the grid, or other labels.
const LABEL_HALO: CSSProperties = { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round' };

// Oznake vrednosti za linijske/površinske grafikone, postavljene da se NIKAD ne preklapaju.
// Mora biti identično readonly/PDF prikazu (DocumentPageView). Renderuje se kao dete
// <LineChart>/<AreaChart>, pa preko Recharts hookova dobija TAČNU skalu vrednost→piksel
// (umesto pretpostavke o visini grafikona, koja je varirala zbog legendi i dovodila do
// preklapanja — npr. Slika 14.26: 11,8 i 16,8). Za svaku x-kategoriju uzima sve tačke serija,
// sortira po y i pakuje oznake odozgo nadole sa minimalnim razmakom, pa ih po potrebi pomeri
// naviše da ne izađu iz grafikona.
const SmartLineLabels = ({ chartData, keys, formatVal, getYAxisId }: any) => {
    const yScaleLeft = useYAxisScale('left');
    const yScaleRight = useYAxisScale('right');
    const xScale = useXAxisScale();
    const plot = usePlotArea();
    if (!yScaleLeft || !xScale) return null;
    const top = plot ? plot.y : 0;
    const bottom = plot ? plot.y + plot.height : Infinity;
    const LH = 15;     // minimalni vertikalni razmak između naslaganih oznaka
    const ABOVE = 13;  // podrazumevano oznaka stoji ovoliko px iznad svoje tačke
    const els: any[] = [];
    chartData.forEach((row: any, i: number) => {
        const px = xScale(row.name, { position: 'middle' });
        if (px === undefined || px === null || isNaN(px as number)) return;
        const pts = keys
            .map((k: string) => {
                const v = Number(row[k]);
                if (!isFinite(v)) return null;
                const yScale = getYAxisId(k) === 'right' && yScaleRight ? yScaleRight : yScaleLeft;
                const py = yScale(v);
                if (py === undefined || py === null || isNaN(py as number)) return null;
                return { k, v, py: py as number, ly: 0 };
            })
            .filter(Boolean)
            .sort((a: any, b: any) => a.py - b.py);
        let last = -Infinity;
        pts.forEach((o: any) => {
            let ly = Math.max(o.py - ABOVE, last + LH);
            if (ly < top + 8) ly = top + 8;
            o.ly = ly;
            last = ly;
        });
        const overflow = (pts.length ? pts[pts.length - 1].ly : 0) - (bottom - 4);
        if (overflow > 0) pts.forEach((o: any) => { o.ly -= overflow; });
        pts.forEach((o: any) => {
            els.push(
                <text key={i + '-' + o.k} x={px} y={o.ly} textAnchor="middle"
                      fill="#334155" fontSize={11} fontWeight={600}
                      stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
                    {formatVal(o.v)}
                </text>
            );
        });
    });
    // Recharts 3.x slaže decu u zIndex slojeve preko portala: tačke linije/površine su na
    // sloju "scatter" (600), pa bi bez ovoga prekrile naše oznake (podrazumevani sloj 0) —
    // npr. tačka je zaklanjala broj 3,2. Sloj "label" (2000) drži oznake UVEK preko tačaka.
    return (
        <ZIndexLayer zIndex={DefaultZIndexes.label}>
            <g className="smart-line-labels">{els}</g>
        </ZIndexLayer>
    );
};

const CursorPreservingInput = ({ value, onChange, className, style, placeholder, type }: any) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const cursorRef = useRef<{ start: number; end: number } | null>(null);

    useLayoutEffect(() => {
        if (inputRef.current && cursorRef.current && document.activeElement === inputRef.current) {
            inputRef.current.setSelectionRange(cursorRef.current.start, cursorRef.current.end);
            cursorRef.current = null;
        }
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        cursorRef.current = { start: e.target.selectionStart ?? 0, end: e.target.selectionEnd ?? 0 };
        onChange(e);
    };

    return <input ref={inputRef} type={type} value={value} onChange={handleChange} className={className} style={style} placeholder={placeholder} />;
};

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

const RenderBars = ({ keys, colors, chartData, isStacked, isHorizontal, isLabelsShown, palette, formatter, getYAxisId }: any) => {
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
                        yAxisId={getYAxisId ? getYAxisId(key) : undefined}
                        radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                        fill={seriesColor}
                        stackId={isStacked ? "a" : undefined}
                        isAnimationActive={false}
                        activeBar={{ stroke: '#1e293b', strokeWidth: 2 }}
                    >
                        {isSingleSeries && chartData.map((entry: any, i: number) => (
                            // Single-series stubići se boje po REDU (kao legenda i swatch-evi u editoru),
                            // pa je fallback paleta po indeksu reda — ne seriesColor (uvek paleta[0]).
                            <Cell key={`cell-${i}`} fill={colors[entry.name] || palette[i % palette.length]} />
                        ))}
                        {isLabelsShown && (
                            <LabelList
                                dataKey={key}
                                position={labelPosition}
                                style={{ fill: labelFill, fontSize: 11, fontWeight: 600, ...(isStacked ? {} : LABEL_HALO) }}
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

    // Boja swatch-a po nazivu kategorije za PITU — mora da prati parčad (sortiranje opadajuće
    // po vrednosti), a NE redni broj reda u tabeli. Ranije je swatch koristio CHART_PALETTE[rIdx]
    // (neuređen indeks reda) dok parčad koriste sortirani indeks → boje u tabeli se nisu poklapale
    // sa piticom (prijava klijenta). Sada je izvor istine isti (buildPieRows).
    const pieColorByName: Record<string, string> = {};
    if (isPie) buildPieRows(data, keys, colors, CHART_PALETTE).forEach((r) => { pieColorByName[r.name] = r.color; });

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
        const newKey = `Novo ${keys.length + 1}`;
        const newKeys = [...keys, newKey];
        const newData = data.map((r: any) => ({ ...r, [newKey]: 0 }));

        let newSettingsParams = {};
        if (isComposed) {
            newSettingsParams = { seriesTypes: { ...(settings.seriesTypes || {}), [newKey]: 'line' } };
        }

        updateSettings(newSettingsParams, { keys: newKeys, data: newData });
    };

    const addRow = () => {
        const newRow: any = { name: `Region ${data.length + 1}` };
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
                                    title="Obriši kolonu"
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
                            <CursorPreservingInput
                                value={settings.xAxisLabel ?? ''}
                                placeholder="Oznaka"
                                onChange={(e: any) => updateSettings({ xAxisLabel: e.target.value })}
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
                                    <CursorPreservingInput value={k} onChange={(e: any) => handleKeyChange(i, e.target.value)} className="data-input" style={{ width: '100%' }} />

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
                                        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '12px', cursor: 'pointer', backgroundColor: isPie ? (pieColorByName[row.name] || CHART_PALETTE[rIdx % CHART_PALETTE.length]) : (colors[row.name] || CHART_PALETTE[rIdx % CHART_PALETTE.length]) }}
                                    >
                                        {settings.activeColorKey === row.name && <div style={{position:'absolute', inset:0, border:'2px solid #2563eb'}} />}
                                    </div>
                                )}
                                <CursorPreservingInput value={row.name} onChange={(e: any) => handleNameChange(rIdx, e.target.value)} className="data-input data-input-left" style={{ paddingLeft: isPerRowColor ? '20px' : '8px' }} />
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
                    <Plus size={14} /> Dodaj red
                </button>
            </div>
        </div>
    );
};

export const ChartElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart, onDragEnd, elementLabel }: any) => {
    const defaultSettings = el.payload.settings || {};
    const currentSettings = isSelected && selectedElement?.elementId === el.id ? selectedElement.settings : defaultSettings;

    const data = el.payload.data || currentSettings.data || [];
    const keys = el.payload.keys || currentSettings.keys || [];
    const colors = el.payload.colors || currentSettings.colors || {};
    const subType = el.payload.subChartType || selectedElement?.extraPayload?.subChartType || currentSettings.subChartType;

    // HARDKOD — SAMO za Sliku 7.1 (grupisani stubičasti grafikon, poglavlje "Regionalni roming").
    // Isti fix kao u preview/PDF komponenti (ChartBlockReadonly): Recharts 3.x IGNORIŠE `payload`
    // na <Legend> koja je dete grafikona i auto-generiše legendu obrnuto (ljubičasta pa plava) —
    // čak i kad mu se prosledi `payload` u redosledu keys-a (vidi legendProps niže). Zato SAMO za
    // ovu sliku preuzimamo iscrtavanje preko `content` propa (koji Recharts poštuje) i ređamo
    // stavke u originalnom redosledu serija (keys: plava pa ljubičasta). Ostali grafici netaknuti.
    const forceSlika71LegendOrder = elementLabel === 'Slika 7.1';
    const slika71LegendContent = () => (
        <ul style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px',
            justifyContent: currentSettings.legendAlign === 'left' ? 'flex-start' : currentSettings.legendAlign === 'right' ? 'flex-end' : 'center',
            listStyle: 'none', margin: 0, padding: 0, fontSize: '12px',
        }}>
            {keys.map((key: string, idx: number) => (
                <li key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                        <circle cx="5" cy="5" r="5" fill={colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length]} />
                    </svg>
                    <span style={{ color: '#1E293B', fontWeight: 600 }}>{key}</span>
                </li>
            ))}
        </ul>
    );

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

    // PERFORMANCE — odloženo (lazy) montiranje grafikona, isto kao na preview strani
    // (DocumentPageView). Editor iscrtava SVE strane tekuće sekcije odjednom, pa montiranje
    // svih Recharts grafikona istovremeno (SVG + ResponsiveContainer + ResizeObserver +
    // layout) zaledi browser pri ulasku u sekciju. Grafikon montiramo tek kad se približi
    // vidnom polju (IntersectionObserver, rootMargin 1200px). Mesto mu je rezervisano fiksnom
    // visinom `chartAreaHeight` na wrapper-u → nema pomeranja sadržaja. Ako je element izabran
    // (uređuje se u bočnom panelu), montiramo ga odmah bez obzira na poziciju.
    const [chartInView, setChartInView] = useState(false);
    useEffect(() => {
        if (chartInView) return;
        if (isSelected) { setChartInView(true); return; }
        const node = wrapperRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') { setChartInView(true); return; }
        const io = new IntersectionObserver((entries) => {
            if (entries.some(e => e.isIntersecting)) { setChartInView(true); io.disconnect(); }
        }, { rootMargin: '1200px 0px' });
        io.observe(node);
        return () => io.disconnect();
    }, [chartInView, isSelected]);

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

    // Horizontal bar charts: wrap long row labels onto multiple lines and grow
    // the chart vertically so rows never overlap and every label stays visible.
    const isHorizontalBar = currentSettings.chartType === 'bar' && (subType === 'grouped_h' || subType === 'stacked_h');
    // Levi žleb za nazive redova prati DUŽINU naziva (≈6.2px/karakter), a ne fiksni
    // procenat širine — inače kratki nazivi ("2021") dobiju ogroman žleb i ceo grafikon
    // se pomeri udesno. Ograničen je gornjom granicom (i % širine) pa se duži nazivi
    // prelamaju u više redova (renderHBarTick) umesto da šire žleb.
    // Gornja granica je 280px (isto kao u readonly/PDF prikazu — DocumentPageView): kod
    // grafikona sa mnogo redova i vrlo dugačkim nazivima uži žleb je terao najduži naziv u
    // previše redova, a Recharts svim redovima daje visinu najgoreg → grafikon ne stane na
    // jednu A4 stranu. Sa 280px najduži naziv staje u ≤3 reda. Cap "ugrize" tek za nazive
    // >~43 znaka (kraći su ograničeni članom `naziv*6.2+10`) — moramo držati isto u oba
    // prikaza da editor i PDF izgledaju identično.
    const hbarMaxNameLen = isHorizontalBar ? Math.max(0, ...chartData.map((d: any) => String(d.name ?? '').length)) : 0;
    const hbarLabelWidth = isHorizontalBar ? Math.round(Math.max(60, Math.min(280, chartWidth * 0.42, hbarMaxNameLen * 6.2 + 10))) : 0;
    const hbarCharsPerLine = Math.max(6, Math.floor((hbarLabelWidth - 10) / 6.2));
    const hbarMaxLines = isHorizontalBar
        ? Math.max(1, ...chartData.map((d: any) => wrapLabelLines(d.name, hbarCharsPerLine).length))
        : 1;
    const hbarRowHeight = Math.max(34, hbarMaxLines * 13 + 14);
    const hbarHeight = isHorizontalBar ? data.length * hbarRowHeight + 44 : 0;

    const baseChartHeight = isPie
        ? Math.max(180, Math.min(280, chartWidth))
        : isHorizontalBar
            ? Math.max(280, hbarHeight)
            : 280;

    // Category X-axis (vertical bar / line / composed / category scatter): uvek prikaži SVE
    // oznake (bez auto-preskakanja). Kad naziv ne staje u jedan red, biramo strategiju:
    //  • VODORAVNO prelomljeno u više redova — kada IMA MESTA (najduža reč staje u red pa se
    //    ne seče, red je dovoljno širok i staje u ≤3 reda), ili
    //  • ISKOŠENO (−35/−55°) — kada su slotovi preuski (mnogo kategorija), pa bi vodoravno
    //    lomljenje seklo reči / pravilo previše redova. Tako uvek ostaje čitljivo bez preklapanja.
    const xCatChart = !isPie && !isHorizontalBar && currentSettings.chartType !== 'radar';
    // Imena kategorija na X-osi sakrivamo SAMO ako ih korisnik eksplicitno ugasi
    // (toggle "Prikaži imena kategorija"). Default = prikaz, pa se vide i kada je uključena
    // tabela sa podacima ispod (ranije su se tu automatski gasila, što je klijent tražio da promenimo).
    const xLabelsHidden = currentSettings.showXAxisLabels === false;
    const xMaxNameLen = xCatChart ? Math.max(0, ...chartData.map((d: any) => String(d.name ?? '').length)) : 0;
    const xLongestWord = xCatChart ? Math.max(0, ...chartData.flatMap((d: any) => String(d.name ?? '').trim().split(/\s+/).map((w: string) => w.length))) : 0;
    const xPerCatPx = chartWidth / Math.max(1, chartData.length);
    const xCrowded = xCatChart && !xLabelsHidden && (xMaxNameLen * 6.6 + 6) > xPerCatPx;
    const xCharsPerLine = Math.max(1, Math.floor((xPerCatPx - 6) / 6.6));
    const xWrapLines = xCrowded ? Math.max(1, ...chartData.map((d: any) => wrapLabelLines(d.name, xCharsPerLine).length)) : 1;
    // "Ima mesta" za vodoravno lomljenje: red ≥6 znakova, najduža reč staje (bez sečenja), ≤3 reda.
    const xNeedsWrap = xCrowded && xCharsPerLine >= 6 && xCharsPerLine >= xLongestWord && xWrapLines <= 3;
    const xNeedsAngle = xCrowded && !xNeedsWrap;
    const xAngle = !xNeedsAngle ? 0 : ((xMaxNameLen * 6.6) > xPerCatPx * 2 ? -55 : -35);
    const xAngleHeight = xNeedsAngle ? Math.min(120, Math.round(xMaxNameLen * 6.6 * Math.sin(Math.abs(xAngle) * Math.PI / 180)) + 16) : 0;
    const xWrapHeight = xNeedsWrap ? Math.min(100, xWrapLines * 12 + 16) : 0;
    const xLabelHeight = Math.max(xAngleHeight, xWrapHeight);

    const legendItemCount = isPie ? data.length : keys.length;
    const itemsPerRow = Math.max(1, Math.min(6, Math.floor(chartWidth / 85)));
    const legendRows = Math.ceil(legendItemCount / itemsPerRow);

    // Total container height accounts for legend rows regardless of position
    const showAnyInternalLegend = showRechartsLegend || showTopLegend;
    const chartAreaHeight = baseChartHeight + (showAnyInternalLegend ? legendRows * 22 : 0) + xLabelHeight;

    // Custom vertical legend for right-side layout.
    // Za pie: koristi `pieData` (već sortirana po vrednosti desc) — tako boje iz palette
    // fallback-a odgovaraju indeksu Cell-a u Pie-u. Inače legenda i parčad odstupaju.
    const renderSideLegend = () => {
        const items = isPie
            ? pieData.map((d: any, i: number) => ({ label: d.name, color: colors[d.name] || CHART_PALETTE[i % CHART_PALETTE.length] }))
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

    // Dual Y-axis (right side)
    const dualY = !!currentSettings.dualYAxis;
    const yMinRight = currentSettings.yAxisMinRight !== undefined && currentSettings.yAxisMinRight !== '' ? Number(currentSettings.yAxisMinRight) : 'auto';
    const yMaxRight = currentSettings.yAxisMaxRight !== undefined && currentSettings.yAxisMaxRight !== '' ? Number(currentSettings.yAxisMaxRight) : 'auto';
    const yDomainRight: [any, any] = [yMinRight, yMaxRight];
    const hasCustomYDomainRight = yMinRight !== 'auto' || yMaxRight !== 'auto';
    const getYAxisId = (key: string) => (dualY && currentSettings.yAxisSide?.[key] === 'right') ? 'right' : 'left';

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
        // Pita: kategorije kao REDOVI sa swatch-em u boji svog parčeta (isti izvor istine kao
        // parčad i legenda — buildPieRows). Mora biti identično readonly/PDF prikazu
        // (DocumentPageView) da editor i export izgledaju isto.
        if (isPie) {
            const pieRows = buildPieRows(data, keys, colors, CHART_PALETTE);
            return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px', tableLayout: 'fixed' }}>
                    <tbody>
                        {pieRows.map((r) => (
                            <tr key={r.name} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '4px 8px', fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ width: '10px', height: '10px', backgroundColor: r.color, flexShrink: 0, display: 'inline-block', borderRadius: '2px' }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                    </span>
                                </td>
                                <td style={{ padding: '4px 8px', textAlign: 'right', fontSize: '11px', color: '#334155' }}>
                                    {formatVal(r.value)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            );
        }
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

        // Compute Y-axis label width based on the longest formatted value in the dataset
        const allYValues = chartData.flatMap((d: any) => keys.map((k: string) => Math.abs(d[k] || 0)));
        const maxYVal = allYValues.length ? Math.max(...allYValues) : 0;
        const maxYLabel = formatVal(yMax !== 'auto' ? yMax : maxYVal);
        const computedYAxisWidth = Math.max(45, Math.min(110, maxYLabel.length * 8 + 8));

        // Smart line label renderer — avoids overlap for close values
        const makeSmartLineLabel = (key: string, keyIdx: number) => (p: any) => {
            const { x, y, value, index } = p;
            if (value === null || value === undefined) return null;

            // Mora biti identično readonly/PDF prikazu (DocumentPageView.makeSmartLineLabel).
            let isAbove: boolean;
            if (keys.length > 1) {
                // Više serija: podrazumevano naizmenično gore/dole po indeksu serije.
                // ALI kada se na ISTOJ x-tački vrednosti dve+ serije jako približe, oznake bi se
                // preklopile (npr. Slika 14.26: 3,9 i 3,2 u Q4). Tada ih tretiramo kao klaster i
                // SLAŽEMO jednu iznad druge na FIKSNOM razmaku (16px), nezavisno od geometrije
                // grafikona — tako se NIKAD ne preklapaju. Grafikoni bez bliskih vrednosti ostaju
                // identični (klaster ima 1 člana → keyIdx%2 kao ranije).
                const allVals = chartData.flatMap((d: any) => keys.map((k: string) => Number(d[k])).filter((v: number) => !isNaN(v)));
                const effMin = yMin !== 'auto' ? (yMin as number) : Math.min(...allVals);
                const effMax = yMax !== 'auto' ? (yMax as number) : Math.max(...allVals);
                const pxPerUnit = 240 / Math.max(effMax - effMin, 1);
                const cluster = keys
                    .map((k: string, ki: number) => ({ ki, v: Number(chartData[index]?.[k]) }))
                    .filter((o: any) => !isNaN(o.v) && Math.abs(o.v - value) * pxPerUnit < 15)
                    .sort((a: any, b: any) => b.v - a.v);
                if (cluster.length > 1) {
                    // Rang u klasteru: 0 = najviša vrednost (gore na grafikonu).
                    const rank = cluster.findIndex((o: any) => o.ki === keyIdx);
                    const GAP = 16;
                    // Ista referentna y za sve članove → razmak među oznakama je tačno GAP px
                    // (bez obzira na to što je pxPerUnit približan) → preklapanje nemoguće.
                    const clusterTopY = y + (value - cluster[0].v) * pxPerUnit;
                    const clusterBottomY = y + (value - cluster[cluster.length - 1].v) * pxPerUnit;
                    // Podrazumevano: sve oznake IZNAD najviše tačke, naslagane na GAP px.
                    let labelY = clusterTopY - 13 - rank * GAP;
                    // Ako bi najgornja oznaka izašla iz grafikona, ceo klaster slažemo ISPOD
                    // najniže tačke (ista odluka u svakom pozivu → konzistentno).
                    const topMostLabelY = clusterTopY - 13 - (cluster.length - 1) * GAP;
                    if (topMostLabelY < 14) {
                        labelY = clusterBottomY + 16 + ((cluster.length - 1) - rank) * GAP;
                    }
                    return (
                        <text x={x} y={labelY} textAnchor="middle"
                              fill="#334155" fontSize={11} fontWeight={600}
                              stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
                            {formatVal(value)}
                        </text>
                    );
                }
                isAbove = keyIdx % 2 === 0;
            } else {
                // Single series: use pixel-proximity check
                const allVals = chartData.map((d: any) => { const v = Number(d[key]); return isNaN(v) ? 0 : v; });
                const effectiveMin = yMin !== 'auto' ? (yMin as number) : Math.min(...allVals);
                const effectiveMax = yMax !== 'auto' ? (yMax as number) : Math.max(...allVals);
                const range = Math.max(effectiveMax - effectiveMin, 1);
                const pixelsPerUnit = 240 / range; // approx inner chart height
                const prevVal = index > 0 ? allVals[index - 1] : null;
                const nextVal = index < allVals.length - 1 ? allVals[index + 1] : null;
                const prevClose = prevVal !== null && Math.abs(value - prevVal) * pixelsPerUnit < 16;
                const nextClose = nextVal !== null && Math.abs(value - nextVal) * pixelsPerUnit < 16;
                isAbove = (prevClose || nextClose) ? index % 2 === 0 : true;
            }

            // Never drop a label BELOW into the x-axis category-name band — that is
            // exactly where digits would overlap the names. Low points label above.
            // (Klasteri se obrađuju iznad i izlaze ranije, pa ih ovaj guard ne dotiče.)
            if (!isAbove && y > 200) isAbove = true;

            return (
                <text x={x} y={y + (isAbove ? -13 : 16)} textAnchor="middle"
                      fill="#334155" fontSize={11} fontWeight={600}
                      stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">
                    {formatVal(value)}
                </text>
            );
        };

        // (1) Vodoravna oznaka prelomljena u više redova (kada ima mesta) — centrirana ispod
        // svoje tačke; svaki naziv normalno orijentisan i vidljiv.
        const renderWrappedXTick = ({ x, y, payload }: any) => {
            const lines = wrapLabelLines(payload?.value, xCharsPerLine);
            const lineH = 12;
            return (
                <text x={x} y={y + 12} textAnchor="middle" fill="#64748b" fontSize={11}>
                    {lines.map((ln: string, i: number) => (
                        <tspan key={i} x={x} dy={i === 0 ? 0 : lineH}>{ln}</tspan>
                    ))}
                </text>
            );
        };
        // (2) Iskošena oznaka (kada su slotovi preuski) — svaki naziv ostaje vidljiv bez preklapanja.
        const renderAngledXTick = ({ x, y, payload }: any) => (
            <text x={x} y={y + 4} textAnchor="end" fill="#64748b" fontSize={11}
                  transform={`rotate(${xAngle}, ${x}, ${y + 4})`}>
                {String(payload?.value ?? '')}
            </text>
        );
        // Shared props for every category X-axis: interval=0 → show ALL labels (no auto-skipping);
        // reserve height + pick wrapped/angled tick only when crowded (izbor napravljen gore).
        const categoryXAxisProps: any = {
            interval: 0,
            tick: xLabelsHidden ? false : (xNeedsWrap ? renderWrappedXTick : (xNeedsAngle ? renderAngledXTick : axisTickStyle)),
            ...((xNeedsWrap || xNeedsAngle) ? { height: xLabelHeight } : {}),
        };

        switch (currentSettings.chartType) {
            case 'bar': {
                const isStacked = subType === 'stacked_v' || subType === 'stacked_h';
                const isHorizontal = subType === 'grouped_h' || subType === 'stacked_h';
                // Multi-line wrapped category labels for horizontal bars (no truncation/overlap).
                const renderHBarTick = ({ x, y, payload }: any) => {
                    const lines = wrapLabelLines(payload?.value, hbarCharsPerLine);
                    const lineH = 13;
                    const firstDy = -((lines.length - 1) * lineH) / 2 + 4;
                    return (
                        <text x={x} y={y} textAnchor="end" fill="#64748b" fontSize={11} fontWeight={500}>
                            {lines.map((ln: string, i: number) => (
                                <tspan key={i} x={x} dy={i === 0 ? firstDy : lineH}>{ln}</tspan>
                            ))}
                        </text>
                    );
                };
                return (
                    <ResponsiveContainer width="99%" height="100%">
                        <BarChart data={chartData} layout={isHorizontal ? "vertical" : "horizontal"} margin={chartMargin}>
                            {currentSettings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={isHorizontal} horizontal={!isHorizontal} stroke="#E2E8F0" />}
                            {isHorizontal ? (
                                <>
                                    <XAxis type="number" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={xDomain} allowDataOverflow={hasCustomXDomain} />
                                    <YAxis type="category" dataKey="name" width={hbarLabelWidth} interval={0} tick={renderHBarTick} axisLine={axisLineStyle} tickLine={false} />
                                </>
                            ) : (
                                <>
                                    <XAxis type="category" dataKey="name" axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} {...categoryXAxisProps} />
                                    <YAxis yAxisId="left" type="number" width={computedYAxisWidth} tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain} />
                                    {dualY && <YAxis yAxisId="right" orientation="right" type="number" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomainRight} allowDataOverflow={hasCustomYDomainRight} />}
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
                                // SAMO Slika 7.1: `payload` se ignoriše, pa preuzimamo iscrtavanje preko `content`
                                // da legenda ide plava→ljubičasta (redosled keys-a), umesto sortirano po vrednosti.
                                if (forceSlika71LegendOrder) legendProps.content = slika71LegendContent;
                                return <Legend {...legendProps} />;
                            })()}
                            <RenderBars keys={keys} colors={colors} chartData={chartData} isStacked={isStacked} isHorizontal={isHorizontal} isLabelsShown={currentSettings.showLabels} palette={CHART_PALETTE} formatter={formatVal} getYAxisId={!isHorizontal ? getYAxisId : undefined} />
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
                            <XAxis dataKey="name" axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} {...categoryXAxisProps} />
                            <YAxis yAxisId="left" width={computedYAxisWidth} tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain} />
                            {dualY && <YAxis yAxisId="right" orientation="right" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomainRight} allowDataOverflow={hasCustomYDomainRight} />}
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [formatVal(v), n]} />
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={currentSettings.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}
                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                const yAxisId = getYAxisId(key);
                                if (isArea) return (
                                    <Area
                                        key={key} type="monotone" dataKey={key} stackId={isStackedArea ? "1" : undefined}
                                        yAxisId={yAxisId}
                                        stroke={baseColor} fill={baseColor} fillOpacity={0.6} strokeWidth={2}
                                        dot={hasDots ? { r: 4 } : false}
                                        activeDot={{ r: 7, stroke: '#1e293b', strokeWidth: 2, fill: baseColor }}
                                        isAnimationActive={false}
                                        label={false}
                                    />
                                );
                                return (
                                    <Line
                                        key={key} type="monotone" dataKey={key} stroke={baseColor} strokeWidth={3}
                                        yAxisId={yAxisId}
                                        dot={hasDots ? { r: 4, fill: baseColor, strokeWidth: 2, stroke: '#fff' } : { r: 0 }}
                                        activeDot={{ r: 7, stroke: '#1e293b', strokeWidth: 2, fill: baseColor }}
                                        isAnimationActive={false}
                                        label={false}
                                    />
                                );
                            })}
                            {currentSettings.showLabels && <SmartLineLabels chartData={chartData} keys={keys} formatVal={formatVal} getYAxisId={getYAxisId} />}
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
                                    label={currentSettings.showLabels ? (p: any) => <text x={p.x} y={p.y} textAnchor="middle" fill="#334155" fontSize={11} fontWeight={600} stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{formatVal(p.value)}</text> : false}
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
                            <XAxis dataKey="name" axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} {...categoryXAxisProps} />
                            <YAxis yAxisId="left" width={computedYAxisWidth} tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain} />
                            {dualY && <YAxis yAxisId="right" orientation="right" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomainRight} allowDataOverflow={hasCustomYDomainRight} />}
                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} formatter={(v: any, n: any) => [formatVal(v), n]} />
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={currentSettings.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}

                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                const yAxisId = getYAxisId(key);

                                let typeToRender = currentSettings.seriesTypes?.[key];
                                if (!typeToRender) {
                                    if (idx === 0) typeToRender = isAreaLine || isAreaBar ? 'area' : 'bar';
                                    else if (idx === 1) typeToRender = isAreaBar ? 'area' : (isStackedLine ? 'bar' : 'line');
                                    else typeToRender = 'line';
                                }

                                if (typeToRender === 'area') {
                                    return <Area key={key} type="monotone" dataKey={key} yAxisId={yAxisId} fill={baseColor} stroke={baseColor} fillOpacity={0.3} isAnimationActive={false} activeDot={{ r: 7, stroke: '#1e293b', strokeWidth: 2, fill: baseColor }} label={currentSettings.showLabels ? makeSmartLineLabel(key, idx) : false} />;
                                }
                                if (typeToRender === 'bar') {
                                    return <Bar key={key} dataKey={key} yAxisId={yAxisId} stackId={isStackedLine ? "a" : undefined} barSize={isAreaBar ? 15 : 20} fill={baseColor} radius={[4, 4, 0, 0]} isAnimationActive={false} activeBar={{ stroke: '#1e293b', strokeWidth: 2 }}>{currentSettings.showLabels && <LabelList dataKey={key} position={isStackedLine ? 'inside' : 'top'} style={{ fill: isStackedLine ? '#fff' : '#64748b', fontSize: 11, fontWeight: 600, ...(isStackedLine ? {} : LABEL_HALO) }} formatter={formatVal} />}</Bar>;
                                }
                                return <Line key={key} type="monotone" dataKey={key} yAxisId={yAxisId} stroke={baseColor} strokeWidth={3} dot={{ r: 4, fill: baseColor, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} activeDot={{ r: 7, stroke: '#1e293b', strokeWidth: 2, fill: baseColor }} label={currentSettings.showLabels ? makeSmartLineLabel(key, idx) : false} />;
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
                                <YAxis type="number" dataKey="y" name={yKey} width={computedYAxisWidth} tickFormatter={formatVal} tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain}>
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
                            <XAxis type="category" dataKey="name" allowDuplicatedCategory={false} axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} {...categoryXAxisProps}>
                                {xTitle && <Label value={xTitle} position="insideBottom" offset={-18} style={{ fill: '#475569', fontSize: 12, fontWeight: 600, textAnchor: 'middle' }} />}
                            </XAxis>
                            <YAxis type="number" dataKey="value" width={computedYAxisWidth} tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain}>
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
                                        {currentSettings.showLabels && <LabelList dataKey="value" position="top" fontSize={11} offset={10} style={{ fill: '#334155', fontWeight: 600, ...LABEL_HALO }} />}
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
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)} onDragEnd={onDragEnd}
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
                    {chartInView ? renderChart() : null}
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
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentSettings.description) }}
                />
            )}

            {currentSettings.source && (
                <div style={{ fontSize: '10px', color: '#1e293b', marginTop: '6px', width: '100%', whiteSpace: 'pre-wrap' }}>
                    {currentSettings.source}
                </div>
            )}

            {isSelected && currentSettings.showDataEditor && (
                <DataEditorPortal anchorRef={blockRef}>
                    <DataEditorPopover settings={currentSettings} data={data} keys={keys} colors={colors} updateSettings={updateLocalSettings} />
                </DataEditorPortal>
            )}
        </div>
    );
};
