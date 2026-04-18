import { ChevronDown, ChevronUp, Copy, Download, type LucideProps, FilePlus, Trash2, Loader2, Save } from "lucide-react";
import React, { type ReactElement } from "react";

interface SidebarActionButtonProps {
    icon: ReactElement<LucideProps>;
    label: string;
    isBlue?: boolean;
    isActive?: boolean;
    onClick?: () => void;
    disabled?: boolean;
}

const SidebarIcon: React.FC<SidebarActionButtonProps> = ({ icon, label, isBlue = false, isActive = false, onClick, disabled }) => (
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

interface LeftSidebarProps {
    onSave: () => void;
    onDownload: () => void;
    isSaving: boolean;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({ onSave, onDownload, isSaving }) => {
    return (
        <aside className="w-[110px] bg-[#f8fafc] border-r border-slate-200 flex flex-col items-center py-6 gap-4 h-full overflow-y-auto custom-scrollbar z-40 shrink-0">

            <div className="bg-white rounded-[50px] flex flex-col items-center p-2 shadow-sm border border-slate-100 mb-8">
                <button className="p-3 hover:bg-slate-50 rounded-full transition-colors text-slate-500">
                    <ChevronUp size={18} strokeWidth={3} />
                </button>
                <div className="w-8 h-[1px] bg-slate-200 my-1" />
                <button className="p-3 hover:bg-slate-50 rounded-full transition-colors text-slate-500">
                    <ChevronDown size={18} strokeWidth={3} />
                </button>
            </div>

            <SidebarIcon icon={<FilePlus size={20} />} label="ДОДАТИ НОВУ СТРАНУ" />
            <SidebarIcon icon={<Copy size={20} />} label="ДУПЛИРАТИ СТРАНУ" />
            <SidebarIcon icon={<Trash2 size={20} />} label="ИЗБРИСАТИ СТРАНУ" />

            {/* Odeljak sa dugmićima na dnu */}
            <div className="mt-auto flex flex-col gap-2 w-full pb-4">
                <SidebarIcon
                    icon={isSaving ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}
                    label={isSaving ? "Чување..." : "САЧУВАЈ"}
                    isBlue
                    onClick={onSave}
                    disabled={isSaving}
                />

                <SidebarIcon
                    icon={isSaving ? <Loader2 size={24} className="animate-spin" /> : <Download size={24} />}
                    label="ПРЕУЗМИ PDF"
                    isBlue
                    onClick={onDownload}
                    disabled={isSaving}
                />
            </div>
        </aside>
    )
}

export default LeftSidebar;
