import React, {useEffect, useRef, useState} from "react";
import {
    AlignCenter, AlignJustify, AlignLeft, AlignRight,
    ChevronDown, Bold, Italic, Underline, Superscript, Subscript,
    ArrowUpToLine, ArrowDownToLine, FoldVertical, ArrowRightToLine, ArrowDownToLine as ArrowDownMerge, SplitSquareHorizontal,
    List, ListOrdered, Quote, Link2, Trash2, Grid3X3,
    Table2, Type, BarChart3, Palette, CaseUpper, Layers, Target, LineChart, PieChart, ScatterChart, Star, Heading1, Heading2, MessageSquareQuote,
    PlusCircle
} from "lucide-react";
import { useEditor } from "../contexts/EditorContext";
import axiosClient from "../axios-client.ts";
import ApprovalPanel from "./ApprovalPanel";

const RichDescriptionEditor = ({ value, onChange, elementKey, placeholder }: { value: string; onChange: (html: string) => void; elementKey: string; placeholder?: string }) => {
    const ref = useRef<HTMLDivElement>(null);
    const lastKey = useRef<string>('');

    useEffect(() => {
        if (ref.current && lastKey.current !== elementKey) {
            ref.current.innerHTML = value || '';
            lastKey.current = elementKey;
        }
    }, [elementKey, value]);

    const fireInput = () => ref.current?.dispatchEvent(new Event('input', { bubbles: true }));

    return (
        <div className="flex flex-col gap-1">
            <div className="bg-[#F8FAFC] p-1 rounded-lg border border-slate-100 grid grid-cols-5 gap-1">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold'); fireInput(); }} className="p-1.5 rounded text-slate-500 hover:bg-white flex items-center justify-center" title="Подебљано"><Bold size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic'); fireInput(); }} className="p-1.5 rounded text-slate-500 hover:bg-white flex items-center justify-center" title="Курзив"><Italic size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline'); fireInput(); }} className="p-1.5 rounded text-slate-500 hover:bg-white flex items-center justify-center" title="Подвучено"><Underline size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList'); fireInput(); }} className="p-1.5 rounded text-slate-500 hover:bg-white flex items-center justify-center" title="Листа"><List size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertOrderedList'); fireInput(); }} className="p-1.5 rounded text-slate-500 hover:bg-white flex items-center justify-center" title="Нумерисана листа"><ListOrdered size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyLeft'); fireInput(); }} className="p-1.5 rounded text-slate-500 hover:bg-white flex items-center justify-center" title="Лево"><AlignLeft size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyCenter'); fireInput(); }} className="p-1.5 rounded text-slate-500 hover:bg-white flex items-center justify-center" title="Центар"><AlignCenter size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('justifyRight'); fireInput(); }} className="p-1.5 rounded text-slate-500 hover:bg-white flex items-center justify-center" title="Десно"><AlignRight size={14} /></button>
                <button type="button" onMouseDown={(e) => {
                    e.preventDefault();
                    const url = window.prompt('Унесите URL:');
                    if (url) { document.execCommand('createLink', false, url); fireInput(); }
                }} className="p-1.5 rounded text-slate-500 hover:bg-white flex items-center justify-center" title="Линк"><Link2 size={14} /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); document.execCommand('removeFormat'); fireInput(); }} className="p-1.5 rounded text-slate-500 hover:bg-white flex items-center justify-center text-[10px] font-bold" title="Уклони форматирање">⌫</button>
            </div>
            <div
                ref={ref}
                contentEditable
                suppressContentEditableWarning
                data-placeholder={placeholder || 'Унесите опис...'}
                onInput={e => onChange((e.target as HTMLDivElement).innerHTML)}
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 text-sm text-slate-600 outline-none focus:border-blue-400 transition-all min-h-[60px] rich-description-editor"
            />
        </div>
    );
};

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

interface RightSidebarProps {
    /** ID trenutno aktivne sekcije — RightSidebar prikazuje approval tab samo ako je definisan. */
    activeSectionId?: number | null;
    /** Pozvano kad approval action promeni status (refresh) */
    onApprovalChanged?: () => void;
}

