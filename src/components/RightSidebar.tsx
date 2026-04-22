import React, { useState } from "react";
import {
    AlignCenter, AlignJustify, AlignLeft, AlignRight,
    ChevronDown, Bold, Italic, Underline, Superscript, Subscript,
    ArrowUpToLine, ArrowDownToLine, FoldVertical, ArrowRightToLine, ArrowDownToLine as ArrowDownMerge, SplitSquareHorizontal,
    List, ListOrdered, Quote, Link2, Trash2, Grid3X3,
    Table2, Type, BarChart3, Palette, CaseUpper, Layers, Target, LineChart, PieChart, ScatterChart, Star, Heading1, Heading2, MessageSquareQuote,
    PlusCircle
} from "lucide-react";
import { useEditor } from "../contexts/EditorContext";

// --- KONSTANTE I PODACI ZA NOVI GRAFIKON DIZAJN ---
const CHART_TYPES_CONFIG: Record<string, { label: string; icon: React.ReactNode; subtypes: { id: string; name: string; icon: React.ReactNode }[] }> = {
    bar: {
        label: "Стубичасти",
        icon: <BarChart3 size={16} />,
        subtypes: [
            { id: "grouped_v", name: "Груписани верт.", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><rect x="5" y="10" width="6" height="20" fill="#34d399"/><rect x="13" y="15" width="6" height="15" fill="#8b98ff"/><rect x="23" y="5" width="6" height="25" fill="#34d399"/><rect x="31" y="12" width="6" height="18" fill="#8b98ff"/></svg> },
            { id: "stacked_v", name: "Сложени верт.", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><rect x="10" y="15" width="8" height="15" fill="#34d399"/><rect x="10" y="5" width="8" height="10" fill="#8b98ff"/><rect x="22" y="10" width="8" height="20" fill="#34d399"/><rect x="22" y="0" width="8" height="10" fill="#8b98ff"/></svg> },
            { id: "grouped_h", name: "Груписани хориз.", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><rect x="0" y="5" width="20" height="6" fill="#34d399"/><rect x="0" y="13" width="15" height="6" fill="#8b98ff"/><rect x="0" y="21" width="25" height="6" fill="#34d399"/></svg> },
            { id: "stacked_h", name: "Сложени хориз.", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><rect x="0" y="10" width="15" height="8" fill="#34d399"/><rect x="15" y="10" width="10" height="8" fill="#8b98ff"/><rect x="0" y="22" width="20" height="8" fill="#34d399"/><rect x="20" y="22" width="10" height="8" fill="#8b98ff"/></svg> },
        ]
    },
    line: {
        label: "Линијски",
        icon: <LineChart size={16} />,
        subtypes: [
            { id: "line_basic", name: "Основна линија", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><path d="M5,25 L15,10 L25,18 L35,5" stroke="#34d399" strokeWidth="3" fill="none"/></svg> },
            { id: "line_dots", name: "Линија са тачкама", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><path d="M5,25 L15,10 L25,18 L35,5" stroke="#34d399" strokeWidth="2" fill="none"/><circle cx="5" cy="25" r="3" fill="#8b98ff"/><circle cx="15" cy="10" r="3" fill="#8b98ff"/><circle cx="25" cy="18" r="3" fill="#8b98ff"/><circle cx="35" cy="5" r="3" fill="#8b98ff"/></svg> },
            { id: "area_basic", name: "Површински", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><path d="M0,30 L10,10 L20,20 L30,5 L40,15 L40,30 Z" fill="#34d399" fillOpacity="0.5" stroke="#34d399" strokeWidth="2"/></svg> },
            { id: "area_stacked", name: "Сложени површ.", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><path d="M0,30 L10,20 L20,25 L30,15 L40,20 L40,30 Z" fill="#34d399"/><path d="M0,20 L10,5 L20,15 L30,5 L40,10 L40,20 L30,15 L20,25 L10,20 Z" fill="#8b98ff"/></svg> },
        ]
    },
    circular: {
        label: "Кружни",
        icon: <PieChart size={16} />,
        subtypes: [
            { id: "pie_basic", name: "Пита", icon: <svg viewBox="0 0 30 30" className="w-full h-full"><circle cx="15" cy="15" r="14" fill="#8b98ff"/><path d="M15,15 L15,1 A14,14 0 0,1 29,15 Z" fill="#34d399"/></svg> },
            { id: "doughnut_basic", name: "Прстен", icon: <svg viewBox="0 0 30 30" className="w-full h-full"><path d="M15,1 A14,14 0 1,1 15,29 A14,14 0 1,1 15,1 M15,7 A8,8 0 1,0 15,23 A8,8 0 1,0 15,7" fill="#8b98ff" fillRule="evenodd"/><path d="M15,1 A14,14 0 0,1 29,15 L23,15 A8,8 0 0,0 15,7 Z" fill="#34d399"/></svg> },
            { id: "radial_progress", name: "Радијални прогрес", icon: <svg viewBox="0 0 30 30" className="w-full h-full"><circle cx="15" cy="15" r="14" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1"/><path d="M15,1 A14,14 0 0,1 27,22" stroke="#34d399" strokeWidth="4" fill="none" strokeLinecap="round"/><circle cx="15" cy="15" r="10" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1"/><path d="M15,5 A10,10 0 0,1 23,19" stroke="#8b98ff" strokeWidth="4" fill="none" strokeLinecap="round"/></svg> },
            { id: "semicircle_doughnut", name: "Полупрстен", icon: <svg viewBox="0 0 30 15" className="w-full h-full"><path d="M1,15 A14,14 0 0,1 29,15 L23,15 A8,8 0 0,0 7,15 Z" fill="#e2e8f0"/><path d="M1,15 A14,14 0 0,1 15,1 L15,7 A8,8 0 0,0 7,15 Z" fill="#34d399"/><path d="M15,1 A14,14 0 0,1 29,15 L23,15 A8,8 0 0,0 15,7 Z" fill="#8b98ff"/></svg> },
        ]
    },
    composed: {
        label: "Комбиновани",
        icon: <Layers size={16} />,
        subtypes: [
            { id: "composed_line_bar", name: "Линија + Стубићи", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><rect x="5" y="15" width="8" height="15" fill="#34d399"/><rect x="25" y="10" width="8" height="20" fill="#34d399"/><path d="M0,20 L10,5 L30,15 L40,5" stroke="#8b98ff" strokeWidth="2" fill="none"/><circle cx="10" cy="5" r="2" fill="#8b98ff"/><circle cx="30" cy="15" r="2" fill="#8b98ff"/></svg> },
            { id: "composed_area_bar", name: "Површина + Стуб", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><path d="M0,30 L10,15 L30,20 L40,10 L40,30 Z" fill="#8b98ff" fillOpacity="0.3"/><rect x="5" y="15" width="8" height="15" fill="#34d399"/><rect x="25" y="10" width="8" height="20" fill="#34d399"/></svg> },
            { id: "composed_area_line", name: "Површина + Линија", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><path d="M0,30 L10,15 L25,25 L40,10 L40,30 Z" fill="#8b98ff" fillOpacity="0.3"/><path d="M0,25 L15,5 L25,15 L40,5" stroke="#34d399" strokeWidth="2" fill="none"/><circle cx="15" cy="5" r="2" fill="#34d399"/><circle cx="25" cy="15" r="2" fill="#34d399"/></svg> },
            { id: "composed_stacked_line", name: "Сложени + Линија", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><rect x="5" y="20" width="8" height="10" fill="#34d399"/><rect x="5" y="10" width="8" height="10" fill="#8b98ff"/><rect x="25" y="15" width="8" height="15" fill="#34d399"/><rect x="25" y="5" width="8" height="10" fill="#8b98ff"/><path d="M0,15 L10,5 L30,10 L40,0" stroke="#f59e0b" strokeWidth="2" fill="none"/></svg> }
        ]
    },
    scatter: {
        label: "Мехурасти",
        icon: <ScatterChart size={16} />,
        subtypes: [
            { id: "scatter_basic", name: "Тачкасти", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><circle cx="10" cy="20" r="3" fill="#34d399"/><circle cx="20" cy="10" r="3" fill="#8b98ff"/><circle cx="30" cy="25" r="3" fill="#f59e0b"/><circle cx="35" cy="15" r="3" fill="#e11d48"/></svg> },
            { id: "bubble_basic", name: "Мехурасти", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><circle cx="10" cy="20" r="4" fill="#34d399" fillOpacity="0.7"/><circle cx="20" cy="10" r="8" fill="#8b98ff" fillOpacity="0.7"/><circle cx="30" cy="22" r="6" fill="#f59e0b" fillOpacity="0.7"/><circle cx="35" cy="15" r="3" fill="#e11d48" fillOpacity="0.7"/></svg> },
            { id: "scatter_star", name: "Звездасти", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><path d="M10,17 L12,22 L8,19 L13,19 L9,22 Z" fill="#34d399"/><path d="M20,7 L23,14 L17,10 L24,10 L18,14 Z" fill="#8b98ff"/><path d="M30,22 L33,28 L27,25 L34,25 L28,28 Z" fill="#f59e0b"/></svg> },
            { id: "scatter_diamond", name: "Дијамантски", icon: <svg viewBox="0 0 40 30" className="w-full h-full"><polygon points="10,16 14,20 10,24 6,20" fill="#34d399"/><polygon points="20,6 25,11 20,16 15,11" fill="#8b98ff"/><polygon points="30,21 33,24 30,27 27,24" fill="#f59e0b"/></svg> }
        ]
    },
    radar: {
        label: "Радарски",
        icon: <Target size={16} />,
        subtypes: [
            { id: "radar_basic", name: "Мрежни испуњен", icon: <svg viewBox="0 0 30 30" className="w-full h-full"><polygon points="15,2 28,10 23,26 7,26 2,10" fill="none" stroke="#e2e8f0" strokeWidth="1"/><polygon points="15,8 22,14 19,22 11,22 8,14" fill="#34d399" fillOpacity="0.5" stroke="#34d399" strokeWidth="1"/></svg> },
            { id: "radar_outline", name: "Мрежни обрис", icon: <svg viewBox="0 0 30 30" className="w-full h-full"><polygon points="15,2 28,10 23,26 7,26 2,10" fill="none" stroke="#e2e8f0" strokeWidth="1"/><polygon points="15,8 22,14 19,22 11,22 8,14" fill="none" stroke="#8b98ff" strokeWidth="2"/></svg> },
            { id: "radar_circular", name: "Кружни испуњен", icon: <svg viewBox="0 0 30 30" className="w-full h-full"><circle cx="15" cy="15" r="13" fill="none" stroke="#e2e8f0" strokeWidth="1"/><circle cx="15" cy="15" r="7" fill="none" stroke="#e2e8f0" strokeWidth="1"/><polygon points="15,6 23,12 18,23 9,19 10,12" fill="#34d399" fillOpacity="0.5" stroke="#34d399" strokeWidth="1"/></svg> },
            { id: "radar_circular_outline", name: "Кружни обрис", icon: <svg viewBox="0 0 30 30" className="w-full h-full"><circle cx="15" cy="15" r="13" fill="none" stroke="#e2e8f0" strokeWidth="1"/><polygon points="15,6 23,12 18,23 9,19 10,12" fill="none" stroke="#8b98ff" strokeWidth="2"/></svg> }
        ]
    }
};

const SERBIAN_DISTRICTS = [
    "Град Београд", "Северобачки", "Средњобачки", "Севернобанатски",
    "Средњобанатски", "Јужнобанатски", "Западнобачки", "Јужнобачки",
    "Сремски", "Мачвански", "Колубарски", "Подунавски", "Браничевски",
    "Шумадијски", "Поморавски", "Борски", "Зајечарски", "Златиборски",
    "Маравички", "Рашки", "Расински", "Нишавски", "Топлички", "Пиротски",
    "Јабланички", "Пчињски", "Косовско-Митровачки", "Косовски", "Пећки",
    "Призренски", "Косовско-Поморавски"
];

const StyledDropdown = ({ options, selectedValue, onSelect }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options[selectedValue];

    return (
        <div className="relative w-full mb-3">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-blue-400 transition-colors z-20"
            >
                <div className="flex items-center gap-2.5">
                    {selectedOption?.icon}
                    <span>{selectedOption?.label || "Izaberite tip"}</span>
                </div>
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-[calc(100%+5px)] left-0 w-full bg-white rounded-xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.1)] border border-slate-100 p-2 z-30 animate-in fade-in slide-in-from-top-2">
                        {Object.entries(options).map(([key, opt]: any) => (
                            <button
                                key={key}
                                onClick={() => { onSelect(key); setIsOpen(false); }}
                                className={`flex items-center gap-2.5 w-full p-2.5 rounded-lg text-sm text-left transition-colors ${selectedValue === key ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}
                            >
                                {opt.icon}
                                <span>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export const extractFootnoteIds = (html: string) => {
    const regex = /data-footnote-id="([^"]+)"/g;
    const ids = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        ids.push(match[1]);
    }
    return ids;
};

const RightSidebar = () => {
    const { selectedElement, updateElementSettings } = useEditor();

    if (!selectedElement) {
        return (
            <aside className="w-[320px] bg-[#F8FAFC] p-5 flex flex-col gap-5 overflow-y-auto border-l border-slate-200 h-screen sticky top-0 custom-scrollbar z-40">
                <div className="text-sm text-slate-400 text-center mt-10 uppercase tracking-widest hover:scale-105 transition-transform">Изаберите елемент</div>
            </aside>
        );
    }

    const settings = selectedElement.settings || {};

    const formatText = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
    };

    const handleAddLink = () => {
        const url = prompt("Унесите URL линка (нпр. https://google.com):", "https://");
        if (url) formatText("createLink", url);
    };

    const PRIMARY_COLORS = ['#8b98ff', '#34d399', '#f8fafc', '#2563eb', '#1e3a8a'];
    const SECONDARY_COLORS = ['#f59e0b', '#fef3c7', '#fecdd3', '#c084fc', '#e11d48'];

    const handleColorPick = (colorHex: string) => {
        const activeKey = settings.activeColorKey;
        if (activeKey) {
            const currentColors = selectedElement.extraPayload?.colors || settings.colors || {};
            updateElementSettings({}, { colors: { ...currentColors, [activeKey]: colorHex } });
        } else {
            updateElementSettings({ color: colorHex });
        }
    };

    const mapData = selectedElement.extraPayload?.data || settings.data || [];
    const mapColors = selectedElement.extraPayload?.colors || settings.colors || {};

    const handleMapValueChange = (district: string, val: string) => {
        let newData = [...mapData];
        const idx = newData.findIndex((d: any) => d.name === district);
        if (idx >= 0) {
            newData[idx] = { ...newData[idx], 'Вредност': val };
        } else {
            newData.push({ name: district, 'Вредност': val });
        }
        updateElementSettings({}, { data: newData });
    };

    const handleMapColorChange = (district: string, color: string) => {
        updateElementSettings({}, { colors: { ...mapColors, [district]: color } });
    };

    const handleMergeRight = () => {
        if (!selectedElement.activeCell) return;
        const [r, c] = selectedElement.activeCell.split('_').map(Number);
        const nextColKey = `${r}_${c + 1}`;

        updateElementSettings({
            cells: {
                ...settings.cells,
                [selectedElement.activeCell]: { ...(settings.cells?.[selectedElement.activeCell] || {}), colSpan: ((settings.cells?.[selectedElement.activeCell]?.colSpan || 1) + 1) },
                [nextColKey]: { ...(settings.cells?.[nextColKey] || {}), hidden: true }
            }
        });
    };

    const handleMergeDown = () => {
        if (!selectedElement.activeCell) return;
        const [r, c] = selectedElement.activeCell.split('_').map(Number);
        const nextRowKey = `${r + 1}_${c}`;

        updateElementSettings({
            cells: {
                ...settings.cells,
                [selectedElement.activeCell]: { ...(settings.cells?.[selectedElement.activeCell] || {}), rowSpan: ((settings.cells?.[selectedElement.activeCell]?.rowSpan || 1) + 1) },
                [nextRowKey]: { ...(settings.cells?.[nextRowKey] || {}), hidden: true }
            }
        });
    };

    const handleUnmerge = () => {
        if (!selectedElement.activeCell) return;
        const [r, c] = selectedElement.activeCell.split('_').map(Number);
        const currentCellSettings = settings.cells?.[selectedElement.activeCell] || {};

        const colSpan = currentCellSettings.colSpan || 1;
        const rowSpan = currentCellSettings.rowSpan || 1;

        let newCellsSettings = { ...settings.cells };
        for(let i = 0; i < rowSpan; i++) {
            for(let j = 0; j < colSpan; j++) {
                if(i === 0 && j === 0) continue;
                const targetKey = `${r + i}_${c + j}`;
                newCellsSettings[targetKey] = { ...(newCellsSettings[targetKey] || {}), hidden: false };
            }
        }

        newCellsSettings[selectedElement.activeCell] = { ...currentCellSettings, colSpan: 1, rowSpan: 1 };

        updateElementSettings({ cells: newCellsSettings });
    }

    // --- ЛОГИКА ЗА ФУСНОТЕ (УНИВЕРЗАЛНА ЗА ТЕКСТ И ТАБЕЛЕ) ---
    const footnotesDict = settings.footnotes || {};
    let activeFootnoteIds: string[] = [];

    if (selectedElement.type === 'text') {
        activeFootnoteIds = extractFootnoteIds(settings.content || '');
    } else if (selectedElement.type === 'table') {
        activeFootnoteIds = Object.keys(footnotesDict);
    }

    return (
        <aside className="w-[320px] bg-[#F8FAFC] p-5 flex flex-col gap-5 overflow-y-auto border-l border-slate-200 h-[92vh] sticky top-10 custom-scrollbar z-40 pb-20">

            <h3 className="text-[12px] text-slate-400 font-bold tracking-wider uppercase flex items-center gap-2 mb-[-10px]">
                <Star size={14} /> Опште опције
            </h3>

            <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex flex-col relative z-0">
                <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-sm text-slate-600 font-medium">Истакни модул</span>
                    <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${settings.featured ? 'bg-amber-400' : 'bg-slate-200'}`}>
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.featured ? 'translate-x-4' : ''}`} />
                    </div>
                    <input
                        type="checkbox"
                        className="hidden"
                        checked={!!settings.featured}
                        onChange={() => updateElementSettings({ featured: !settings.featured })}
                    />
                </label>
            </div>

            {selectedElement.type === 'chart' && (
                <>
                    <div className="flex flex-col gap-3">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-sm text-slate-600 font-medium">Прикажи вредности</span>
                            <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${settings.showLabels ? 'bg-blue-500' : 'bg-slate-200'}`}>
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.showLabels ? 'translate-x-4' : ''}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={settings.showLabels} onChange={() => updateElementSettings({ showLabels: !settings.showLabels })} />
                        </label>
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-sm text-slate-600 font-medium">Прикажи легенду</span>
                            <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${settings.showLegend ? 'bg-blue-500' : 'bg-slate-200'}`}>
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.showLegend ? 'translate-x-4' : ''}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={settings.showLegend} onChange={() => updateElementSettings({ showLegend: !settings.showLegend })} />
                        </label>
                    </div>

                    <h3 className="text-[12px] text-slate-400 font-bold tracking-wider uppercase mt-1">Графикон</h3>

                    <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex flex-col gap-3 relative z-20">
                        <StyledDropdown
                            options={CHART_TYPES_CONFIG}
                            selectedValue={settings.chartType}
                            onSelect={(newType: string) => updateElementSettings({ chartType: newType, subChartType: CHART_TYPES_CONFIG[newType].subtypes[0].id })}
                        />

                        <div className="grid grid-cols-2 gap-3 mt-1">
                            {CHART_TYPES_CONFIG[settings.chartType]?.subtypes.map((sub: any) => {
                                const isSelected = (selectedElement.extraPayload?.subChartType || settings.subChartType) === sub.id;
                                return (
                                    <button
                                        key={sub.id}
                                        onClick={() => updateElementSettings({}, { subChartType: sub.id })}
                                        className={`flex flex-col items-center justify-center p-3 h-28 rounded-2xl border-2 transition-all hover:border-blue-200 ${isSelected ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-100 bg-slate-50'}`}
                                    >
                                        <div className="w-full h-16 flex items-center justify-center mb-2">{sub.icon}</div>
                                        <span className={`text-[10px] font-semibold text-center ${isSelected ? 'text-blue-700' : 'text-slate-500'}`}>{sub.name}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={() => updateElementSettings({ showDataEditor: !settings.showDataEditor })}
                            className={`w-full py-2.5 font-bold text-sm rounded-xl border-2 transition-all flex justify-center items-center gap-2 mt-2 ${settings.showDataEditor ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-blue-500 border-blue-200 hover:bg-blue-50'}`}
                        >
                            <Table2 size={16} /> {settings.showDataEditor ? 'Затвори уређивач' : 'Уреди податке'}
                        </button>
                    </div>
                </>
            )}

            {selectedElement.type === 'map' && (
                <>
                    <h3 className="text-[14px] text-slate-500 tracking-wider uppercase mb-2">Опције мапе</h3>

                    <div className="flex flex-col gap-3 mb-3 relative z-0">
                        <label className="flex items-center justify-between cursor-pointer group">
                            <span className="text-sm text-slate-600 font-medium">Прикажи легенду</span>
                            <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${settings.showLegend ? 'bg-blue-500' : 'bg-slate-200'}`}>
                                <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.showLegend ? 'translate-x-4' : ''}`} />
                            </div>
                            <input type="checkbox" className="hidden" checked={settings.showLegend} onChange={() => updateElementSettings({ showLegend: !settings.showLegend })} />
                        </label>
                    </div>

                    <h3 className="text-[12px] text-slate-400 font-bold tracking-wider uppercase mt-1">Подаци по окрузима</h3>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden relative z-0">
                        <div className="flex text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-3 py-2 border-b border-slate-100">
                            <div className="w-8">Боја</div>
                            <div className="flex-1">Округ</div>
                            <div className="w-16 text-right">Вредност</div>
                        </div>

                        <div className="flex flex-col max-h-[350px] overflow-y-auto custom-scrollbar">
                            {SERBIAN_DISTRICTS.map((district) => {
                                const rowData = mapData.find((d: any) => d.name === district) || { 'Вредност': '' };
                                const districtColor = mapColors[district] || '#e2e8f0';

                                return (
                                    <div key={district} className="flex items-center gap-2 px-3 py-2 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <label className="cursor-pointer shrink-0">
                                            <input type="color" value={districtColor} onChange={(e) => handleMapColorChange(district, e.target.value)} className="sr-only" />
                                            <div className="w-5 h-5 rounded border border-slate-200 shadow-inner" style={{ backgroundColor: districtColor }} />
                                        </label>
                                        <span className="flex-1 text-xs font-medium text-slate-600 truncate" title={district}>
                                            {district}
                                        </span>
                                        <input
                                            type="text"
                                            value={rowData['Вредност']}
                                            onChange={(e) => handleMapValueChange(district, e.target.value)}
                                            placeholder="0"
                                            className="w-16 text-xs text-right bg-transparent border-b border-transparent focus:border-blue-400 outline-none p-1 text-slate-700 font-medium"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {(selectedElement.type === 'chart' || selectedElement.type === 'map') && (
                <div className="flex flex-col gap-4 mt-1 relative z-0">
                    <h3 className="text-[12px] text-slate-400 font-bold tracking-wider uppercase mt-1 flex items-center gap-2"><Palette size={14}/> Палете боја</h3>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide ml-1">Примарне боје</label>
                        <div className="flex justify-between gap-1">
                            {PRIMARY_COLORS.map(color => (
                                <button key={color} onClick={() => handleColorPick(color)} className="w-8 h-8 rounded-lg border border-slate-100 hover:scale-110 hover:shadow-md transition-all" style={{ backgroundColor: color }} />
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide ml-1">Секундар боје</label>
                        <div className="flex justify-between gap-1">
                            {SECONDARY_COLORS.map(color => (
                                <button key={color} onClick={() => handleColorPick(color)} className="w-8 h-8 rounded-lg border border-slate-100 hover:scale-110 hover:shadow-md transition-all" style={{ backgroundColor: color }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {selectedElement.type === 'image' && (
                <>
                    <h3 className="text-[14px] text-slate-500 tracking-wider uppercase mb-1">Опције слике</h3>
                    <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex flex-col gap-5">

                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Ширина слике</label>
                                <span className="text-[11px] font-bold text-blue-500">{settings.width || 100}%</span>
                            </div>
                            <input
                                type="range" min="10" max="100" step="5"
                                value={settings.width || 100}
                                onChange={(e) => updateElementSettings({ width: parseInt(e.target.value) })}
                                className="w-full accent-blue-500"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wide">Назив слике (потпис)</label>
                            <input
                                type="text"
                                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 text-sm text-slate-600 outline-none focus:border-blue-400 transition-all"
                                placeholder="Опишите слику..."
                                value={settings.altText || ''}
                                onChange={(e) => updateElementSettings({ altText: e.target.value })}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wide">Поравнање</label>
                            <div className="flex bg-[#F8FAFC] p-1 rounded-lg border border-slate-100 w-fit">
                                <button onClick={() => updateElementSettings({ alignment: 'left' })} className={`p-2 rounded ${settings.alignment === 'left' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}><AlignLeft size={18} /></button>
                                <button onClick={() => updateElementSettings({ alignment: 'center' })} className={`p-2 rounded ${(!settings.alignment || settings.alignment === 'center') ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}><AlignCenter size={18} /></button>
                                <button onClick={() => updateElementSettings({ alignment: 'right' })} className={`p-2 rounded ${settings.alignment === 'right' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}><AlignRight size={18} /></button>
                            </div>
                        </div>
                        <div className="mt-1 pt-4 border-t border-slate-50">
                            <button
                                onClick={() => updateElementSettings({ url: '' })}
                                className="w-full flex items-center justify-center gap-2 text-sm text-red-400 hover:text-red-500 hover:bg-red-50 p-2.5 rounded-lg transition-colors font-medium"
                            >
                                <Trash2 size={16} /> Уклони извор слике
                            </button>
                        </div>
                    </div>
                </>
            )}

            {selectedElement.type === 'table' && (
                <>
                    <h3 className="text-[14px] text-slate-500 tracking-wider uppercase mb-1">Подешавања табеле</h3>
                    <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex flex-col gap-4">
                        <div className="flex flex-col gap-3">
                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Димензије табеле</label>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] text-slate-400 ml-2 font-medium">Редови</span>
                                    <input type="number" min="1" value={settings.rows || 1} onChange={(e) => updateElementSettings({ rows: parseInt(e.target.value) || 1 })} className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-2.5 text-sm text-center font-semibold text-slate-700 outline-none focus:border-blue-400" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] text-slate-400 ml-2 font-medium">Колоне</span>
                                    <input type="number" min="1" value={settings.columns || 1} onChange={(e) => updateElementSettings({ columns: parseInt(e.target.value) || 1 })} className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-2.5 text-sm text-center font-semibold text-slate-700 outline-none focus:border-blue-400" />
                                </div>
                            </div>
                        </div>
                    </div>
                    {selectedElement.subType === 'cell' && (
                        <div className="bg-white rounded-[20px] p-4 shadow-sm border border-blue-100 flex flex-col gap-4 animate-in slide-in-from-top-2">
                            <div className="flex items-center gap-2.5 mb-1 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                                <Grid3X3 size={16} className="text-blue-500" />
                                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">Ћелија {selectedElement.activeCell}</span>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Спајање ћелија (Merge)</label>
                                <div className="flex gap-1 bg-[#F8FAFC] p-1 rounded-lg border border-slate-100 justify-between">
                                    <button onClick={handleMergeRight} className="p-2 rounded-lg text-slate-600 hover:bg-white flex items-center justify-center flex-1 gap-1" title="Споји са десном">
                                        <ArrowRightToLine size={16} />
                                    </button>
                                    <button onClick={handleMergeDown} className="p-2 rounded-lg text-slate-600 hover:bg-white flex items-center justify-center flex-1 gap-1" title="Споји са доњом">
                                        <ArrowDownMerge size={16} />
                                    </button>
                                    <button onClick={handleUnmerge} className="p-2 rounded-lg text-slate-600 hover:bg-white flex items-center justify-center flex-1 gap-1" title="Раздвој (Unmerge)">
                                        <SplitSquareHorizontal size={16} className="text-red-400" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Форматирање</label>
                                <div className="flex gap-1 bg-[#F8FAFC] p-1 rounded-lg border border-slate-100 justify-between">
                                    <button onMouseDown={(e) => { e.preventDefault(); formatText('bold'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white"><Bold size={16} /></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); formatText('italic'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white"><Italic size={16} /></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); formatText('superscript'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white"><Superscript size={16} /></button>
                                    <button onMouseDown={(e) => { e.preventDefault(); formatText('subscript'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white"><Subscript size={16} /></button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Стил текста</label>
                                <div className="flex bg-[#F8FAFC] p-1 rounded-lg border border-slate-100 w-full">
                                    <button onClick={() => { const cellKey = selectedElement.activeCell!; updateElementSettings({ cells: { ...settings.cells, [cellKey]: { ...settings.cells?.[cellKey], type: 'headline' } } }); }} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded ${settings.cells?.[selectedElement.activeCell!]?.type === 'headline' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}>Наслов</button>
                                    <button onClick={() => { const cellKey = selectedElement.activeCell!; updateElementSettings({ cells: { ...settings.cells, [cellKey]: { ...settings.cells?.[cellKey], type: 'paragraph' } } }); }} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded ${settings.cells?.[selectedElement.activeCell!]?.type !== 'headline' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}>Текст</button>
                                </div>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.dispatchEvent(new CustomEvent('insert-footnote', {
                                        detail: { elementId: selectedElement?.elementId }
                                    }));
                                }}
                                className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group shadow-sm mt-1"
                            >
                                <PlusCircle size={16} className="group-hover:scale-110 transition-transform" />
                                ДОДАЈ НОВУ ФУСНОТУ
                            </button>

                            <div className="flex items-center gap-2 bg-[#F8FAFC] p-2 rounded-xl border border-slate-100">
                                <span className="text-[11px] font-bold text-slate-400 uppercase ml-1">Боја текста:</span>
                                <div className="flex gap-1.5 px-1 ml-auto">
                                    <button onClick={() => { const cellKey = selectedElement.activeCell!; updateElementSettings({ cells: { ...settings.cells, [cellKey]: { ...settings.cells?.[cellKey], textColor: '#1E293B' } } }); }} className={`w-6 h-6 rounded-lg bg-[#1E293B] ${(settings.cells?.[selectedElement.activeCell!]?.textColor === '#1E293B' || !settings.cells?.[selectedElement.activeCell!]?.textColor) ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                                    <button onClick={() => { const cellKey = selectedElement.activeCell!; updateElementSettings({ cells: { ...settings.cells, [cellKey]: { ...settings.cells?.[cellKey], textColor: '#FFFFFF' } } }); }} className={`w-6 h-6 rounded-lg bg-white border border-slate-200 ${settings.cells?.[selectedElement.activeCell!]?.textColor === '#FFFFFF' ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                                    <button onClick={() => { const cellKey = selectedElement.activeCell!; updateElementSettings({ cells: { ...settings.cells, [cellKey]: { ...settings.cells?.[cellKey], textColor: '#7E9CF1' } } }); }} className={`w-6 h-6 rounded-lg bg-[#7E9CF1] ${settings.cells?.[selectedElement.activeCell!]?.textColor === '#7E9CF1' ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Боја позадине</label>
                                <div className="flex gap-2.5">
                                    {['#FFFFFF', '#F8FAFC', '#E2E8F0', '#8b98ff', '#34d399'].map(color => (
                                        <button key={color} onClick={() => { const cellKey = selectedElement.activeCell!; updateElementSettings({ cells: { ...settings.cells, [cellKey]: { ...settings.cells?.[cellKey], backgroundColor: color } } }); }} className={`w-7 h-7 rounded-lg border border-slate-100 transition-transform ${settings.cells?.[selectedElement.activeCell!]?.backgroundColor === color ? 'scale-125 ring-2 ring-blue-300 ring-offset-1 shadow-md' : 'hover:scale-110'}`} style={{ backgroundColor: color }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {selectedElement.type === 'text' && (
                <>
                    <h3 className="text-[12px] text-slate-400 font-bold tracking-wider uppercase mt-1 flex items-center gap-2"><CaseUpper size={15}/> Типографија</h3>
                    <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex flex-col gap-4 relative z-0">

                        <div className="flex bg-[#F8FAFC] p-1 rounded-xl border border-slate-100 w-full gap-1">
                            <button
                                onMouseDown={(e) => { e.preventDefault(); formatText('formatBlock', 'H1'); }}
                                className="flex-1 py-1.5 text-[11px] font-bold rounded text-slate-600 hover:bg-white hover:text-blue-600 shadow-sm transition-colors flex items-center justify-center gap-1"
                                title="Велики наслов"
                            >
                                <Heading1 size={14} /> H1
                            </button>
                            <button
                                onMouseDown={(e) => { e.preventDefault(); formatText('formatBlock', 'H2'); }}
                                className="flex-1 py-1.5 text-[11px] font-bold rounded text-slate-600 hover:bg-white hover:text-blue-600 shadow-sm transition-colors flex items-center justify-center gap-1"
                                title="Мали наслов"
                            >
                                <Heading2 size={14} /> H2
                            </button>
                            <button
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    formatText('formatBlock', 'P');
                                    formatText('fontSize', '3'); // Vraća na normalnu veličinu fonta
                                }}
                                className="flex-1 py-1.5 text-[11px] font-bold rounded text-slate-600 hover:bg-white hover:text-blue-600 shadow-sm transition-colors flex items-center justify-center gap-1"
                                title="Обичан текст"
                            >
                                <Type size={12} /> Текст
                            </button>
                            <button
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    formatText('fontSize', '2'); // Smanjuje tekst na oko 12-13px
                                }}
                                className="flex-1 py-1.5 text-[11px] font-bold rounded text-slate-600 hover:bg-white hover:text-blue-600 shadow-sm transition-colors flex items-center justify-center gap-1"
                                title="Ситан текст"
                            >
                                <span className="text-[10px] font-black">Aa</span> 12px
                            </button>
                        </div>

                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                window.dispatchEvent(new CustomEvent('insert-footnote', {
                                    detail: { elementId: selectedElement?.elementId }
                                }));
                            }}
                            className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 group shadow-sm"
                        >
                            <PlusCircle size={16} className="group-hover:scale-110 transition-transform" />
                            ДОДАЈ НОВУ ФУСНОТУ
                        </button>

                        <div className="flex items-center justify-between bg-slate-50 p-1 rounded-xl border border-slate-100">
                            <div className="flex gap-1 w-full justify-between px-1">
                                <button onMouseDown={(e) => { e.preventDefault(); formatText('bold'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white"><Bold size={16} /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); formatText('italic'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white"><Italic size={16} /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); formatText('underline'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white"><Underline size={16} /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); formatText('superscript'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white" title="Степен"><Superscript size={16} /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); formatText('subscript'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white" title="Индекс"><Subscript size={16} /></button>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Боја блока:</span>
                            <div className="flex gap-1.5 px-1 ml-auto">
                                <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ color: '#1E293B' }); }} className={`w-6 h-6 rounded-lg bg-[#1E293B] ${settings.color === '#1E293B' ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                                <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ color: '#FFFFFF' }); }} className={`w-6 h-6 rounded-lg bg-white border border-slate-200 ${settings.color === '#FFFFFF' ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                                <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ color: '#7E9CF1' }); }} className={`w-6 h-6 rounded-lg bg-[#7E9CF1] ${settings.color === '#7E9CF1' ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <div className="flex-1 bg-slate-50 p-1 rounded-xl border border-slate-100 grid grid-cols-4 gap-1">
                                <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ alignment: 'left' }); }} className={`p-2 rounded-lg ${settings.alignment === 'left' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}><AlignLeft size={16} /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ alignment: 'center' }); }} className={`p-2 rounded-lg ${settings.alignment === 'center' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}><AlignCenter size={16} /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ alignment: 'right' }); }} className={`p-2 rounded-lg ${settings.alignment === 'right' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}><AlignRight size={16} /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ alignment: 'justify' }); }} className={`p-2 rounded-lg ${settings.alignment === 'justify' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}><AlignJustify size={16} /></button>
                            </div>
                            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 grid grid-cols-3 gap-1">
                                <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ verticalAlignment: 'top' }); }} className={`p-2 rounded-lg ${settings.verticalAlignment === 'top' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}><ArrowUpToLine size={16} /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ verticalAlignment: 'middle' }); }} className={`p-2 rounded-lg ${settings.verticalAlignment === 'middle' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}><FoldVertical size={16} /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ verticalAlignment: 'bottom' }); }} className={`p-2 rounded-lg ${settings.verticalAlignment === 'bottom' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}><ArrowDownToLine size={16} /></button>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-1">
                            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 grid grid-cols-2 gap-1">
                                <button onMouseDown={(e) => { e.preventDefault(); formatText('insertUnorderedList'); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"><List size={16} /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); formatText('insertOrderedList'); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"><ListOrdered size={16} /></button>
                            </div>
                            <div className="flex-1 bg-slate-50 p-1 rounded-xl border border-slate-100 grid grid-cols-2 gap-1">
                                <button onMouseDown={(e) => { e.preventDefault(); formatText('formatBlock', 'BLOCKQUOTE'); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"><Quote size={16} /></button>
                                <button onMouseDown={(e) => { e.preventDefault(); handleAddLink(); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"><Link2 size={16} /></button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeFootnoteIds.length > 0 && (
                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex flex-col gap-3 relative z-0 mt-2 animate-in fade-in slide-in-from-top-2">
                    <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-1"><MessageSquareQuote size={14}/> Текст фуснота</h3>

                    {activeFootnoteIds.map((id: string) => (
                        <div key={id} className="flex flex-col gap-1.5 border border-slate-100 p-2.5 rounded-xl bg-[#F8FAFC]">
                            <label className="text-[10px] font-bold text-blue-400 flex items-center gap-1">Фуснота: <span className="bg-white px-1.5 py-0.5 rounded shadow-sm text-slate-600 border border-slate-100">[*]</span></label>
                            <textarea
                                className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-600 outline-none focus:border-blue-400 resize-none shadow-inner"
                                rows={2}
                                placeholder="Унесите текст фусноте овде..."
                                value={footnotesDict[id] || ''}
                                onChange={(e) => {
                                    updateElementSettings({
                                        footnotes: {
                                            ...footnotesDict,
                                            [id]: e.target.value
                                        }
                                    });
                                }}
                            />
                        </div>
                    ))}
                </div>
            )}

        </aside>
    );
};

export default RightSidebar;
