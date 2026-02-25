import {ChevronDown, ChevronUp, Copy, Download, type LucideProps, FilePlus, Trash2} from "lucide-react";
import React, {type ReactElement} from "react";

interface SidebarActionButtonProps {
    icon: ReactElement<LucideProps>;
    label: string;
    isBlue?: boolean;
}

const SidebarIcon: React.FC<SidebarActionButtonProps> = ({ icon, label, isBlue = false }) => (
    <button className="flex flex-col items-center group cursor-pointer w-full px-1">
        <div className={`
      w-14 h-14 
      rounded-[50px]
      flex items-center justify-center 
      transition-all duration-200 
      ${isBlue ? 'bg-white text-blue-600' : 'bg-white text-main-text group-hover:bg-slate-50'}
    `}>
            {icon}
        </div>
        <span className="text-[11px] font-normal text-main-text mt-3 text-center leading-[1.2] max-w-[70px] uppercase tracking-tight opacity-80">
      {label}
    </span>
    </button>
);

const LeftSidebar = () => {

    return (
        <aside className="w-[100px] bg-background-grey border-r border-r-[0.5px] border-solid border-[#3749571F] flex flex-col items-center py-8 gap-4">
            <div className="bg-white rounded-[50px] flex flex-col items-center p-2 overflow-hidden mb-6">
                <button className="p-3 hover:bg-slate-50 transition-colors text-main-text">
                    <ChevronUp size={18} strokeWidth={3} />
                </button>
                <div className="separator-line" />
                <button className="p-3 hover:bg-slate-50 transition-colors text-main-text">
                    <ChevronDown size={18} strokeWidth={3} />
                </button>
            </div>

            <SidebarIcon icon={<FilePlus />} label="ДОДАТИ НОВУ СТРАНУ" />
            <SidebarIcon icon={<Copy />} label="ДУПЛИРАТИ СТРАНУ" />
            <SidebarIcon icon={<Trash2 />} label="ИЗБРИСАТИ СТРАНУ" />

            <div className="mt-16">
                <SidebarIcon icon={<Download size={24} />} label="САЧУВАЈ" />
            </div>
        </aside>
    )

}

export default LeftSidebar;