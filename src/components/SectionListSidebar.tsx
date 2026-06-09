interface Props {
    sections: { id: number; title: string }[];
    activeSectionId: number | null;
    onPick: (id: number) => void;
    currentPageIndex?: number;
    totalPages?: number;
    headline?: string;
}

/**
 * Vertikalna lista naslova sekcija sa highlightovanom aktivnom.
 * Koristi se desno na ViewPage, CollectionPage i QuarterlyPage.
 */
export default function SectionListSidebar({ sections, activeSectionId, onPick, currentPageIndex, totalPages, headline }: Props) {
    if (sections.length === 0) return null;
    return (
        <aside className="hidden md:flex w-[260px] shrink-0 bg-white border border-slate-100 rounded-2xl flex-col overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-slate-100 shrink-0">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {headline ?? 'Poglavlja'}
                </div>
                {totalPages !== undefined && totalPages > 0 && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                        Str. {(currentPageIndex ?? 0) + 1} / {totalPages}
                    </div>
                )}
            </div>
            <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                {sections.map((s, idx) => {
                    const isActive = s.id === activeSectionId;
                    return (
                        <button key={s.id} onClick={() => onPick(s.id)}
                            className={`w-full text-left px-4 py-2.5 flex items-start gap-3 transition border-l-2 ${
                                isActive
                                    ? 'bg-blue-50 text-[#0056B3] border-[#0056B3]'
                                    : 'text-slate-600 border-transparent hover:bg-slate-50 hover:text-slate-900'
                            }`}>
                            <span className={`text-[10px] font-bold w-5 shrink-0 ${isActive ? 'text-[#0056B3]' : 'text-slate-300'}`}>{idx + 1}.</span>
                            <span className="text-xs font-semibold leading-tight">{s.title}</span>
                        </button>
                    );
                })}
            </div>
        </aside>
    );
}
