import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axiosClient from "../axios-client";
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    ComposedChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    RadialBarChart, RadialBar, ScatterChart, Scatter, ZAxis,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import MapGraphic from "../components/MapGraphic.tsx";

const CHART_PALETTE = ['#8b98ff', '#34d399', '#fef3c7', '#2563eb', '#1e3a8a', '#f59e0b', '#e11d48'];

// --- READ-ONLY ELEMENTI (bez ikakvih onClick, isSelected, i onDrag događaja) ---

const RenderBars = ({ keys, colors, isStacked, isLabelsShown, palette }: any) => (
    <>
        {keys.map((key: string, idx: number) => (
            <Bar
                key={key} dataKey={key} radius={[4, 4, 0, 0]} fill={colors[key] || palette[idx % palette.length]}
                stackId={isStacked ? "a" : undefined} isAnimationActive={false}
                label={isLabelsShown ? { position: isStacked ? 'inside' : 'top', fill: isStacked ? '#ffffff' : '#64748b', fontSize: 11 } : false}
            />
        ))}
    </>
);

const TextElementBlockReadonly = ({ el }: any) => {
    const settings = el.payload.settings;
    return (
        <div
            className="w-full p-1.5"
            style={{
                display: 'flex', flexDirection: 'column',
                justifyContent: settings.verticalAlignment === 'top' ? 'flex-start' : settings.verticalAlignment === 'bottom' ? 'flex-end' : 'center',
                textAlign: settings.alignment, color: settings.color,
                fontSize: settings.type === 'headline' ? '24px' : '16px',
                fontWeight: settings.bold ? 'bold' : 'normal'
            }}
            dangerouslySetInnerHTML={{ __html: settings.content || '' }}
        />
    );
};

const ImageElementBlockReadonly = ({ el }: any) => {
    const settings = el.payload.settings;
    if (!settings.url) return null; // Ne crtamo placeholder za upload u PDF-u
    return (
        <div className={`flex flex-col w-full p-1.5 ${settings.alignment === 'left' ? 'items-start text-left' : settings.alignment === 'right' ? 'items-end text-right' : 'items-center text-center'}`}>
            <img src={settings.url} alt={settings.altText} className="max-w-full h-auto object-contain mx-auto rounded-lg" />
            {settings.altText && <span className="text-sm italic mt-2.5 block text-slate-600">{settings.altText}</span>}
        </div>
    );
};

