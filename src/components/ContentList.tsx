import React from "react";

interface ContentListProps {
    sections: any[];
    activeSectionId: number | null;
    onSectionChange: (id: number) => void;
}

const ContentList: React.FC<ContentListProps> = ({ sections, activeSectionId, onSectionChange }) => {
    return (
        <div className="w-60 shrink-0 text-dark-blue sticky top-0 h-[92vh] overflow-y-auto overflow-x-hidden pr-6 custom-scrollbar pb-20">
            <ul className="space-y-4 text-[14px] font-bold uppercase tracking-tight">
                {sections.map((section, index) => {
                    const isActive = activeSectionId === section.id;

                    return (
                        <li
                            key={section.id}
                            onClick={() => onSectionChange(section.id)}
                            className={`cursor-pointer transition-all hover:text-blue-500 ${isActive ? 'text-[#0056B3] translate-x-1' : ''}`}
                        >
                            {index + 1}. {section.title}
                        </li>
                    );
                })}

                {/* Napomena: Ako kasnije dodaš podsekcije u bazu,
                    ovde možeš da proveriš da li 'section' ima 'subsections'
                    i da ih izrendaš kao onu uvučenu <ul className="pl-6..."> listu.
                */}
            </ul>
        </div>
    );
};

export default ContentList;
