import { Fragment, memo, useEffect, useMemo, useRef, useState } from "react";
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    ComposedChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    RadialBarChart, RadialBar, ScatterChart, Scatter, ZAxis,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Label,
    useYAxisScale, useXAxisScale, usePlotArea, ZIndexLayer, DefaultZIndexes
} from "recharts";
import MapGraphic from "./MapGraphic.tsx";
import { extractFootnoteIds, hexToRgba, parseVal, formatChartValue, wrapLabelLines, buildPieRows } from "./CanvasEditor/utils";
import { CHART_PALETTE } from "./CanvasEditor/constants";

// White "halo" behind data-value labels so digits stay legible over bars,
// lines, areas, the grid, or other labels (keeps every value visible).
const LABEL_HALO: any = { paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeLinejoin: 'round' };

// Oznake vrednosti za linijske/površinske grafikone, postavljene da se NIKAD ne preklapaju.
// Renderuje se kao dete <LineChart>/<AreaChart>, pa preko Recharts hookova dobija TAČNU
// skalu vrednost→piksel (umesto pretpostavke o visini grafikona, koja je varirala zbog
// legendi i dovodila do preklapanja — npr. Slika 14.26: 11,8 i 16,8). Za svaku x-kategoriju
// uzima sve tačke serija, sortira po y i pakuje oznake odozgo nadole sa minimalnim razmakom,
// pa ih po potrebi pomeri naviše da ne izađu iz grafikona. Tako oznake na ISTOM x-u (jedino
// mesto gde se mogu horizontalno poklopiti) uvek imaju zajamčen vertikalni razmak.
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

// --- HELPERS ---