const TableElementBlockReadonly = ({ el }: any) => {
    const settings = el.payload.settings;
    const content = el.payload.sr?.content || {};
    return (
        <div className="w-full p-1.5">
            <table className="w-full border-collapse border border-slate-300 bg-white shadow-sm rounded-lg overflow-hidden">
                <tbody>
                {Array.from({ length: settings.rows || 1 }).map((_, rIdx) => (
                    <tr key={`row-${rIdx}`}>
                        {Array.from({ length: settings.columns || 1 }).map((_, cIdx) => {
                            const key = `${rIdx}_${cIdx}`;
                            const cellSt = settings.cells?.[key] || {};
                            return (
                                <td
                                    key={`cell-${key}`}
                                    className="border border-slate-200 p-3 min-w-[100px]"
                                    style={{ backgroundColor: cellSt.backgroundColor || '#ffffff', textAlign: cellSt.alignment || 'left', verticalAlign: cellSt.verticalAlignment || 'top' }}
                                >
                                    <div
                                        className="min-h-[24px] text-sm text-slate-700"
                                        style={{ fontWeight: cellSt.type === 'headline' ? 'bold' : 'normal', fontSize: cellSt.type === 'headline' ? '15px' : '14px' }}
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
    );
};

const ChartElementBlockReadonly = ({ el }: any) => {
    const settings = el.payload.settings || {};
    const data = el.payload.data || [];
    const keys = el.payload.keys || [];
    const colors = el.payload.colors || {};
    const subType = el.payload.subChartType || settings.subChartType;

    if (!data.length || !keys.length) return null;

    const axisTickStyle = { fontSize: 12, fill: '#64748b' };
    const axisLineStyle = { stroke: '#cbd5e1' };

    const renderChart = () => {
        switch (settings.chartType) {
            case 'bar': {
                const isStacked = subType === 'stacked_v' || subType === 'stacked_h';
                const isHorizontal = subType === 'grouped_h' || subType === 'stacked_h';
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} layout={isHorizontal ? "vertical" : "horizontal"} margin={{ top: 10, right: isHorizontal ? 30 : 10, left: -20, bottom: 0 }}>
                            {settings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={isHorizontal} horizontal={!isHorizontal} stroke="#E2E8F0" />}
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
                            {settings.showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} iconType="circle" />}
                            <RenderBars keys={keys} colors={colors} isStacked={isStacked} isLabelsShown={settings.showLabels} palette={CHART_PALETTE} />
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
                    <ResponsiveContainer width="100%" height="100%">
                        <ChartComponent data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            {settings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis dataKey="name" tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} />
                            <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                            {settings.showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} iconType="circle" />}
                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                if (isArea) return <Area key={key} type="monotone" dataKey={key} stackId={isStackedArea ? "1" : undefined} stroke={baseColor} fill={baseColor} fillOpacity={0.6} strokeWidth={2} dot={hasDots ? { r: 4 } : false} activeDot={false} isAnimationActive={false} />;
                                return <Line key={key} type="monotone" dataKey={key} stroke={baseColor} strokeWidth={3} dot={hasDots ? { r: 4, fill: baseColor, strokeWidth: 2, stroke: '#fff' } : { r: 0 }} activeDot={false} isAnimationActive={false} />;
                            })}
                        </ChartComponent>
                    </ResponsiveContainer>
                );
            }
            case 'circular': {
                if (subType === 'radial_progress') {
                    const radialData = data.map((d: any, i: number) => ({ name: d.name, value: Number(d[keys[0]]) || 0, fill: colors[d.name] || CHART_PALETTE[i % CHART_PALETTE.length] }));
                    return (
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="100%" barSize={12} data={radialData}>
                                <RadialBar background={{ fill: '#f1f5f9' }} dataKey="value" cornerRadius={10} isAnimationActive={false} />
                                {settings.showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />}
                            </RadialBarChart>
                        </ResponsiveContainer>
                    );
                }
                const isDoughnut = subType === 'doughnut_basic' || subType === 'semicircle_doughnut';
                const pieData = data.map((d: any) => ({ name: d.name, value: Number(d[keys[0]]) || 0 }));
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                            {settings.showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />}
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={isDoughnut ? 60 : 0} isAnimationActive={false} label={settings.showLabels ? { fill: '#64748b', fontSize: 11 } : false} startAngle={subType === 'semicircle_doughnut' ? 180 : 0} endAngle={subType === 'semicircle_doughnut' ? 0 : 360}>
                                {pieData.map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={colors[entry.name] || CHART_PALETTE[index % CHART_PALETTE.length]} stroke="#fff" strokeWidth={2}/>)}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
            }
            case 'composed': {
                const hasArea = subType === 'composed_area_bar';
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            {settings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis dataKey="name" tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} />
                            <YAxis tick={axisTickStyle} axisLine={false} tickLine={false} />
                            {settings.showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} iconType="circle" />}
                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                if (idx === 0) return <Bar key={key} dataKey={key} barSize={hasArea ? 15 : 20} fill={baseColor} radius={[4, 4, 0, 0]} isAnimationActive={false} />;
                                if (hasArea && idx === 1) return <Area key={key} type="monotone" dataKey={key} fill={baseColor} stroke={baseColor} fillOpacity={0.3} isAnimationActive={false} />;
                                return <Line key={key} type="monotone" dataKey={key} stroke={baseColor} strokeWidth={3} dot={{ r: 4, fill: baseColor, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} />;
                            })}
                        </ComposedChart>
                    </ResponsiveContainer>
                );
            }
            case 'scatter': {
                const isBubble = subType === 'bubble_basic';
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            {settings.showGrid && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />}
                            <XAxis type="category" dataKey="name" allowDuplicatedCategory={false} tick={axisTickStyle} axisLine={axisLineStyle} tickLine={false} />
                            <YAxis type="number" dataKey="value" tick={axisTickStyle} axisLine={false} tickLine={false} />
                            <ZAxis type="number" dataKey="value" range={isBubble ? [60, 600] : [50, 50]} />
                            {settings.showLegend && <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '15px' }} iconType="circle" />}
                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                const scatterData = data.map((d: any) => ({ name: d.name, value: Number(d[key]) || 0 }));
                                return <Scatter key={key} name={key} data={scatterData} fill={baseColor} fillOpacity={isBubble ? 0.7 : 1} isAnimationActive={false} />;
                            })}
                        </ScatterChart>
                    </ResponsiveContainer>
                );
            }
            case 'radar': {
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <PolarRadiusAxis angle={30} domain={['auto', 'auto']} tick={false} axisLine={false} />
                            {settings.showLegend && <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />}
                            {keys.map((key: string, idx: number) => {
                                const baseColor = colors[key] || CHART_PALETTE[idx % CHART_PALETTE.length];
                                return <Radar key={key} name={key} dataKey={key} stroke={baseColor} fill={baseColor} fillOpacity={0.5} isAnimationActive={false} />;
                            })}
                        </RadarChart>
                    </ResponsiveContainer>
                );
            }
            default: return null;
        }
    };

    return (
        <div className="w-full p-2" style={{ height: '350px' }}>
            {renderChart()}
        </div>
    );
};

