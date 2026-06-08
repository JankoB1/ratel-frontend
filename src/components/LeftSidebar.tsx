import { ChevronDown, ChevronUp, Download, type LucideProps, Loader2, Save, FileText, Files } from "lucide-react";
import { type ReactElement, type FC, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface SidebarActionButtonProps {
    icon: ReactElement<LucideProps>;
    label: string;
    isBlue?: boolean;
    isActive?: boolean;
    onClick?: () => void;
    disabled?: boolean;
}

const SidebarIcon: FC<SidebarActionButtonProps> = ({ icon, label, isBlue = false, isActive = false, onClick, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="flex flex-col items-center group w-full px-1 disabled:opacity-50 disabled:cursor-not-allowed"
    >
        <div className={`
            w-14 h-14
            rounded-[50px]
            flex items-center justify-center
            transition-all duration-200 cursor-pointer
            ${isActive ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500 ring-offset-2' :
            isBlue ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-white text-slate-600 group-hover:bg-slate-50'}
        `}>
            {icon}
        </div>
        <span className={`text-[10px] font-bold mt-3 text-center leading-[1.2] max-w-[80px] uppercase tracking-tight ${isActive ? 'text-blue-600' : 'text-slate-500 opacity-80'}`}>
            {label}
        </span>
    </button>
);

export interface LeftSidebarProps {
    onSave: () => void | Promise<void>;
    onDownload: (sectionId?: number) => void | Promise<void>;
    isSaving: boolean;
    currentPage: number;
    totalPages: number;
    onPageChange: (index: number) => void;
    activeSectionId?: number | null;
    activeSectionTitle?: string | null;
}

const LeftSidebar: FC<LeftSidebarProps> = ({ onSave, onDownload, isSaving, currentPage, totalPages, onPageChange, activeSectionId, activeSectionTitle }) => {
    const [inputValue, setInputValue] = useState(String(currentPage + 1));
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);
    const downloadRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setInputValue(String(currentPage + 1));
    }, [currentPage]);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            const t = e.target as Node;
            if (downloadRef.current?.contains(t) || menuRef.current?.contains(t)) return;
            setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    // Menu se renderuje preko portala (fixed) jer ga overflow/scroll i z-index sidebar-a
    // inače seku — pozicioniramo ga desno od dugmeta na osnovu njegovog bounding rect-a.
    const toggleMenu = () => {
        if (menuOpen) { setMenuOpen(false); return; }
        const el = downloadRef.current;
        if (el) {
            const r = el.getBoundingClientRect();
            setMenuPos({ left: r.right + 8, bottom: window.innerHeight - r.bottom });
        }
        setMenuOpen(true);
    };

    const triggerDownload = (sectionId?: number) => {
        setMenuOpen(false);
        onDownload(sectionId);
    };

    const commit = (raw: string) => {
        const page = parseInt(raw) - 1;
        if (!isNaN(page)) {
            onPageChange(page);
        } else {
            setInputValue(String(currentPage + 1));
        }
    };

    return (
        <aside className="w-[110px] bg-[#f8fafc] border-r border-slate-200 flex flex-col items-center py-6 gap-4 h-full overflow-y-auto custom-scrollbar z-40 shrink-0">
            <div className="bg-white rounded-[50px] flex flex-col items-center p-2 shadow-sm border border-slate-100 mb-8">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="p-3 hover:bg-slate-50 rounded-full transition-colors text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronUp size={18} strokeWidth={3} />
                </button>

                <div className="w-8 h-[1px] bg-slate-200 my-1" />

                <div className="flex flex-col items-center py-2 gap-1">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onBlur={e => commit(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') { commit(inputValue); e.currentTarget.blur(); }
                            if (e.key === 'Escape') { setInputValue(String(currentPage + 1)); e.currentTarget.blur(); }
                        }}
                        className="w-9 text-center text-xs font-bold text-slate-700 bg-transparent border border-slate-200 rounded focus:outline-none focus:border-blue-400 focus:bg-blue-50 transition-colors"
                        style={{ padding: '2px 0' }}
                    />
                    <div className="w-6 h-[1px] bg-slate-200" />
                    <span className="text-[10px] text-slate-400 font-medium">{totalPages}</span>
                </div>

                <div className="w-8 h-[1px] bg-slate-200 my-1" />

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="p-3 hover:bg-slate-50 rounded-full transition-colors text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronDown size={18} strokeWidth={3} />
                </button>
            </div>

            {/* Odeljak sa dugmićima na dnu */}
            <div className="mt-auto flex flex-col gap-2 w-full pb-4">
                <SidebarIcon
                    icon={isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                    label={isSaving ? "Чување..." : "САЧУВАЈ"}
                    isBlue
                    onClick={onSave}
                    disabled={isSaving}
                />

                <div ref={downloadRef} className="relative w-full">
                    <SidebarIcon
                        icon={isSaving ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}
                        label="ПРЕУЗМИ PDF"
                        isBlue
                        isActive={menuOpen}
                        onClick={toggleMenu}
                        disabled={isSaving}
                    />
                    {menuOpen && menuPos && createPortal(
                        <div
                            ref={menuRef}
                            style={{ position: 'fixed', left: menuPos.left, bottom: menuPos.bottom }}
                            className="z-[9999] w-56 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden"
                        >
                            <button
                                onClick={() => triggerDownload()}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                            >
                                <Files size={18} className="text-blue-600 shrink-0" />
                                <span className="text-sm font-medium text-slate-700">Цео документ</span>
                            </button>
                            <div className="h-[1px] bg-slate-100" />
                            <button
                                onClick={() => activeSectionId != null && triggerDownload(activeSectionId)}
                                disabled={activeSectionId == null}
                                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <FileText size={18} className="text-blue-600 shrink-0 mt-0.5" />
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium text-slate-700">Тренутна секција</span>
                                    {activeSectionTitle && (
                                        <span className="block text-[11px] text-slate-400 font-normal truncate">{activeSectionTitle}</span>
                                    )}
                                </span>
                            </button>
                        </div>,
                        document.body
                    )}
                </div>
            </div>
        </aside>
    )
}

export default LeftSidebar;
