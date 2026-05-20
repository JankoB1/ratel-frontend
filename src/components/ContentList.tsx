import React from "react";
import { EyeOff, Eye } from "lucide-react";

interface ContentListProps {
    sections: any[];
    activeSectionId: number | null;
    onSectionChange: (id: number) => void;
    onSectionToggleDisabled?: (id: number, currentlyDisabled: boolean) => void;
}

const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}.`;
};

const ContentList: React.FC<ContentListProps> = ({ sections, activeSectionId, onSectionChange, onSectionToggleDisabled }) => {
    return (
        <div className="w-60 shrink-0 text-dark-blue sticky top-0 h-[92vh] overflow-y-auto overflow-x-hidden pr-6 custom-scrollbar pb-20">
            <ul className="space-y-4 text-[14px] font-bold uppercase tracking-tight">
                {sections.map((section, index) => {
                    const isActive = activeSectionId === section.id;
                    const isDisabled = !!section.is_disabled;

                    return (
                        <li key={section.id} className="group">
                            <div
                                onClick={() => !isDisabled && onSectionChange(section.id)}
                                className={`flex items-start gap-1.5 transition-all ${
                                    isDisabled
                                        ? 'cursor-default opacity-40'
                                        : `cursor-pointer hover:text-blue-500 ${isActive ? 'text-[#0056B3] translate-x-1' : ''}`
                                }`}
                            >
                                <span className="flex-1 leading-snug">
                                    {index + 1}. {section.title}
                                </span>

                                {onSectionToggleDisabled && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSectionToggleDisabled(section.id, isDisabled);
                                        }}
                                        title={isDisabled ? 'Активирај секцију' : 'Деактивирај секцију'}
                                        className={`mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-slate-100 ${
                                            isDisabled ? '!opacity-100 text-slate-400' : 'text-slate-400 hover:text-slate-600'
                                        }`}
                                    >
                                        {isDisabled ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                )}
                            </div>

                            {section.updated_at && (
                                <div className={`text-[10px] font-normal normal-case tracking-normal mt-0.5 pl-0 transition-colors ${
                                    isDisabled ? 'text-slate-300' : 'text-slate-400'
                                }`}>
                                    Измењено: {formatDate(section.updated_at)}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ContentList;