const MapElementBlockReadonly = ({ el }: any) => {
    const settings = el.payload.settings || {};
    const data = el.payload.data || [];
    const colors = el.payload.colors || {};
    const activeDistrictsForLegend = data.filter((d: any) => d['Вредност'] && String(d['Вредност']).trim() !== '0' && String(d['Вредност']).trim() !== '');

    return (
        <div className="w-full relative overflow-hidden p-2" style={{ height: '350px' }}>
            <div className="w-full h-full flex items-center justify-center relative min-h-0">
                <MapGraphic colors={colors} />
            </div>
            {settings.showLegend && activeDistrictsForLegend.length > 0 && (
                <div className="absolute bottom-4 left-4 flex flex-col gap-1 bg-white/90 p-2 rounded border border-slate-100 z-10">
                    {activeDistrictsForLegend.map((row: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded" style={{ backgroundColor: colors[row.name] || '#e2e8f0' }} />
                            <span className="text-[10px] text-slate-600 font-medium">{row.name} ({row['Вредност']})</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- GLAVNA KOMPONENTA ZA PRINT ---

const PrintView = () => {
    const { id } = useParams();
    const [sections, setSections] = useState<any[]>([]);
    const [isReady, setIsReady] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const fetchDocument = async () => {
            try {
                // VAŽNO: Gađa novu rutu /api/print-documents koja je OTVORENA za Puppeteer!
                const response = await axiosClient.get(`/api/print-documents/${id}`);
                setSections(response.data.document.sections);

                // Dajemo pretraživaču malo vremena da iscrta grafikone (npr. 1500ms) pre nego što signaliziramo "Spreman"
                setTimeout(() => setIsReady(true), 1500);
            } catch (error: any) {
                console.error("Greška", error);
                setErrorMsg(error.response?.status === 401
                    ? "Greška 401: Puppeteer nema pristup (ruta verovatno nije javna)!"
                    : "Došlo je do greške pri povlačenju podataka.");
                setIsReady(true); // Isključujemo loading da bi greška bila vidljiva na PDF-u
            }
        };
        fetchDocument();
    }, [id]);

    if (!isReady) {
        return <div className="p-10 text-center font-bold text-slate-500">Priprema dokumenta za štampu...</div>;
    }

    if (errorMsg) {
        return <div className="p-10 text-center text-red-500 font-bold text-xl">{errorMsg}</div>;
    }

    return (
        <div className="bg-white">
            <div id="print-container" className="flex flex-col">
                {sections.map(section => (
                    section.canvas_data?.map((page: any, pageIndex: number) => (
                        <div key={page.id} className="w-[794px] h-[1123px] bg-white relative shrink-0 overflow-hidden page-break-after-always">

                            <div className="flex-1 px-[50px] pt-[100px]">
                                <div className="flex flex-col gap-6 w-full">
                                    {page.rows.map((row: any) => (
                                        <div key={row.id} className="w-full min-h-[40px] break-inside-avoid">
                                            <div className="grid grid-cols-12 gap-0 relative">
                                                {row.columns.map((col: any) => (
                                                    <div key={col.id} className={`${col.widthClass} min-h-[40px] p-1`}>
                                                        {col.elements.map((el: any) => {
                                                            if (el.type === 'text') return <TextElementBlockReadonly key={el.id} el={el} />;
                                                            if (el.type === 'image') return <ImageElementBlockReadonly key={el.id} el={el} />;
                                                            if (el.type === 'table') return <TableElementBlockReadonly key={el.id} el={el} />;
                                                            if (el.type === 'chart') return <ChartElementBlockReadonly key={el.id} el={el} />;
                                                            if (el.type === 'map') return <MapElementBlockReadonly key={el.id} el={el} />;
                                                            return null;
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="absolute bottom-[45px] right-[50px]">
                                <div className="flex items-center text-blue-300 font-extrabold text-sm border-l-2 border-blue-50 pl-3 py-1">
                                    {pageIndex + 1}.
                                </div>
                            </div>
                        </div>
                    ))
                ))}
            </div>
        </div>
    );
};

export default PrintView;