export function buildMaps(sections: any[]) {
    const elementLabelMap: Record<string, string> = {};
    const globalFootnoteOrder: string[] = [];

    sections.forEach((section, sIdx) => {
        const pages = section.canvas_data || [];
        let tableCount = 1;
        let mediaCount = 1;
        // Broj poglavlja: koristi section.order (autoritativan redni broj iz baze),
        // a ne poziciju u nizu — tako pojedinačni eksport jednog poglavlja zadržava
        // ispravan broj (npr. 6.1 umesto 1.1).
        const sectionNumber = (typeof section.order === 'number' && section.order > 0) ? section.order : (sIdx + 1);

        pages.forEach((page: any) => {
            page.rows.forEach((row: any) => {
                row.columns.forEach((col: any) => {
                    col.elements.forEach((el: any) => {
                        if (el.type === 'table') {
                            // Tabele sa sakrivenim nazivom se ne broje — nisu zasebne tabele,
                            // pa ne smeju da "preskoče" numeraciju vidljivih tabela.
                            if (!el.payload?.settings?.hideLabel) {
                                elementLabelMap[el.id] = `Tabela ${sectionNumber}.${tableCount}`;
                                tableCount++;
                            }
                        } else if (el.type === 'image' || el.type === 'chart' || el.type === 'map') {
                            elementLabelMap[el.id] = `Slika ${sectionNumber}.${mediaCount}`;
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

// Inline fusnote se čuvaju kao <sup data-footnote-id="X">[*]</sup> (placeholder); pravi broj
// se dodeljuje globalno (buildMaps → globalFootnoteMap). U readonly/print prikazu zato sadržaj
// svakog <sup> moramo da zamenimo stvarnim brojem [n], inače u PDF-u ostane zvezdica [*].
const applyFootnoteNumbers = (html: string, globalFootnoteMap: Record<string, number>): string => {
    if (!html || !globalFootnoteMap || html.indexOf('data-footnote-id') === -1) return html || '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    tmp.querySelectorAll('sup[data-footnote-id]').forEach((sup) => {
        const id = sup.getAttribute('data-footnote-id');
        const num = id ? globalFootnoteMap[id] : undefined;
        if (num != null) sup.textContent = `[${num}]`;
    });
    return tmp.innerHTML;
};

const TextBlockReadonly = ({ el, globalFootnoteMap }: any) => {
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
                dangerouslySetInnerHTML={{ __html: applyFootnoteNumbers(s.content || '', globalFootnoteMap) }}
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

const TableBlockReadonly = ({ el, label, globalFootnoteMap }: any) => {
    const s = el.payload.settings;
    const content = el.payload.sr?.content || {};
    const colsCount = s.columns || 1;
    const localWidths = (s.columnWidths && s.columnWidths.length === colsCount)
        ? s.columnWidths
        : Array(colsCount).fill(100 / colsCount);
    // Eksplicitne visine redova (px; 0/undefined = auto) — mirror editora za isti izgled u PDF-u.
    const rowHeights: number[] = s.rowHeights || [];
    return (
        <div
            className="element-block break-inside-avoid"
            style={{
                marginTop: `${s.marginTop || 0}px`,
                marginBottom: `${s.marginBottom || 0}px`,
                border: 'none', cursor: 'default',
            }}
        >
            {!s.hideLabel && <ElementLabel label={label} title={s.title} />}
            <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', borderRadius: '0', position: 'relative' }}>
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0, borderTop: '1px solid #e2e8f0', borderLeft: '1px solid #e2e8f0', background: 'white', borderRadius: '0' }}>
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
                                        borderRight: '1px solid #e2e8f0',
                                        borderBottom: '1px solid #e2e8f0',
                                        padding: '0.5rem',
                                        position: 'relative',
                                        backgroundColor: cellSt.backgroundColor || '#ffffff',
                                        textAlign: cellSt.alignment || 'left',
                                        verticalAlign: cellSt.verticalAlignment || 'top',
                                        color: cellSt.textColor || '#1E293B',
                                        height: rowHeights[rIdx] ? `${rowHeights[rIdx]}px` : undefined,
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
                                            dangerouslySetInnerHTML={{ __html: applyFootnoteNumbers(content[key] || '', globalFootnoteMap) }}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
            {/* Opis/izvor tabele (ispod) — mora da se prikaže i u PDF/readonly prikazu,
                identično editoru (TableBlock.tsx). Bez ovoga je izvor tabele nedostajao na PDF-u. */}
            {s.description && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', textAlign: 'left', width: '100%', fontStyle: 'italic' }}>
                    {s.description}
                </div>
            )}
        </div>
    );
};

const ChartBlockReadonly = memo(({ el, label, isPrint = false, lite = false }: any) => {
    const s = el.payload.settings || {};
    const data = el.payload.data || [];
    const keys = el.payload.keys || [];
    const colors = el.payload.colors || {};
    const subType = el.payload.subChartType || s.subChartType;

    // HARDKOD — SAMO za Sliku 7.1 (grupisani stubičasti grafikon u poglavlju "Regionalni roming").
    // Klijent traži da legenda ide PLAVA → LJUBIČASTA (isti redosled kao stubići: serija A pa B),
    // a ne obrnuto. Recharts 3.x baš za ovaj grafikon auto-generiše legendu OBRNUTO (ljubičasta pa
    // plava) i NE poštuje prosleđeni `payload` na <Legend> koja je dete grafikona — grafikon ga
    // pregazi. Zato SAMO za ovu sliku preuzimamo iscrtavanje legende preko `content` propa i
    // ređamo stavke u ORIGINALNOM redosledu serija (keys: A=plava, pa B=ljubičasta). Stil je
    // identičan podrazumevanoj donjoj legendi (krug + naziv). Svi ostali grafikoni su netaknuti.
    const forceSlika71LegendOrder = label === 'Slika 7.1';
    const slika71LegendContent = () => (
        <ul style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 16px',
            justifyContent: s.legendAlign === 'left' ? 'flex-start' : s.legendAlign === 'right' ? 'flex-end' : 'center',
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

    // PERFORMANCE — odloženo (lazy) montiranje grafikona. Recharts grafikon je daleko
    // najskuplji deo strane (SVG + ResponsiveContainer + ResizeObserver + layout), pa
    // kad ViewPage iscrta SVE strane svih poglavlja odjednom, montiranje stotina grafikona
    // zaledi browser pri ulasku u dokument. Zato grafikon montiramo tek kad se približi
    // vidnom polju (IntersectionObserver, rootMargin 1200px → montira se pre nego što se
    // vidi, bez praznog blica). Mesto mu je već rezervisano fiksnom visinom `chartAreaHeight`
    // na wrapper-u, pa nema pomeranja sadržaja kad se pravi grafikon ubaci. U PDF-u (isPrint)
    // i u sličicama (lite) ovo se NE primenjuje — PDF mora odmah da iscrta sve, a sličice
    // koriste jeftin statički placeholder (vidi render ispod).
    const [chartInView, setChartInView] = useState(isPrint);
    useEffect(() => {
        if (isPrint || lite || chartInView) return;
        const node = wrapperRef.current;
        if (!node || typeof IntersectionObserver === 'undefined') { setChartInView(true); return; }
        const io = new IntersectionObserver((entries) => {
            if (entries.some(e => e.isIntersecting)) { setChartInView(true); io.disconnect(); }
        }, { rootMargin: '1200px 0px' });
        io.observe(node);
        return () => io.disconnect();
    }, [isPrint, lite, chartInView]);

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

    // Horizontal bar charts: wrap long row labels onto multiple lines and grow
    // the chart vertically so rows never overlap and every label stays visible.
    const isHorizontalBar = s.chartType === 'bar' && (subType === 'grouped_h' || subType === 'stacked_h');
    // Levi žleb za nazive redova prati DUŽINU naziva (≈6.2px/karakter), a ne fiksni
    // procenat širine — inače kratki nazivi ("2021") dobiju ogroman žleb i ceo grafikon
    // se pomeri udesno. Ograničen je gornjom granicom (i % širine) pa se duži nazivi
    // prelamaju u više redova (renderHBarTick) umesto da šire žleb.
    // Gornja granica je 280px (a ne 190): kod grafikona sa mnogo redova i VRLO dugačkim
    // nazivima (npr. Slika 8.12 — 13 redova, najduži naziv 115 znakova) uži žleb je terao
    // najduži naziv u 5 redova, a Recharts SVIM redovima daje visinu najgoreg → 13×79px+
    // ≈1096px > 923px raspoložive visine A4 strane, pa grafikon ne stane na jednu stranu.
    // Sa 280px najduži naziv staje u ≤3 reda (red ~53px), pa ceo grafikon padne na ~758px
    // i staje na jednu stranu. Cap "ugrize" tek za nazive >~43 znaka (kraći su ograničeni
    // članom `naziv*6.2+10`), pa grafikoni sa kratkim/srednjim nazivima ostaju nepromenjeni.
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
    const xCatChart = !isPie && !isHorizontalBar && s.chartType !== 'radar';
    // Imena kategorija na X-osi sakrivamo SAMO ako ih korisnik eksplicitno ugasi
    // (toggle "Prikaži imena kategorija"). Default = prikaz, pa se vide i kada je uključena
    // tabela sa podacima ispod (ranije su se tu automatski gasila, što je klijent tražio da promenimo).
    const xLabelsHidden = s.showXAxisLabels === false;
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
    const chartAreaHeight = baseChartHeight + (showAnyInternalLegend ? legendRows * 22 : 0) + xLabelHeight;

    const pieData = (isPie && data.length && keys.length)
        ? [...chartData.map((d: any) => ({ name: d.name, value: d[keys[0]] || 0 }))].sort((a: any, b: any) => b.value - a.value)
        : [];

    const dynamicOuterRadius = Math.max(35, Math.min((chartWidth - 70) / 2, (baseChartHeight - 60) / 2)) * 0.85;
    const dynamicInnerRadius = isDoughnut ? dynamicOuterRadius * 0.6 : 0;

    // Za pie: prvo sortiramo po vrednosti desc (isto kao i Cell-i u Pie), pa tek tada
    // dodeljujemo palette fallback po sortiranom indeksu — inače legenda i parčad odstupaju.
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
        // Pita: jedna vrednost po kategoriji → kategorije idu kao REDOVI sa swatch-em u boji
        // svog parčeta (kanonski izračun iz buildPieRows: ista boja i isti redosled kao parčad
        // i legenda). Generička šema "redovi = serije (keys)" je za pitu pogrešna jer pita ima
        // samo jedan ključ (keys[0]) pa bi tabela prikazala 1 red sa bojom koja ne odgovara
        // nijednom parčetu — tačno mismatch koji je klijent prijavio.
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

            let isAbove: boolean;
            if (keys.length > 1) {
                // Više serija: podrazumevano naizmenično gore/dole po indeksu serije.
                // ALI kada se na ISTOJ x-tački vrednosti dve+ serije jako približe, njihove
                // oznake bi se preklopile (npr. Slika 14.26: 3,9 i 3,2 u Q4). Tada ih tretiramo
                // kao klaster i SLAŽEMO jednu iznad druge na FIKSNOM razmaku (16px), nezavisno
                // od geometrije grafikona — tako se NIKAD ne mogu preklopiti. Grafikoni bez
                // bliskih vrednosti ostaju identični (klaster ima 1 člana → keyIdx%2 kao ranije).
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
                    // Procena y najviše/najniže tačke klastera. Ista referenca za sve članove,
                    // pa je razmak među naslaganim oznakama tačno GAP px (bez obzira na to što
                    // je pxPerUnit približan) → preklapanje je nemoguće po konstrukciji.
                    const clusterTopY = y + (value - cluster[0].v) * pxPerUnit;
                    const clusterBottomY = y + (value - cluster[cluster.length - 1].v) * pxPerUnit;
                    // Podrazumevano: sve oznake IZNAD najviše tačke, naslagane na GAP px.
                    let labelY = clusterTopY - 13 - rank * GAP;
                    // Ako bi najgornja naslagana oznaka izašla iz grafikona, ceo klaster
                    // slažemo ISPOD najniže tačke (ista odluka u svakom pozivu → konzistentno).
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
                const allVals = chartData.map((d: any) => { const v = Number(d[key]); return isNaN(v) ? 0 : v; });
                const effectiveMin = yMin !== 'auto' ? (yMin as number) : Math.min(...allVals);
                const effectiveMax = yMax !== 'auto' ? (yMax as number) : Math.max(...allVals);
                const range = Math.max(effectiveMax - effectiveMin, 1);
                const pixelsPerUnit = 240 / range;
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

        switch (s.chartType) {
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
                        <BarChart data={chartData} layout={isHorizontal ? 'vertical' : 'horizontal'} margin={chartMargin}>
                            {s.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={isHorizontal} horizontal={!isHorizontal} stroke="#E2E8F0" />}
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
                            {!isPrint && <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} formatter={(v: any, n: any) => [formatVal(v), n]} />}
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={s.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} {...(forceSlika71LegendOrder ? { content: slika71LegendContent } : {})} />}
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
                                            // Single-series stubići se boje po REDU (kao legenda i swatch-evi u editoru),
                                            // pa je fallback paleta po indeksu reda — ne seriesColor (uvek paleta[0]).
                                            <Cell key={`cell-${i}`} fill={colors[entry.name] || CHART_PALETTE[i % CHART_PALETTE.length]} />
                                        ))}
                                        {s.showLabels && <LabelList dataKey={key} position={labelPosition} style={{ fill: labelFill, fontSize: 11, fontWeight: 600, ...(isStacked ? {} : LABEL_HALO) }} formatter={formatVal} />}
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
                            <XAxis dataKey="name" axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} {...categoryXAxisProps} />
                            <YAxis yAxisId="left" width={computedYAxisWidth} tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomain} allowDataOverflow={hasCustomYDomain} />
                            {dualY && <YAxis yAxisId="right" orientation="right" tickFormatter={formatVal} tick={axisTickStyle} axisLine={false} tickLine={false} domain={yDomainRight} allowDataOverflow={hasCustomYDomainRight} />}
                            {!isPrint && <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [formatVal(v), n]} />}
                            {showRechartsLegend && <Legend verticalAlign="bottom" align={s.legendAlign || 'center'} wrapperStyle={{ fontSize: '12px', paddingTop: '5px', paddingLeft: '24px' }} iconType="circle" formatter={renderLegendText} />}
                            {keys.map((key: string, idx: number) => {
                                const color = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                const yAxisId = getYAxisId(key);
                                if (isArea) return <Area key={key} type="monotone" dataKey={key} yAxisId={yAxisId} stackId={isStackedArea ? '1' : undefined} stroke={color} fill={color} fillOpacity={0.6} strokeWidth={2} dot={hasDots ? { r: 4 } : false} activeDot={!isPrint ? { r: 7, stroke: '#1e293b', strokeWidth: 2, fill: color } : false} isAnimationActive={false} label={false} />;
                                return <Line key={key} type="monotone" dataKey={key} yAxisId={yAxisId} stroke={color} strokeWidth={3} dot={hasDots ? { r: 4, fill: color, strokeWidth: 2, stroke: '#fff' } : { r: 0 }} activeDot={!isPrint ? { r: 7, stroke: '#1e293b', strokeWidth: 2, fill: color } : false} isAnimationActive={false} label={false} />;
                            })}
                            {s.showLabels && <SmartLineLabels chartData={chartData} keys={keys} formatVal={formatVal} getYAxisId={getYAxisId} />}
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
                                    label={s.showLabels ? (p: any) => <text x={p.x} y={p.y} textAnchor="middle" fill="#334155" fontSize={11} fontWeight={600} stroke="#fff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{formatVal(p.value)}</text> : false}
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
                            <XAxis dataKey="name" axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} {...categoryXAxisProps} />
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
                                if (t === 'bar') return <Bar key={key} dataKey={key} yAxisId={yAxisId} stackId={isStackedLine ? 'a' : undefined} barSize={isAreaBar ? 15 : 20} fill={color} radius={[4, 4, 0, 0]} isAnimationActive={false} activeBar={!isPrint ? { stroke: '#1e293b', strokeWidth: 2 } : undefined}>{s.showLabels && <LabelList dataKey={key} position={isStackedLine ? 'inside' : 'top'} style={{ fill: isStackedLine ? '#fff' : '#64748b', fontSize: 11, fontWeight: 600, ...(isStackedLine ? {} : LABEL_HALO) }} formatter={formatVal} />}</Bar>;
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
                            <XAxis type="category" dataKey="name" allowDuplicatedCategory={false} axisLine={axisLineStyle} tickLine={false} padding={xAxisPadding} {...categoryXAxisProps}>
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
                                        {s.showLabels && <LabelList dataKey="value" position="top" fontSize={11} offset={10} style={{ fill: '#334155', fontWeight: 600, ...LABEL_HALO }} />}
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
                {lite ? (
                    // Sličica (sidebar/drawer): jeftin statički placeholder umesto živog Recharts grafikona.
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '7%', padding: '10% 12%', background: '#f8fafc', borderRadius: '6px', boxSizing: 'border-box' }}>
                        {[0.5, 0.82, 0.62, 1, 0.72].map((h, i) => (
                            <div key={i} style={{ flex: 1, height: `${h * 100}%`, background: '#e2e8f0', borderRadius: '2px' }} />
                        ))}
                    </div>
                ) : !chartInView ? null : (
                    <>
                        {showTopLegend && renderTopLegend()}
                        <div style={{ flex: isRightLegend ? '0 0 62%' : '1', minWidth: 0, minHeight: 0, ...(showTopLegend ? {} : { height: '100%' }) }}>
                            {renderChart()}
                        </div>
                        {isRightLegend && s.showLegend && (
                            <div style={{ flex: '0 0 38%', display: 'flex', alignItems: 'center', height: '100%' }}>
                                {renderSideLegend()}
                            </div>
                        )}
                    </>
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
});

const MapBlockReadonly = ({ el, label }: any) => {
    const s = el.payload.settings || {};
    const data = el.payload.data || s.data || [];
    const baseColor = s.baseColor || '#3b82f6';
    const width = s.width || 100;

    const values = data.map((d: any) => parseFloat(d['Vrednost'])).filter((v: number) => !isNaN(v));
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;

    // Veći kontrast: niža donja granica + gama (>1) gura „manje aktivne" boje svetlije, pa
    // glavna (najjača) boja mnogo više iskače. Ista funkcija se koristi za mapu i za legendu.
    const opacityFor = (t: number) => 0.15 + 0.85 * Math.pow(Math.max(0, Math.min(1, t)), 1.8);

    const calculatedColors: any = {};
    const calculatedValues: any = {};
    data.forEach((d: any) => {
        calculatedValues[d.name] = d['Vrednost'];
        const val = parseFloat(d['Vrednost']);
        if (isNaN(val) || d['Vrednost'] === '' || d['Vrednost'] === undefined) {
            calculatedColors[d.name] = '#f1f5f9';
        } else {
            const opacity = max > min ? opacityFor((val - min) / (max - min)) : 1;
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
            legendItems.push({ color: hexToRgba(baseColor, opacityFor(1 / 6)), label: `${formatVal(min)} - ${formatVal(min + step)}` });
            legendItems.push({ color: hexToRgba(baseColor, opacityFor(1 / 2)), label: `${formatVal(min + step)} - ${formatVal(min + 2 * step)}` });
            legendItems.push({ color: hexToRgba(baseColor, opacityFor(5 / 6)), label: `${formatVal(min + 2 * step)} - ${formatVal(max)}` });
        }
    }
    legendItems.push({ color: '#f1f5f9', label: 'Nema podataka', isNoData: true });

    return (
        <div
            className="element-block element-block-map break-inside-avoid"
            style={{
                marginTop: `${s.marginTop || 0}px`,
                marginBottom: `${s.marginBottom || 0}px`,
                border: 'none', cursor: 'default',
            }}
        >
            <ElementLabel label={label} title={s.title} />
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
// VAŽNO: pune-strane pozadine su PNG (288 DPI), NE SVG. Chrome `page.pdf()` rasterizuje
// SVG koji je ubačen preko <img> na veličinu PDF strane u tačkama (~595×842 = 72 DPI),
// bez obzira na viewBox/width/height/deviceScaleFactor — pa logo i tekst ispadnu mutni.
// Rasterski <img> (PNG) se, naprotiv, ugrađuje u native rezoluciji → oštro. Ovi SVG-ovi
// su ionako "flatten-ovan" eksport (sadrže ugrađene bitmape + gradient + pattern fill),
// pa ih unapred rasterizujemo u PNG. Regeneracija (ako se SVG izmeni): otvori SVG preko
// <img width:794 height:1123 object-fit:cover> u headless Chrome-u sa deviceScaleFactor:3
// i `page.screenshot()` u istoimeni .png u ovom folderu.
export const COVER_IMAGE_URL = '/images/pdf-naslovna.png';        // legacy (stara korica sa utisnutim tekstom)
export const COVER_BG_URL   = '/images/pdf-naslovna-pozadina.png'; // nova pozadina korice (bez teksta)
export const COVER_LOGO_URL = '/images/ratel-logo.png';           // logo u donjem desnom uglu korice

// Korica (1. strana). Pozadina je slika BEZ teksta; naslov, veliki istaknuti tekst (npr. godina)
// i podnaslov se iscrtavaju kao živi tekst (admin ih definiše po dokumentu) na istim pozicijama i
// veličinama kao na ranijoj fiksnoj korici (navy #002D51, gore-levo). Logo ide u donji desni ugao.
// Naslov i veliki tekst poštuju prelome reda (pre-line) — admin ih može uneti u više redova.
export const CoverPage = ({ isPrint = false, title, big, subtitle }: {
    isPrint?: boolean;
    title?: string;
    big?: string;
    subtitle?: string;
}) => {
    const NAVY = '#002D51';
    const t = (title ?? '').trim();
    const b = (big ?? '').trim();
    const s = (subtitle ?? '').trim();
    return (
        <div
            className="canvas-page"
            style={isPrint
                ? { boxShadow: 'none', border: 'none', pageBreakAfter: 'always', padding: 0, overflow: 'hidden' }
                : { padding: 0, overflow: 'hidden' }}
        >
            <img
                src={COVER_BG_URL}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', zIndex: 0 }}
            />

            {/* Tekstualni sloj (gore-levo). Elementi se REĐAJU u koloni (flex) od fiksnog vrha, pa se
                veliki tekst i podnaslov automatski pomeraju naniže zavisno od broja redova naslova:
                kratak naslov → nema „zjapeće" praznine; dug naslov → nema preklapanja. Razmaci između
                blokova su mali i konstantni (margini), a broj redova i visine računa sam layout.
                Naslov i veliki tekst poštuju prelome reda (pre-line). Vrh i veličine usklađeni sa
                ranijom koricom. */}
            <div style={{ position: 'absolute', top: '120px', left: '62px', right: '70px', zIndex: 1, fontFamily: 'var(--font-sans)', color: NAVY, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                {t && (
                    <div style={{ fontSize: '50px', fontWeight: 800, lineHeight: 1.22, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'pre-line' }}>
                        {t}
                    </div>
                )}
                {b && (
                    <div style={{ fontSize: '128px', fontWeight: 800, lineHeight: 1, marginTop: '12px', whiteSpace: 'pre-line' }}>
                        {b}
                    </div>
                )}
                {s && (
                    <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', marginTop: '22px' }}>
                        {s}
                    </div>
                )}
            </div>

            {/* Logo — donji desni ugao */}
            <img
                src={COVER_LOGO_URL}
                alt="RATEL"
                style={{ position: 'absolute', right: '58px', bottom: '62px', width: '185px', height: 'auto', zIndex: 1, display: 'block' }}
            />
        </div>
    );
};

// --- FULL-PAGE SLIKA (puna A4 strana, npr. strana posle korice i kontakt na kraju) ---

// Strana odmah posle korice (pre Sadržaja) i poslednja (kontakt) strana — pune A4 slike.
export const SECOND_PAGE_IMAGE_URL = '/images/pdf-2.png';        // legacy (stara 2. strana sa utisnutim logom)
export const CONTACT_PAGE_IMAGE_URL = '/images/pdf-kontakt.png';
export const PAGE2_BG_URL   = '/images/pdf-2-pozadina.png';      // pozadina 2. strane (samo plavi gradijent)
export const PAGE2_LOGO_URL = '/images/ratel-logo-white.png';   // beli RATEL logo (vertikalni lockup)

export const FullPageImage = ({ src, isPrint = false }: { src: string; isPrint?: boolean }) => (
    <div
        className="canvas-page"
        style={isPrint
            ? { boxShadow: 'none', border: 'none', pageBreakAfter: 'always', padding: 0, overflow: 'hidden' }
            : { padding: 0, overflow: 'hidden' }}
    >
        <img
            src={src}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
    </div>
);

// 2. strana PDF-a: beli RATEL logo na plavoj pozadini, sa opcionim uvodnim tekstom (admin ga
// definiše po dokumentu). Bez teksta → logo je vertikalno centriran. Sa tekstom → flex-centriranje
// grupe (logo + tekst) automatski pomera logo malo IZNAD sredine, a uvodni tekst (beo, srednje
// veličine) stoji centralno ispod njega. Tekst poštuje prelome reda (pre-line).
export const IntroLogoPage = ({ isPrint = false, introText }: { isPrint?: boolean; introText?: string }) => {
    const text = (introText ?? '').trim();
    return (
        <div
            className="canvas-page"
            style={isPrint
                ? { boxShadow: 'none', border: 'none', pageBreakAfter: 'always', padding: 0, overflow: 'hidden' }
                : { padding: 0, overflow: 'hidden' }}
        >
            <img
                src={PAGE2_BG_URL}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', zIndex: 0 }}
            />
            <div style={{ position: 'relative', zIndex: 1, height: '100%', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 90px', fontFamily: 'var(--font-sans)' }}>
                <img src={PAGE2_LOGO_URL} alt="RATEL" style={{ width: '210px', height: 'auto', display: 'block' }} />
                {text && (
                    <div style={{ marginTop: '48px', color: '#ffffff', fontSize: '23px', lineHeight: 1.6, textAlign: 'center', whiteSpace: 'pre-line', maxWidth: '560px', fontWeight: 500 }}>
                        {text}
                    </div>
                )}
            </div>
        </div>
    );
};

// --- SADRŽAJ (TABLE OF CONTENTS) PAGE ---

// Pozadinska slika za "Sadržaj" stranicu. Trenutno prazno — korisnik će kasnije dodati
// sliku (npr. staviti fajl u frontend `public/images/` i ovde upisati '/images/pdf-sadrzaj.svg').
// Kada se postavi, PrintView je automatski preload-uje pre snimanja PDF-a (kao i koricu),
// a komponenta ispod je render-uje kao pozadinski sloj ispod teksta.
// Pozadinska slika strane "Sadržaj". Sadrži svu dekoraciju (gornju plavu liniju, talasasti
// pattern, ugaone akcente) — mi preko nje samo iscrtavamo tekst. PrintView je preload-uje.
export const TOC_BACKGROUND_URL = '/images/pdf-sadrzaj.png';

// Boja teksta preuzeta iz primera (pdf-sadrzaj-primer.svg / pdf-sekcija-primer.svg).
const NAVY = '#002D51';

// Stavke sadržaja: redni broj sekcije, naziv i globalni broj strane na kojoj ona počinje.
export type TocEntry = { number: number; title: string; page: number };

// Pozicije su preslikane iz primera: SVG je A4 na 595×842, canvas-page je 794×1123 (faktor
// ×1.334). Naslov "SADRŽAJ" gore-levo iznad plave linije iz pozadine; stavke ispod, sa brojem
// strane poravnatim uz desnu ivicu (bez tačkica). Dug naziv se prelama, broj ostaje u 1. redu.
export const TableOfContents = ({ entries, isPrint = false }: {
    entries: TocEntry[];
    isPrint?: boolean;
}) => (
    <div
        className="canvas-page"
        style={isPrint
            ? { boxShadow: 'none', border: 'none', pageBreakAfter: 'always', padding: 0, overflow: 'hidden' }
            : { padding: 0, overflow: 'hidden' }}
    >
        {TOC_BACKGROUND_URL && (
            <img
                src={TOC_BACKGROUND_URL}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', zIndex: 0 }}
            />
        )}

        {/* Tekstualni sloj iznad pozadine */}
        <div style={{ position: 'relative', zIndex: 1, height: '100%', fontFamily: 'var(--font-sans)' }}>
            <h1 style={{ position: 'absolute', top: '96px', left: '96px', margin: 0, fontSize: '32px', fontWeight: 800, letterSpacing: '2px', color: NAVY, lineHeight: 1 }}>
                SADRŽAJ
            </h1>

            <div style={{ position: 'absolute', top: '212px', left: '96px', right: '63px', display: 'flex', flexDirection: 'column' }}>
                {entries.map((entry, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', marginBottom: '22px', fontSize: '18px', lineHeight: 1.45, color: NAVY }}>
                        <span style={{ fontWeight: 600 }}>
                            {entry.number}. {entry.title}
                        </span>
                        <span style={{ flexShrink: 0, fontWeight: 700, textAlign: 'right' }}>
                            {entry.page}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// --- NASLOVNA STRANA SEKCIJE (section divider) ---

// Pozadinska slika naslovne strane sekcije. Sadrži talasasti pattern i plavi trougao dole-desno;
// mi preko nje iscrtavamo samo naslov. PrintView je preload-uje pre snimanja PDF-a (kao koricu).
export const SECTION_TITLE_BACKGROUND_URL = '/images/pdf-sekcija.png';

// Naslovna strana sekcije — "N. Naziv" levo poravnato u gornjoj trećini strane, sa visećim
// uvlačenjem (broj u levoj koloni, naslov se prelama poravnat udesno od broja). Boja i pozicije
// preslikane iz pdf-sekcija-primer.svg (SVG 595×842 → canvas 794×1123, faktor ×1.334).
// Zauzima celu jednu PDF stranu (pageBreakAfter).
export const SectionTitlePage = ({ number, title, isPrint = false }: { number: number; title: string; isPrint?: boolean }) => (
    <div
        className="canvas-page"
        style={isPrint
            ? { boxShadow: 'none', border: 'none', pageBreakAfter: 'always', padding: 0, overflow: 'hidden' }
            : { padding: 0, overflow: 'hidden' }}
    >
        {SECTION_TITLE_BACKGROUND_URL && (
            <img
                src={SECTION_TITLE_BACKGROUND_URL}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', zIndex: 0 }}
            />
        )}

        {/* Naslov: broj u fiksnoj levoj koloni (79px), naslov počinje na 138px i prelama se. */}
        <div style={{ position: 'relative', zIndex: 1, height: '100%', fontFamily: 'var(--font-sans)' }}>
            <div style={{ position: 'absolute', top: '188px', left: '79px', display: 'flex', alignItems: 'flex-start' }}>
                <span style={{ width: '59px', flexShrink: 0, fontSize: '40px', fontWeight: 800, color: NAVY, lineHeight: 1.25 }}>
                    {number}.
                </span>
                <span style={{ maxWidth: '340px', fontSize: '40px', fontWeight: 800, color: NAVY, lineHeight: 1.25 }}>
                    {title}
                </span>
            </div>
        </div>
    </div>
);

// --- NAPOMENA / "O PODACIMA" STRANA (pre Sadržaja) ---

// Samostalna strana sa napomenom o izvoru i odgovornosti za podatke. Ubacuje se u export
// odmah posle RATEL logo strane, a pre Sadržaja. Po dogovoru ("stil kao ostale strane"),
// koristi dekorativnu pozadinu naslovne strane sekcije (talasasti pattern); tekst je u gornjoj
// trećini strane, navy bojom, obostrano poravnat (justify), bez naslova. Pozadina je u zasebnoj konstanti
// da bi se lako zamenila kada stigne tačan Figma dizajn ove strane.
export const DISCLAIMER_BACKGROUND_URL = SECTION_TITLE_BACKGROUND_URL;

// Tekst napomene (verbatim od klijenta). Svaki string je jedan pasus.
export const DISCLAIMER_PARAGRAPHS = [
    'Ovaj izveštaj se zasniva na podacima koje Regulatoru dostavljaju privredni subjekti koji obavljaju delatnost elektronskih komunikacija i poštanski operatori, u skladu sa važećim propisima.',
    'Za tačnost, potpunost i verodostojnost tih podataka su odgovorni subjekti koji ih dostavljaju.',
    'U pojedinim slučajevima moguća su naknadna ažuriranja i korekcije podataka od strane subjekata koji ih dostavljaju, što može dovesti do odstupanja u odnosu na prethodno objavljene vrednosti.',
];

// 3. strana PDF-a (Napomena). `text` (admin po dokumentu) → svaki red je jedan pasus; ako je
// prazno, koristi se podrazumevani DISCLAIMER_PARAGRAPHS (postojeće ponašanje). Datum poslednje
// izmene NIJE više ovde — sada ide u footer poslednje strane svake sekcije (vidi DocumentPage).
export const DisclaimerPage = ({ isPrint = false, text }: { isPrint?: boolean; text?: string }) => {
    const paragraphs = (text ?? '').trim()
        ? (text as string).split('\n').map(s => s.trim()).filter(Boolean)
        : DISCLAIMER_PARAGRAPHS;
    return (
        <div
            className="canvas-page"
            style={isPrint
                ? { boxShadow: 'none', border: 'none', pageBreakAfter: 'always', padding: 0, overflow: 'hidden' }
                : { padding: 0, overflow: 'hidden' }}
        >
            {DISCLAIMER_BACKGROUND_URL && (
                <img
                    src={DISCLAIMER_BACKGROUND_URL}
                    alt=""
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block', zIndex: 0 }}
                />
            )}

            {/* Tekstualni sloj iznad pozadine — gornja trećina, čista zona iznad/oko talasastog pattern-a. */}
            <div style={{ position: 'relative', zIndex: 1, height: '100%', fontFamily: 'var(--font-sans)' }}>
                <div style={{ position: 'absolute', top: '170px', left: '96px', right: '110px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    {paragraphs.map((p, i) => (
                        <p key={i} style={{ margin: 0, fontSize: '17px', lineHeight: 1.7, color: NAVY, textAlign: 'justify' }}>
                            {p}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- DOCUMENT PAGE COMPONENT ---

export const DocumentPage = memo(({ page, pageIndex, globalFootnoteMap, elementLabelMap, isPrint = false, documentTitle, sectionTitle, lite = false, footerDate }: {
    page: any;
    pageIndex: number;
    globalFootnoteMap: Record<string, number>;
    elementLabelMap: Record<string, string>;
    isPrint?: boolean;
    documentTitle?: string;
    sectionTitle?: string;
    lite?: boolean;
    footerDate?: string;   // već formatiran datum poslednje izmene sekcije — samo na poslednjoj strani sekcije (PDF)
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
                        <span style={{ fontWeight: 400, opacity: 0.7, minWidth: 0, overflow: 'hidden', textAlign: 'right', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'normal', lineHeight: 1.25, wordBreak: 'break-word' }}>
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
                                                const node =
                                                    el.type === 'text' ? <TextBlockReadonly el={el} globalFootnoteMap={globalFootnoteMap} /> :
                                                    el.type === 'image' ? <ImageBlockReadonly el={el} label={label} /> :
                                                    el.type === 'table' ? <TableBlockReadonly el={el} label={label} globalFootnoteMap={globalFootnoteMap} /> :
                                                    el.type === 'chart' ? <ChartBlockReadonly el={el} label={label} isPrint={isPrint} lite={lite} /> :
                                                    el.type === 'map' ? <MapBlockReadonly el={el} label={label} /> : null;
                                                if (!node) return null;
                                                // PDF (isPrint) keeps the exact original DOM — no wrapper.
                                                // Preview pages get a data-element-id wrapper so the document
                                                // search (ViewPage/CollectionPage/GroupPreviewPage) can highlight + scroll.
                                                return isPrint
                                                    ? <Fragment key={el.id}>{node}</Fragment>
                                                    : <div key={el.id} data-element-id={el.id} style={{ position: 'relative' }}>{node}</div>;
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
                {footerDate && (
                    <div style={{ position: 'absolute', bottom: '22px', left: '50px', fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>
                        Poslednji put izmenjeno {footerDate}
                    </div>
                )}
                <div className="page-footer-inner">{pageIndex + 1}.</div>
            </div>
        </div>
    );
});
