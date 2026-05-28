import { useEffect, useState, useMemo, useRef } from "react";
import { Loader2, AlertCircle, Activity } from "lucide-react";
import { DocumentPage, buildMaps } from "../components/DocumentPageView";
import SectionListSidebar from "../components/SectionListSidebar";
import logo from "../assets/logo.svg";

const PAGE_W = 794;

const Q_CATEGORY_LABELS: Record<string, string> = {
    electronic_communications: 'Електронске комуникације',
    postal_services:           'Поштанске услуге',
};

const Q_SUBTYPE_LABELS: Record<string, string> = {
    overview: 'Преглед тржишта електронских комуникација у Републици Србији',
    mobile:   'Приказ мобилних мрежа оператора',
    porting:  'Преглед преноса бројева по операторима фиксне и мобилне телефоније',
};

interface QuarterlyDocMeta {
    id: number;
    title: string;
    q_category: 'electronic_communications' | 'postal_services';
    q_subtype: 'overview' | 'mobile' | 'porting' | null;
    q_year: number;
    q_quarter: number;
}

interface DocFull {
    title: string;
    sections: any[];
}

export default function QuarterlyPage() {
    const [docs, setDocs] = useState<QuarterlyDocMeta[]>([]);
    const [years, setYears] = useState<number[]>([]);
    const [loadingList, setLoadingList] = useState(true);

    // Filter state
    const [fCategory, setFCategory] = useState<'electronic_communications' | 'postal_services' | null>(null);
    const [fSubtype, setFSubtype] = useState<'overview' | 'mobile' | 'porting' | null>(null);
    const [fYear, setFYear] = useState<number | null>(null);
    const [fQuarter, setFQuarter] = useState<number | null>(null);

    // Selected document content
    const [doc, setDoc] = useState<DocFull | null>(null);
    const [loadingDoc, setLoadingDoc] = useState(false);
    const [activeSectionId, setActiveSectionId] = useState<number | null>(null);

    // Auto-zoom
    const [autoZoom, setAutoZoom] = useState(1);
    useEffect(() => {
        const compute = () => {
            const w = window.innerWidth;
            const sidebarRoom = w >= 900 ? 280 : 0; // approx right sidebar
            setAutoZoom(Math.min(1, (w - sidebarRoom - 64) / PAGE_W));
        };
        compute();
        window.addEventListener('resize', compute);
        return () => window.removeEventListener('resize', compute);
    }, []);

    // Initial load + default to latest
    useEffect(() => {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
        fetch(`${backendUrl}/api/portal/quarterly`, { headers: { Accept: "application/json" } })
            .then(r => r.json())
            .then(data => {
                const list: QuarterlyDocMeta[] = data.data || [];
                setDocs(list);
                setYears(data.years || []);
                if (list.length > 0) {
                    // Pre-popuni najnoviji (lista je već sortirana DESC)
                    const latest = list[0];
                    setFCategory(latest.q_category);
                    setFSubtype(latest.q_subtype);
                    setFYear(latest.q_year);
                    setFQuarter(latest.q_quarter);
                }
            })
            .catch(console.error)
            .finally(() => setLoadingList(false));
    }, []);

    // Find document matching filters
    const matchedDoc = useMemo(() => {
        if (!fCategory || !fYear || !fQuarter) return null;
        return docs.find(d =>
            d.q_category === fCategory &&
            d.q_year === fYear &&
            d.q_quarter === fQuarter &&
            (fCategory !== 'electronic_communications' || d.q_subtype === fSubtype)
        ) || null;
    }, [docs, fCategory, fSubtype, fYear, fQuarter]);

    // Load full document when match changes
    useEffect(() => {
        if (!matchedDoc) { setDoc(null); return; }
        setLoadingDoc(true);
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
        fetch(`${backendUrl}/api/print-documents/${matchedDoc.id}`, { headers: { Accept: "application/json" } })
            .then(r => r.json())
            .then(data => {
                setDoc({ title: data.document.title, sections: data.document.sections || [] });
                setActiveSectionId(data.document.sections?.[0]?.id ?? null);
            })
            .catch(console.error)
            .finally(() => setLoadingDoc(false));
    }, [matchedDoc]);

    const { elementLabelMap, globalFootnoteMap } = useMemo(() => buildMaps(doc?.sections || []), [doc]);
    const activeSection = doc?.sections.find((s: any) => s.id === activeSectionId);
    const activePages: any[] = activeSection?.canvas_data || [];

    // Filter options based on data
    const availableSubtypes = useMemo(() => {
        if (fCategory !== 'electronic_communications') return [];
        const subs = new Set(docs.filter(d => d.q_category === 'electronic_communications').map(d => d.q_subtype).filter(Boolean));
        return Array.from(subs);
    }, [docs, fCategory]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            {/* Header + filters */}
            <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 md:py-4 shrink-0">
                <div className="flex items-center gap-3 mb-3 md:mb-4">
                    <img src={logo} alt="Ratel" className="h-7 md:h-8" />
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                        <Activity size={18} className="text-[#0056B3]" />
                        <span>Квартални подаци</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">Категорија</label>
                        <select value={fCategory ?? ''} onChange={e => { const v = e.target.value as any; setFCategory(v || null); if (v !== 'electronic_communications') setFSubtype(null); }}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#0056B3] bg-white">
                            <option value="">— изабери —</option>
                            <option value="electronic_communications">Електронске комуникације</option>
                            <option value="postal_services">Поштанске услуге</option>
                        </select>
                    </div>

                    {fCategory === 'electronic_communications' && (
                        <div className="col-span-2 md:col-span-1">
                            <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">Подкатегорија</label>
                            <select value={fSubtype ?? ''} onChange={e => setFSubtype((e.target.value || null) as any)}
                                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#0056B3] bg-white">
                                <option value="">— изабери —</option>
                                {['overview', 'mobile', 'porting'].map(s => (
                                    <option key={s} value={s} disabled={!availableSubtypes.includes(s as any)}>{Q_SUBTYPE_LABELS[s]}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">Година</label>
                        <select value={fYear ?? ''} onChange={e => setFYear(e.target.value ? Number(e.target.value) : null)}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#0056B3] bg-white">
                            <option value="">— изабери —</option>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1 block">Квартал</label>
                        <div className="flex gap-1">
                            {[1,2,3,4].map(q => (
                                <button key={q} type="button" onClick={() => setFQuarter(q)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${fQuarter===q ? 'bg-[#0056B3] text-white border-[#0056B3]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                    Q{q}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </header>

            {/* Body: pages left, sections right */}
            <div className="flex-1 flex overflow-hidden">
                {loadingList ? (
                    <div className="flex-1 flex items-center justify-center text-slate-300"><Loader2 className="animate-spin" size={32} /></div>
                ) : !matchedDoc ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 px-4 text-center">
                        <AlertCircle size={32} className="mb-3 text-slate-300" />
                        <p className="text-sm font-bold">Нема извештаја за изабране филтере</p>
                        <p className="text-xs mt-1">Промени категорију, годину или квартал.</p>
                    </div>
                ) : (
                    <>
                        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 md:px-8 py-4 md:py-6 custom-scrollbar"
                            onScroll={() => {
                                const c = scrollContainerRef.current; if (!c) return;
                                const pages = c.querySelectorAll<HTMLElement>("[data-page-index]");
                                let best = 0, bestD = Infinity;
                                const center = c.scrollTop + c.clientHeight / 2;
                                pages.forEach(el => { const mid = el.offsetTop + el.offsetHeight / 2; const d = Math.abs(mid - center); if (d < bestD) { bestD = d; best = Number(el.dataset.pageIndex || 0); }});
                                setCurrentPageIndex(best);
                            }}>
                            {loadingDoc ? (
                                <div className="flex justify-center py-20 text-slate-300"><Loader2 className="animate-spin" size={32} /></div>
                            ) : !activeSection ? (
                                <div className="flex items-center justify-center h-full text-slate-400 text-sm">Изаберите секцију.</div>
                            ) : (
                                <div className="flex flex-col items-center gap-4 md:gap-6">
                                    {activePages.map((page: any, pageIdx: number) => (
                                        <div key={page.id} data-page-index={pageIdx}>
                                            <div style={{ zoom: autoZoom }}>
                                                <div className="canvas-wrapper">
                                                    <div className="canvas-page" style={{ width: PAGE_W }}>
                                                        <DocumentPage
                                                            page={page}
                                                            pageIndex={pageIdx}
                                                            globalFootnoteMap={globalFootnoteMap}
                                                            elementLabelMap={elementLabelMap}
                                                            documentTitle={doc?.title || ''}
                                                            sectionTitle={activeSection.title}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Sections sidebar (right) */}
                        <div className="hidden md:block py-4 pr-4">
                            <SectionListSidebar
                                sections={doc?.sections || []}
                                activeSectionId={activeSectionId}
                                onPick={id => { setActiveSectionId(id); setCurrentPageIndex(0); scrollContainerRef.current?.scrollTo({ top: 0 }); }}
                                currentPageIndex={currentPageIndex}
                                totalPages={activePages.length}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Export labels za reuse
export { Q_CATEGORY_LABELS, Q_SUBTYPE_LABELS };