const RightSidebar = ({ activeSectionId, onApprovalChanged }: RightSidebarProps = {}) => {
    const {
        selectedElement, updateElementSettings,
        isGroupingMode, setIsGroupingMode,
        groupSelection, setGroupSelection
    } = useEditor();

    const [activeTab, setActiveTab] = useState<'element' | 'groups' | 'approval'>('element');
    const [newGroupName, setNewGroupName] = useState('');

    // --- NOVO: Stanja i funkcije za sačuvane grupe ---
    const [savedGroups, setSavedGroups] = useState<any[]>([]);
    const [isLoadingGroups, setIsLoadingGroups] = useState(false);

    const fetchSavedGroups = async () => {
        setIsLoadingGroups(true);
        try {
            // Gađamo Laravel rutu koju ćemo napraviti
            const response = await axiosClient.get('/api/saved-groups');
            setSavedGroups(response.data.data || response.data);
        } catch (error) {
            console.error("Greška pri učitavanju grupa", error);
        } finally {
            setIsLoadingGroups(false);
        }
    };

    const deleteGroup = async (id: number) => {
        if (!window.confirm('Да ли сте сигурни да желите да обришете ову групу?')) return;
        try {
            await axiosClient.delete(`/api/saved-groups/${id}`);
            setSavedGroups(prev => prev.filter(g => g.id !== id));
        } catch (error) {
            console.error("Greška pri brisanju", error);
        }
    };

    // Učitaj grupe kad god otvorimo tab "Grupe", i slušaj event sa Canvasa kad se sačuva nova
    useEffect(() => {
        if (activeTab === 'groups') {
            fetchSavedGroups();
        }

        const handleRefresh = () => fetchSavedGroups();
        window.addEventListener('group-saved', handleRefresh);
        return () => window.removeEventListener('group-saved', handleRefresh);
    }, [activeTab]);
    // --- KRAJ NOVOG DELA ---

    // Ako nema selektovanog elementa, prikazati sidebar samo sa tabovima — Approval tab je dostupan ako postoji aktivna sekcija
    if (!selectedElement) {
        return (
            <aside className="w-[320px] bg-[#F8FAFC] p-5 flex flex-col gap-5 overflow-y-auto border-l border-slate-200 h-screen sticky top-0 custom-scrollbar z-40">
                <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                    <button onClick={() => setActiveTab('element')} className={`flex-1 p-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'element' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Елемент</button>
                    <button onClick={() => setActiveTab('groups')} className={`flex-1 p-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'groups' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Групе</button>
                    {activeSectionId && (
                        <button onClick={() => setActiveTab('approval')} className={`flex-1 p-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'approval' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Одобр.</button>
                    )}
                </div>
                {activeTab === 'element' && (
                    <div className="text-sm text-slate-400 text-center mt-10 uppercase tracking-widest">Изаберите елемент</div>
                )}
                {activeTab === 'approval' && activeSectionId && (
                    <ApprovalPanel sectionId={activeSectionId} onChanged={onApprovalChanged} />
                )}
                {activeTab === 'groups' && (
                    <div className="text-sm text-slate-400 text-center mt-10 uppercase tracking-widest">Изаберите елемент за групе</div>
                )}
            </aside>
        );
    }

    const settings = selectedElement.settings || {};

    const formatText = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
    };

    const toggleInlineTag = (tagName: 'sup' | 'sub') => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        let ancestor: Node | null = range.commonAncestorContainer;
        if (ancestor.nodeType === Node.TEXT_NODE) ancestor = ancestor.parentNode;

        let tagNode: HTMLElement | null = null;
        let cur: Node | null = ancestor;
        while (cur) {
            if ((cur as HTMLElement).getAttribute?.('contenteditable') === 'true') break;
            if ((cur as HTMLElement).tagName?.toLowerCase() === tagName) {
                tagNode = cur as HTMLElement;
                break;
            }
            cur = cur.parentNode;
        }

        if (tagNode) {
            const parent = tagNode.parentNode!;
            const frag = document.createDocumentFragment();
            while (tagNode.firstChild) frag.appendChild(tagNode.firstChild);
            parent.replaceChild(frag, tagNode);
        } else {
            document.execCommand(tagName === 'sup' ? 'superscript' : 'subscript', false, undefined);
        }

        const editor = document.activeElement;
        if (editor) editor.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const applyTextColor = (color: string) => {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
            document.execCommand('foreColor', false, color);
            const editor = document.activeElement;
            if (editor) editor.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            updateElementSettings({ color });
        }
    };

    const getBlockElement = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        let node: any = selection.getRangeAt(0).commonAncestorContainer;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode;

        while (node && node.getAttribute?.('contenteditable') !== 'true') {
            const tag = node.nodeName.toUpperCase();
            if (['P', 'DIV', 'H1', 'H2', 'TD', 'TH', 'BLOCKQUOTE', 'LI'].includes(tag)) {
                return node;
            }
            node = node.parentNode;
        }
        if (node && node.getAttribute?.('contenteditable') === 'true') {
            return node;
        }
        return null;
    };

    const handleFormatBlock = (tag: string, isSmall: boolean = false) => {
        formatText('formatBlock', tag);

        const node = getBlockElement();
        if (node) {
            if (isSmall) {
                node.style.setProperty('font-size', '12px', 'important');
                node.style.setProperty('line-height', '1.2', 'important');
            } else {
                node.style.removeProperty('font-size');
                node.style.removeProperty('line-height');
            }
        }

        const activeEl = document.activeElement;
        if (activeEl && activeEl.getAttribute('contenteditable') === 'true') {
            activeEl.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            const editor = document.getElementById(`editor-${selectedElement?.elementId}`);
            if (editor) editor.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    const handleAddLink = () => {
        const url = prompt("Унесите URL линка (нпр. https://google.com):", "https://");
        if (url) formatText("createLink", url);
    };

    const PRIMARY_COLORS = ['#8b98ff', '#34d399', '#06b6d4', '#2563eb', '#1e3a8a', '#0f766e', '#f43f5e'];
    const SECONDARY_COLORS = ['#f59e0b', '#f97316', '#fecdd3', '#c084fc', '#e11d48', '#84cc16', '#64748b'];

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

    const handleMergeRight = () => {
        if (!selectedElement.activeCell) return;
        const [r, c] = selectedElement.activeCell.split('_').map(Number);
        const cellSt = settings.cells?.[selectedElement.activeCell] || {};
        const colSpan = cellSt.colSpan || 1;
        const rowSpan = cellSt.rowSpan || 1;
        const totalCols = settings.columns || 1;

        // The column to absorb is at c + colSpan (skip already-absorbed cols)
        const nextCol = c + colSpan;
        if (nextCol >= totalCols) return; // already at the right edge

        const newCells = { ...settings.cells };

        // Hide every cell at nextCol within our rowSpan range and reset their spans
        for (let i = 0; i < rowSpan; i++) {
            const targetKey = `${r + i}_${nextCol}`;
            newCells[targetKey] = { ...(newCells[targetKey] || {}), hidden: true, colSpan: 1, rowSpan: 1 };
        }
        newCells[selectedElement.activeCell] = { ...cellSt, colSpan: colSpan + 1 };

        updateElementSettings({ cells: newCells });
    };

    const handleMergeDown = () => {
        if (!selectedElement.activeCell) return;
        const [r, c] = selectedElement.activeCell.split('_').map(Number);
        const cellSt = settings.cells?.[selectedElement.activeCell] || {};
        const colSpan = cellSt.colSpan || 1;
        const rowSpan = cellSt.rowSpan || 1;
        const totalRows = settings.rows || 1;

        // The row to absorb is at r + rowSpan (skip already-absorbed rows)
        const nextRow = r + rowSpan;
        if (nextRow >= totalRows) return; // already at the bottom edge

        const newCells = { ...settings.cells };

        // Hide every cell at nextRow within our colSpan range and reset their spans
        for (let j = 0; j < colSpan; j++) {
            const targetKey = `${nextRow}_${c + j}`;
            newCells[targetKey] = { ...(newCells[targetKey] || {}), hidden: true, colSpan: 1, rowSpan: 1 };
        }
        newCells[selectedElement.activeCell] = { ...cellSt, rowSpan: rowSpan + 1 };

        updateElementSettings({ cells: newCells });
    };

    const handleUnmerge = () => {
        if (!selectedElement.activeCell) return;
        const [r, c] = selectedElement.activeCell.split('_').map(Number);
        const cellSt = settings.cells?.[selectedElement.activeCell] || {};
        const colSpan = cellSt.colSpan || 1;
        const rowSpan = cellSt.rowSpan || 1;

        const newCells = { ...settings.cells };

        // Fully reset every cell that was absorbed — unhide + clear spans
        for (let i = 0; i < rowSpan; i++) {
            for (let j = 0; j < colSpan; j++) {
                if (i === 0 && j === 0) continue;
                const targetKey = `${r + i}_${c + j}`;
                newCells[targetKey] = { ...(newCells[targetKey] || {}), hidden: false, colSpan: 1, rowSpan: 1 };
            }
        }

        // Reset the anchor cell to span 1×1
        newCells[selectedElement.activeCell] = { ...cellSt, colSpan: 1, rowSpan: 1 };

        updateElementSettings({ cells: newCells });
    };

    const footnotesDict = settings.footnotes || {};
    let activeFootnoteIds: string[] = [];

    if (selectedElement.type === 'text') {
        activeFootnoteIds = extractFootnoteIds(settings.content || '');
    } else if (selectedElement.type === 'table') {
        activeFootnoteIds = Object.keys(footnotesDict);
    }

    return (
        <aside className="w-[320px] bg-[#F8FAFC] p-5 flex flex-col gap-5 overflow-y-auto border-l border-slate-200 h-[92vh] sticky top-10 custom-scrollbar z-40 pb-20">

            {/* 1. НОВИ ДЕО: ТАБОВИ (Увек видљиви) */}
            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                <button onClick={() => setActiveTab('element')} className={`flex-1 p-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'element' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Елемент</button>
                <button onClick={() => setActiveTab('groups')} className={`flex-1 p-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'groups' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Групе</button>
                {activeSectionId && (
                    <button onClick={() => setActiveTab('approval')} className={`flex-1 p-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'approval' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>Одобр.</button>
                )}
            </div>

            {/* Approval tab */}
            {activeTab === 'approval' && activeSectionId && (
                <ApprovalPanel sectionId={activeSectionId} onChanged={onApprovalChanged} />
            )}

            {/* 2. НОВИ ДЕО: ТАБ "ГРУПЕ" */}
            {activeTab === 'groups' && (
                <div className="flex flex-col gap-4 animate-in fade-in">
                    {!isGroupingMode ? (
                        <>
                            <button
                                onClick={() => { setIsGroupingMode(true); setGroupSelection([]); setNewGroupName(''); }}
                                className="w-full py-3 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors flex justify-center items-center gap-2"
                            >
                                <PlusCircle size={16} /> Направи нову групу
                            </button>

                            {/* --- NOVO: Lista sačuvanih grupa --- */}
                            <div className="mt-2 flex flex-col gap-2">
                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-1">Сачуване групе</h4>
                                {isLoadingGroups ? (
                                    <div className="text-xs text-slate-500 text-center py-4">Учитавање...</div>
                                ) : savedGroups.length === 0 ? (
                                    <div className="text-xs text-slate-400 text-center italic py-4">Немате сачуваних група.</div>
                                ) : (
                                    savedGroups.map((group: any) => (
                                        <div key={group.id} className="bg-white p-3 border border-slate-200 rounded-xl shadow-sm flex items-center justify-between group-item transition-all hover:border-blue-300 hover:shadow-md">
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-sm font-bold text-slate-700 truncate" title={group.name}>{group.name}</span>
                                                {/* Ako backend bude vraćao JSON dekodiran, ovo će pokazati broj elemenata u grupi */}
                                                <span className="text-[10px] text-slate-400 mt-0.5">{group.elements?.length || 0} елемената унутра</span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => {
                                                        // Окидамо евент и шаљемо елементе Canvas-у
                                                        window.dispatchEvent(new CustomEvent('insert-saved-group', {
                                                            detail: { elements: group.elements }
                                                        }));
                                                    }}
                                                    className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Уметни на дно странице"
                                                >
                                                    <ArrowDownToLine size={14} />
                                                </button>
                                                <button
                                                    onClick={() => deleteGroup(group.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Обриши групу"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="bg-white rounded-[20px] p-4 shadow-sm border border-blue-200 flex flex-col gap-3 ring-4 ring-blue-50">
                            <h3 className="text-xs font-bold text-slate-700 uppercase">Нова група</h3>
                            <p className="text-[11px] text-slate-500 leading-tight">Кликните на елементе на страници које желите да групишете. ({groupSelection?.length || 0} изабрано)</p>
                            <input
                                type="text"
                                placeholder="Назив групе..."
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-lg p-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 mt-2"
                            />
                            <div className="flex gap-2 mt-2">
                                <button
                                    onClick={() => { setIsGroupingMode(false); setGroupSelection([]); }}
                                    className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200"
                                >
                                    Одустани
                                </button>
                                <button
                                    onClick={() => {
                                        if (!newGroupName) return alert("Унесите назив групе!");
                                        if (groupSelection.length === 0) return alert("Изаберите бар један елемент!");
                                        // Окидамо евент који ће Canvas да ухвати
                                        window.dispatchEvent(new CustomEvent('create-group', { detail: { groupName: newGroupName, selectedIds: groupSelection } }));
                                    }}
                                    className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold hover:bg-blue-600 shadow-sm"
                                >
                                    Сачувај
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 3. ОСТАТАК ПОСТОЈЕЋЕГ КОДА УМОТАН У "ELEMENT" ТАБ */}
            <div style={{ display: activeTab === 'element' ? 'flex' : 'none', flexDirection: 'column', gap: '1.25rem' }}>
                {!selectedElement ? (
                    <div className="text-sm text-slate-400 text-center mt-10 uppercase tracking-widest">Изаберите елемент</div>
                ) : (
                    <>
                        <h3 className="text-[12px] text-slate-400 font-bold tracking-wider uppercase flex items-center gap-2 mb-[-10px]">
                            <Star size={14} /> Опште опције
                        </h3>

                        <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex flex-col gap-4 relative z-0">
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

                            {/* OPCIJE ZA RAZMAK (SPACING) - Dostupno za sve elemente */}
                            <div className="pt-3 border-t border-slate-50 flex flex-col gap-3">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Размак (Spacing)</span>
                                <div className="flex gap-4">
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500 font-medium">Горе</span>
                                            <span className="text-[10px] font-bold text-blue-500">{settings.marginTop || 0}px</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="120" step="4"
                                            value={settings.marginTop || 0}
                                            onChange={(e) => updateElementSettings({ marginTop: parseInt(e.target.value) })}
                                            className="w-full accent-blue-500"
                                        />
                                    </div>
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] text-slate-500 font-medium">Доле</span>
                                            <span className="text-[10px] font-bold text-blue-500">{settings.marginBottom || 0}px</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="120" step="4"
                                            value={settings.marginBottom || 0}
                                            onChange={(e) => updateElementSettings({ marginBottom: parseInt(e.target.value) })}
                                            className="w-full accent-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {selectedElement.type === 'chart' && (
                            <>
                                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex flex-col gap-3 relative z-20 mt-3">
                                    <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wide">Назив графикона (наслов)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 text-sm text-slate-600 outline-none focus:border-blue-400 transition-all"
                                        placeholder="Унесите назив..."
                                        value={settings.title || ''}
                                        onChange={(e) => updateElementSettings({ title: e.target.value })}
                                    />

                                    <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wide mt-1">Поднаслов графикона</label>
                                    <input
                                        type="text"
                                        className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 text-sm text-slate-600 outline-none focus:border-blue-400 transition-all"
                                        placeholder="Унесите поднаслов..."
                                        value={settings.subtitle || ''}
                                        onChange={(e) => updateElementSettings({ subtitle: e.target.value })}
                                    />
                                    {settings.subtitle && (
                                        <div className="flex gap-1 bg-[#F8FAFC] p-1 rounded-lg border border-slate-100 w-fit">
                                            <button onClick={() => updateElementSettings({ subtitleAlign: 'left' })} className={`p-1.5 rounded ${(settings.subtitleAlign || 'left') === 'left' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`} title="Поравнање лево"><AlignLeft size={14} /></button>
                                            <button onClick={() => updateElementSettings({ subtitleAlign: 'center' })} className={`p-1.5 rounded ${settings.subtitleAlign === 'center' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`} title="Поравнање центар"><AlignCenter size={14} /></button>
                                            <button onClick={() => updateElementSettings({ subtitleAlign: 'right' })} className={`p-1.5 rounded ${settings.subtitleAlign === 'right' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`} title="Поравнање десно"><AlignRight size={14} /></button>
                                        </div>
                                    )}

                                    <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wide mt-1">Опис графикона (испод)</label>
                                    <RichDescriptionEditor
                                        value={settings.description || ''}
                                        onChange={(html) => updateElementSettings({ description: html })}
                                        elementKey={selectedElement.elementId}
                                    />

                                    <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wide mt-1">Извор графикона</label>
                                    <textarea
                                        className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 text-sm text-slate-600 outline-none focus:border-blue-400 transition-all resize-none"
                                        rows={2}
                                        placeholder="нпр. РАТЕЛ, 2024."
                                        value={settings.source || ''}
                                        onChange={(e) => updateElementSettings({ source: e.target.value })}
                                    />
                                </div>

                                <div className="flex flex-col gap-3">
                                    {/* Axis range controls */}
                                    {['bar', 'line', 'composed', 'scatter'].includes(settings.chartType) && (() => {
                                        const subType = selectedElement?.extraPayload?.subChartType || settings.subChartType || '';
                                        const isHorizontalBar = settings.chartType === 'bar' && (subType === 'grouped_h' || subType === 'stacked_h');
                                        const isScatter = settings.chartType === 'scatter';
                                        // Vertical charts have numeric Y; horizontal bar has numeric X
                                        const showY = !isHorizontalBar;
                                        const showX = isHorizontalBar || isScatter;
                                        const axisInput = (label: string, minKey: string, maxKey: string) => (
                                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] text-slate-400 font-semibold block mb-1">Минимум</label>
                                                        <input
                                                            type="number"
                                                            placeholder="Auto"
                                                            value={(settings as any)[minKey] ?? ''}
                                                            onChange={e => updateElementSettings({ [minKey]: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] text-slate-400 font-semibold block mb-1">Максимум</label>
                                                        <input
                                                            type="number"
                                                            placeholder="Auto"
                                                            value={(settings as any)[maxKey] ?? ''}
                                                            onChange={e => updateElementSettings({ [maxKey]: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                            className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                        const showAxisTitles = isScatter;
                                        return (
                                            <>
                                                {showAxisTitles && (
                                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Називи оса</span>
                                                        <div className="flex flex-col gap-2">
                                                            <div>
                                                                <label className="text-[10px] text-slate-400 font-semibold block mb-1">Назив X осе</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="нпр. Број претплатника (у 000)"
                                                                    value={(settings as any).xAxisTitle ?? ''}
                                                                    onChange={e => updateElementSettings({ xAxisTitle: e.target.value })}
                                                                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] text-slate-400 font-semibold block mb-1">Назив Y осе</label>
                                                                <input
                                                                    type="text"
                                                                    placeholder="нпр. Број пакета са 3 и 4 услуге"
                                                                    value={(settings as any).yAxisTitle ?? ''}
                                                                    onChange={e => updateElementSettings({ yAxisTitle: e.target.value })}
                                                                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                {showY && axisInput('Опсег Y осе (вертикална)', 'yAxisMin', 'yAxisMax')}
                                                {showX && axisInput('Опсег X осе (хоризонтална)', 'xAxisMin', 'xAxisMax')}
                                                {!isHorizontalBar && !isScatter && ['bar', 'line', 'composed'].includes(settings.chartType) && (() => {
                                                    const seriesKeys: string[] = selectedElement?.extraPayload?.keys || settings.keys || [];
                                                    const seriesColors = selectedElement?.extraPayload?.colors || settings.colors || {};
                                                    const PRIMARY = ['#8b98ff', '#34d399', '#06b6d4', '#2563eb', '#1e3a8a', '#f59e0b', '#e11d48', '#c084fc', '#f97316', '#84cc16', '#0f766e', '#f43f5e'];
                                                    return (
                                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-2">
                                                            <label className="flex items-center justify-between cursor-pointer group">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Дупла Y оса</span>
                                                                <div className={`w-9 h-5 flex items-center rounded-full p-1 transition-colors ${settings.dualYAxis ? 'bg-blue-500' : 'bg-slate-200'}`}>
                                                                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${settings.dualYAxis ? 'translate-x-4' : ''}`} />
                                                                </div>
                                                                <input type="checkbox" className="hidden" checked={!!settings.dualYAxis} onChange={() => updateElementSettings({ dualYAxis: !settings.dualYAxis })} />
                                                            </label>
                                                            {settings.dualYAxis && (
                                                                <>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">Серије по оси</span>
                                                                    <div className="flex flex-col gap-1.5">
                                                                        {seriesKeys.map((k, i) => {
                                                                            const side = settings.yAxisSide?.[k] || 'left';
                                                                            const color = seriesColors[k] || PRIMARY[i % PRIMARY.length];
                                                                            return (
                                                                                <div key={k} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 border border-slate-100">
                                                                                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                                                                    <span className="text-xs text-slate-600 flex-1 truncate" title={k}>{k}</span>
                                                                                    <div className="flex gap-1">
                                                                                        {(['left', 'right'] as const).map(s => (
                                                                                            <button key={s}
                                                                                                onClick={() => updateElementSettings({ yAxisSide: { ...(settings.yAxisSide || {}), [k]: s } })}
                                                                                                className={`px-2 py-0.5 text-[10px] font-bold rounded ${side === s ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                                                            >{s === 'left' ? 'Лева' : 'Десна'}</button>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase mt-1">Опсег десне Y осе</span>
                                                                    <div className="flex gap-2">
                                                                        <div className="flex-1">
                                                                            <label className="text-[10px] text-slate-400 font-semibold block mb-1">Минимум</label>
                                                                            <input type="number" placeholder="Auto" value={(settings as any).yAxisMinRight ?? ''}
                                                                                onChange={e => updateElementSettings({ yAxisMinRight: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white" />
                                                                        </div>
                                                                        <div className="flex-1">
                                                                            <label className="text-[10px] text-slate-400 font-semibold block mb-1">Максимум</label>
                                                                            <input type="number" placeholder="Auto" value={(settings as any).yAxisMaxRight ?? ''}
                                                                                onChange={e => updateElementSettings({ yAxisMaxRight: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white" />
                                                                        </div>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                                {!isHorizontalBar && (
                                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-2">
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Одмак X осе</span>
                                                        <div className="flex gap-2">
                                                            <div className="flex-1">
                                                                <label className="text-[10px] text-slate-400 font-semibold block mb-1">Лево (px)</label>
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    min={0}
                                                                    value={(settings as any).xAxisPaddingLeft ?? ''}
                                                                    onChange={e => updateElementSettings({ xAxisPaddingLeft: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white"
                                                                />
                                                            </div>
                                                            <div className="flex-1">
                                                                <label className="text-[10px] text-slate-400 font-semibold block mb-1">Десно (px)</label>
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    min={0}
                                                                    value={(settings as any).xAxisPaddingRight ?? ''}
                                                                    onChange={e => updateElementSettings({ xAxisPaddingRight: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}

                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-sm text-slate-600 font-medium">Прикажи вредности</span>
                                        <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${settings.showLabels ? 'bg-blue-500' : 'bg-slate-200'}`}>
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.showLabels ? 'translate-x-4' : ''}`} />
                                        </div>
                                        <input type="checkbox" className="hidden" checked={settings.showLabels} onChange={() => updateElementSettings({ showLabels: !settings.showLabels })} />
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-sm text-slate-600 font-medium">Вредности у %</span>
                                        <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${settings.isPercentage ? 'bg-blue-500' : 'bg-slate-200'}`}>
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.isPercentage ? 'translate-x-4' : ''}`} />
                                        </div>
                                        <input type="checkbox" className="hidden" checked={!!settings.isPercentage} onChange={() => updateElementSettings({ isPercentage: !settings.isPercentage })} />
                                    </label>
                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Број децимала</span>
                                        <div className="flex gap-1">
                                            {([undefined, 0, 1, 2, 3, 4] as const).map((d) => {
                                                const isActive = settings.decimals === d || (d === undefined && (settings.decimals === undefined || settings.decimals === null));
                                                return (
                                                    <button
                                                        key={d === undefined ? 'auto' : d}
                                                        onClick={() => updateElementSettings({ decimals: d })}
                                                        className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-colors ${isActive ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}
                                                        title={d === undefined ? 'Аутоматски' : `${d} децимала`}
                                                    >
                                                        {d === undefined ? 'Auto' : d}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-sm text-slate-600 font-medium">Прикажи легенду</span>
                                        <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${settings.showLegend ? 'bg-blue-500' : 'bg-slate-200'}`}>
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.showLegend ? 'translate-x-4' : ''}`} />
                                        </div>
                                        <input type="checkbox" className="hidden" checked={settings.showLegend} onChange={() => updateElementSettings({ showLegend: !settings.showLegend })} />
                                    </label>

                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-sm text-slate-600 font-medium">Прикажи табелу са подацима</span>
                                        <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${settings.showDataTable ? 'bg-blue-500' : 'bg-slate-200'}`}>
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.showDataTable ? 'translate-x-4' : ''}`} />
                                        </div>
                                        <input type="checkbox" className="hidden" checked={!!settings.showDataTable} onChange={() => updateElementSettings({ showDataTable: !settings.showDataTable })} />
                                    </label>

                                    {settings.showLegend && (
                                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-3">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Легенда — позиција</span>
                                            <div className="flex gap-1">
                                                {(['top', 'bottom', 'right'] as const).map(v => (
                                                    <button key={v}
                                                        onClick={() => updateElementSettings({ legendPosition: v })}
                                                        className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                                                            (settings.legendPosition || 'bottom') === v
                                                                ? 'bg-blue-500 text-white border-blue-500'
                                                                : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                                                        }`}>
                                                        {v === 'top' ? 'Горе' : v === 'bottom' ? 'Доле' : 'Десно'}
                                                    </button>
                                                ))}
                                            </div>
                                            {(settings.legendPosition || 'bottom') !== 'right' && (
                                                <>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Поравнање</span>
                                                    <div className="flex gap-1">
                                                        {(['left', 'center', 'right'] as const).map(a => (
                                                            <button key={a} onClick={() => updateElementSettings({ legendAlign: a })}
                                                                className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-colors ${(settings.legendAlign || 'center') === a ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'}`}>
                                                                {a === 'left' ? 'Лево' : a === 'center' ? 'Центар' : 'Десно'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
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

                                <div className="bg-white rounded-[20px] p-4 shadow-sm border border-slate-100 flex flex-col gap-4 relative z-0 mb-3">
                                    <label className="flex items-center justify-between cursor-pointer group">
                                        <span className="text-sm text-slate-600 font-medium">Прикажи легенду</span>
                                        <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${settings.showLegend ? 'bg-blue-500' : 'bg-slate-200'}`}>
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${settings.showLegend ? 'translate-x-4' : ''}`} />
                                        </div>
                                        <input type="checkbox" className="hidden" checked={settings.showLegend} onChange={() => updateElementSettings({ showLegend: !settings.showLegend })} />
                                    </label>

                                    <div className="flex flex-col gap-2 mt-2">
                                        <div className="flex justify-between items-center ml-1">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Ширина мапе</label>
                                            <span className="text-[11px] font-bold text-blue-500">{settings.width || 100}%</span>
                                        </div>
                                        <input
                                            type="range" min="20" max="100" step="5"
                                            value={settings.width || 100}
                                            onChange={(e) => updateElementSettings({ width: parseInt(e.target.value) })}
                                            className="w-full accent-blue-500"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2 mt-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide ml-1">Основна боја</label>
                                        <div className="flex justify-between gap-1">
                                            {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'].map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => updateElementSettings({ baseColor: color })}
                                                    className={`w-8 h-8 rounded-lg border border-slate-100 hover:scale-110 hover:shadow-md transition-all ${settings.baseColor === color || (!settings.baseColor && color === '#3b82f6') ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <h3 className="text-[12px] text-slate-400 font-bold tracking-wider uppercase mt-1">Подаци по окрузима</h3>

                                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden relative z-0">
                                    <div className="flex text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-3 py-2 border-b border-slate-100">
                                        <div className="flex-1">Округ</div>
                                        <div className="w-20 text-right">Вредност</div>
                                    </div>

                                    <div className="flex flex-col max-h-[350px] overflow-y-auto custom-scrollbar">
                                        {SERBIAN_DISTRICTS.map((district) => {
                                            const rowData = mapData.find((d: any) => d.name === district);

                                            let valToDisplay = '';
                                            if (rowData) {
                                                if (rowData['Вредност'] !== undefined) {
                                                    valToDisplay = rowData['Вредност'];
                                                } else {
                                                    const valueKey = Object.keys(rowData).find(k => k !== 'name');
                                                    if (valueKey) {
                                                        valToDisplay = rowData[valueKey];
                                                    }
                                                }
                                            }

                                            return (
                                                <div key={district} className="flex items-center gap-2 px-3 py-2 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <span className="flex-1 text-xs font-medium text-slate-600 truncate" title={district}>
                                            {district}
                                        </span>
                                                    <input
                                                        type="number"
                                                        value={valToDisplay}
                                                        onChange={(e) => handleMapValueChange(district, e.target.value)}
                                                        placeholder="0"
                                                        className="w-20 text-xs text-right bg-transparent border-b border-slate-200 focus:border-blue-400 outline-none p-1 text-slate-700 font-medium"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* PALETE SAMO ZA CHART */}
                        {(selectedElement.type === 'chart') && (
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
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wide">Назив табеле (наслов)</label>
                                        <input
                                            type="text"
                                            className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 text-sm text-slate-600 outline-none focus:border-blue-400 transition-all"
                                            placeholder="Унесите назив табеле..."
                                            value={settings.title || ''}
                                            onChange={(e) => updateElementSettings({ title: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="text-[11px] font-bold text-slate-400 uppercase ml-1 tracking-wide">Опис табеле (испод)</label>
                                        <textarea
                                            className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl p-3 text-sm text-slate-600 outline-none focus:border-blue-400 transition-all resize-none"
                                            rows={2}
                                            placeholder="Унесите опис табеле..."
                                            value={settings.description || ''}
                                            onChange={(e) => updateElementSettings({ description: e.target.value })}
                                        />
                                    </div>

                                    <div className="flex flex-col gap-3 mt-2">
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

                                        {(() => {
                                            const [acR, acC] = (selectedElement.activeCell || '0_0').split('_').map(Number);
                                            const acSt = settings.cells?.[selectedElement.activeCell!] || {};
                                            const acColSpan = acSt.colSpan || 1;
                                            const acRowSpan = acSt.rowSpan || 1;
                                            const canMergeRight = (acC + acColSpan) < (settings.columns || 1);
                                            const canMergeDown  = (acR + acRowSpan) < (settings.rows || 1);
                                            const canUnmerge    = acColSpan > 1 || acRowSpan > 1;
                                            return (
                                                <div className="flex flex-col gap-2">
                                                    <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Спајање ћелија (Merge)</label>
                                                    <div className="flex gap-1 bg-[#F8FAFC] p-1 rounded-lg border border-slate-100 justify-between">
                                                        <button
                                                            onClick={handleMergeRight}
                                                            disabled={!canMergeRight}
                                                            title={canMergeRight ? "Споји са десном ћелијом" : "Нема ћелије десно"}
                                                            className={`p-2 rounded-lg flex items-center justify-center flex-1 gap-1 transition-colors ${canMergeRight ? 'text-slate-600 hover:bg-white' : 'text-slate-300 cursor-not-allowed'}`}
                                                        >
                                                            <ArrowRightToLine size={16} />
                                                        </button>
                                                        <button
                                                            onClick={handleMergeDown}
                                                            disabled={!canMergeDown}
                                                            title={canMergeDown ? "Споји са доњом ћелијом" : "Нема ћелије испод"}
                                                            className={`p-2 rounded-lg flex items-center justify-center flex-1 gap-1 transition-colors ${canMergeDown ? 'text-slate-600 hover:bg-white' : 'text-slate-300 cursor-not-allowed'}`}
                                                        >
                                                            <ArrowDownMerge size={16} />
                                                        </button>
                                                        <button
                                                            onClick={handleUnmerge}
                                                            disabled={!canUnmerge}
                                                            title={canUnmerge ? "Раздвој спојене ћелије" : "Ћелија није спојена"}
                                                            className={`p-2 rounded-lg flex items-center justify-center flex-1 gap-1 transition-colors ${canUnmerge ? 'text-red-400 hover:bg-white' : 'text-slate-300 cursor-not-allowed'}`}
                                                        >
                                                            <SplitSquareHorizontal size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        <div className="flex flex-col gap-2">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Форматирање</label>
                                            <div className="flex gap-1 bg-[#F8FAFC] p-1 rounded-lg border border-slate-100 justify-between">
                                                <button onMouseDown={(e) => { e.preventDefault(); formatText('bold'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white"><Bold size={16} /></button>
                                                <button onMouseDown={(e) => { e.preventDefault(); formatText('italic'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white"><Italic size={16} /></button>
                                                <button onMouseDown={(e) => { e.preventDefault(); toggleInlineTag('sup'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white"><Superscript size={16} /></button>
                                                <button onMouseDown={(e) => { e.preventDefault(); toggleInlineTag('sub'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white"><Subscript size={16} /></button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Стил текста</label>
                                            <div className="flex bg-[#F8FAFC] p-1 rounded-lg border border-slate-100 w-full">
                                                <button onClick={() => { const cellKey = selectedElement.activeCell!; updateElementSettings({ cells: { ...settings.cells, [cellKey]: { ...settings.cells?.[cellKey], type: 'headline' } } }); }} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded ${settings.cells?.[selectedElement.activeCell!]?.type === 'headline' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}>Наслов</button>
                                                <button onClick={() => { const cellKey = selectedElement.activeCell!; updateElementSettings({ cells: { ...settings.cells, [cellKey]: { ...settings.cells?.[cellKey], type: 'paragraph' } } }); }} className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded ${settings.cells?.[selectedElement.activeCell!]?.type !== 'headline' ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}>Текст</button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <label className="text-[11px] font-bold text-slate-400 uppercase ml-1">Поравнање</label>
                                            <div className="flex gap-2">
                                                <div className="flex-1 flex bg-[#F8FAFC] p-1 rounded-lg border border-slate-100 gap-1">
                                                    {(['left', 'center', 'right'] as const).map(a => {
                                                        const cellAlign = settings.cells?.[selectedElement.activeCell!]?.alignment || 'left';
                                                        const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                                                        return (
                                                            <button
                                                                key={a}
                                                                onClick={() => { const cellKey = selectedElement.activeCell!; updateElementSettings({ cells: { ...settings.cells, [cellKey]: { ...settings.cells?.[cellKey], alignment: a } } }); }}
                                                                className={`flex-1 p-1.5 rounded flex items-center justify-center ${cellAlign === a ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}
                                                                title={a === 'left' ? 'Лево' : a === 'center' ? 'Центар' : 'Десно'}
                                                            ><Icon size={14} /></button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="flex-1 flex bg-[#F8FAFC] p-1 rounded-lg border border-slate-100 gap-1">
                                                    {(['top', 'middle', 'bottom'] as const).map(v => {
                                                        const cellVAlign = settings.cells?.[selectedElement.activeCell!]?.verticalAlignment || 'top';
                                                        const Icon = v === 'top' ? ArrowUpToLine : v === 'middle' ? FoldVertical : ArrowDownToLine;
                                                        return (
                                                            <button
                                                                key={v}
                                                                onClick={() => { const cellKey = selectedElement.activeCell!; updateElementSettings({ cells: { ...settings.cells, [cellKey]: { ...settings.cells?.[cellKey], verticalAlignment: v } } }); }}
                                                                className={`flex-1 p-1.5 rounded flex items-center justify-center ${cellVAlign === v ? 'bg-white shadow-sm text-blue-500' : 'text-slate-400'}`}
                                                                title={v === 'top' ? 'Горе' : v === 'middle' ? 'Средина' : 'Доле'}
                                                            ><Icon size={14} /></button>
                                                        );
                                                    })}
                                                </div>
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
                                            <div className="flex flex-wrap gap-2">
                                                {['#FFFFFF', '#E2E8F0', '#FEF3C7', '#FECACA', '#BBF7D0', '#8b98ff', '#34d399'].map(color => (
                                                    <button key={color} onClick={() => { const cellKey = selectedElement.activeCell!; updateElementSettings({ cells: { ...settings.cells, [cellKey]: { ...settings.cells?.[cellKey], backgroundColor: color } } }); }} className={`w-7 h-7 rounded-lg border border-slate-200 transition-transform ${settings.cells?.[selectedElement.activeCell!]?.backgroundColor === color ? 'scale-125 ring-2 ring-blue-300 ring-offset-1 shadow-md' : 'hover:scale-110'}`} style={{ backgroundColor: color }} />
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
                                            onMouseDown={(e) => { e.preventDefault(); handleFormatBlock('H1'); }}
                                            className="flex-1 py-1.5 text-[11px] font-bold rounded text-slate-600 hover:bg-white hover:text-blue-600 shadow-sm transition-colors flex items-center justify-center gap-1"
                                            title="Велики наслов"
                                        >
                                            <Heading1 size={14} /> H1
                                        </button>
                                        <button
                                            onMouseDown={(e) => { e.preventDefault(); handleFormatBlock('H2'); }}
                                            className="flex-1 py-1.5 text-[11px] font-bold rounded text-slate-600 hover:bg-white hover:text-blue-600 shadow-sm transition-colors flex items-center justify-center gap-1"
                                            title="Мали наслов"
                                        >
                                            <Heading2 size={14} /> H2
                                        </button>
                                        <button
                                            onMouseDown={(e) => { e.preventDefault(); handleFormatBlock('P'); }}
                                            className="flex-1 py-1.5 text-[11px] font-bold rounded text-slate-600 hover:bg-white hover:text-blue-600 shadow-sm transition-colors flex items-center justify-center gap-1"
                                            title="Обичан текст"
                                        >
                                            <Type size={12} /> Текст
                                        </button>
                                        <button
                                            onMouseDown={(e) => { e.preventDefault(); handleFormatBlock('P', true); }}
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
                                            <button onMouseDown={(e) => { e.preventDefault(); toggleInlineTag('sup'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white" title="Степен"><Superscript size={16} /></button>
                                            <button onMouseDown={(e) => { e.preventDefault(); toggleInlineTag('sub'); }} className="p-2 rounded-lg text-slate-600 hover:bg-white" title="Индекс"><Subscript size={16} /></button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Боја текста:</span>
                                        <div className="flex gap-1.5 px-1 ml-auto">
                                            <button onMouseDown={(e) => { e.preventDefault(); applyTextColor('#1E293B'); }} className={`w-6 h-6 rounded-lg bg-[#1E293B] ${settings.color === '#1E293B' || !settings.color ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                                            <button onMouseDown={(e) => { e.preventDefault(); applyTextColor('#FFFFFF'); }} className={`w-6 h-6 rounded-lg bg-white border border-slate-200 ${settings.color === '#FFFFFF' ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                                            <button onMouseDown={(e) => { e.preventDefault(); applyTextColor('#7E9CF1'); }} className={`w-6 h-6 rounded-lg bg-[#7E9CF1] ${settings.color === '#7E9CF1' ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Боја позадине:</span>
                                        <div className="flex gap-1.5 px-1 ml-auto">
                                            <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ backgroundColor: '' }); }} className={`w-6 h-6 rounded-lg bg-white border border-slate-200 ${!settings.backgroundColor ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`} title="Без позадине">
                                                <div className="w-full h-full rounded-md bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#e2e8f0_2px,#e2e8f0_4px)]"></div>
                                            </button>
                                            <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ backgroundColor: '#F8FAFC' }); }} className={`w-6 h-6 rounded-lg bg-[#F8FAFC] border border-slate-200 ${settings.backgroundColor === '#F8FAFC' ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                                            <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ backgroundColor: '#E2E8F0' }); }} className={`w-6 h-6 rounded-lg bg-[#E2E8F0] border border-slate-200 ${settings.backgroundColor === '#E2E8F0' ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                                            <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ backgroundColor: '#8b98ff' }); }} className={`w-6 h-6 rounded-lg bg-[#8b98ff] border border-slate-200 ${settings.backgroundColor === '#8b98ff' ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
                                            <button onMouseDown={(e) => { e.preventDefault(); updateElementSettings({ backgroundColor: '#34d399' }); }} className={`w-6 h-6 rounded-lg bg-[#34d399] border border-slate-200 ${settings.backgroundColor === '#34d399' ? 'ring-2 ring-offset-1 ring-blue-500 shadow-md' : ''}`}></button>
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
                                            <button onMouseDown={(e) => { e.preventDefault(); handleFormatBlock('BLOCKQUOTE'); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"><Quote size={16} /></button>
                                            <button onMouseDown={(e) => { e.preventDefault(); handleAddLink(); }} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"><Link2 size={16} /></button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ЗАЈЕДНИЧКА СЕКЦИЈА ЗА УРЕЂИВАЊЕ ТЕКСТА ФУСНОТА */}
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
                    </>
                )}
            </div>

        </aside>
    );
};

export default RightSidebar;
