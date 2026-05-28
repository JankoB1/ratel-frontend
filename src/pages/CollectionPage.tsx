import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle, ChevronUp, ChevronDown } from "lucide-react";
import { DocumentPage, buildMaps } from "../components/DocumentPageView";
import SectionListSidebar from "../components/SectionListSidebar";
import logo from "../assets/logo.svg";

const PAGE_W = 794;

interface SectionItem {
    id: number;
    title: string;
    order: number;
    canvas_data: any[];
}

interface CollectionData {
    id: number;
    name: string;
    document: { id: number; title: string } | null;
}

export default function CollectionPage() {
    const { id } = useParams<{ id: string }>();
    const [collection, setCollection] = useState<CollectionData | null>(null);
    const [sections, setSections] = useState<SectionItem[]>([]);
    const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [zoom, setZoom] = useState(1);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchCollection = async () => {
            try {
                const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
                const res = await fetch(`${backendUrl}/api/portal/collections/${id}`, {
                    headers: { Accept: "application/json" },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setCollection(data.collection);
                setSections(data.sections || []);
                if (data.sections?.length > 0) setActiveSectionId(data.sections[0].id);
            } catch (e: any) {
                setError(e?.message || "Грешка при учитавању колекције.");
            } finally {
                setLoading(false);
            }
        };
        if (id) fetchCollection();
    }, [id]);

    const { elementLabelMap, globalFootnoteMap } = useMemo(() => buildMaps(sections), [sections]);
    const activeSection = sections.find(s => s.id === activeSectionId);
    const activePages: any[] = activeSection?.canvas_data || [];
    const totalPages = activePages.length;

    // Auto-zoom to fit viewport width on mobile
    const [autoZoom, setAutoZoom] = useState(1);
    useEffect(() => {
        const compute = () => {
            const w = window.innerWidth;
            if (w < 900) setAutoZoom(Math.min(1, (w - 32) / PAGE_W));
            else setAutoZoom(1);
        };
        compute();
        window.addEventListener("resize", compute);
        return () => window.removeEventListener("resize", compute);
    }, []);
    const effectiveZoom = autoZoom * zoom;

    // Page tracking via scroll
    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const pages = container.querySelectorAll<HTMLElement>("[data-page-index]");
        let bestIdx = 0;
        let bestDist = Infinity;
        const center = container.scrollTop + container.clientHeight / 2;
        pages.forEach(el => {
            const top = el.offsetTop;
            const bottom = top + el.offsetHeight;
            const mid = (top + bottom) / 2;
            const d = Math.abs(mid - center);
            if (d < bestDist) { bestDist = d; bestIdx = Number(el.dataset.pageIndex || 0); }
        });
        setCurrentPageIndex(bestIdx);
    }, []);

    useEffect(() => { setCurrentPageIndex(0); }, [activeSectionId]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-slate-300">
            <Loader2 className="animate-spin" size={32} />
        </div>;
    }

    if (error || !collection) {
        return <div className="min-h-screen flex flex-col items-center justify-center gap-4">
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-sm font-bold text-slate-600">{error || "Колекција није пронађена."}</p>
        </div>;
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="Ratel" className="h-7 md:h-8" />
                    <div className="min-w-0">
                        <div className="text-xs text-slate-400 uppercase tracking-wide font-bold">Колекција</div>
                        <div className="font-extrabold text-sm md:text-base text-dark-blue truncate max-w-[60vw]">{collection.name}</div>
                        {collection.document && (
                            <div className="text-[11px] text-slate-400 truncate max-w-[60vw]">из „{collection.document.title}”</div>
                        )}
                    </div>
                </div>
                {totalPages > 1 && (
                    <div className="text-xs text-slate-500 font-bold whitespace-nowrap">
                        Стр. {currentPageIndex + 1} / {totalPages}
                    </div>
                )}
            </header>

            {/* Mobile-only section tabs */}
            {sections.length > 1 && (
                <div className="md:hidden px-4 py-2 shrink-0">
                    <div className="flex items-center gap-1.5 bg-white rounded-2xl px-2.5 py-2 border border-slate-100 shadow-sm overflow-x-auto"
                        style={{ scrollbarWidth: "none" } as any}>
                        {sections.map(section => (
                            <button key={section.id} onClick={() => setActiveSectionId(section.id)}
                                className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap shrink-0 ${
                                    activeSectionId === section.id ? "bg-[#0056B3] text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`}>
                                {section.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Body: pages + sections sidebar */}
            <div className="flex-1 flex overflow-hidden gap-4 px-4 md:px-8 py-4 md:py-6">
                <div ref={scrollContainerRef} onScroll={handleScroll}
                    className="flex-1 overflow-y-auto custom-scrollbar">
                    {sections.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                            Колекција нема одобрених секција.
                        </div>
                    ) : !activeSection ? (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                            Изаберите секцију.
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 md:gap-6">
                            {activePages.map((page: any, pageIdx: number) => (
                                <div key={page.id} data-page-index={pageIdx}>
                                    <div style={{ zoom: effectiveZoom }}>
                                        <div className="canvas-wrapper">
                                            <div className="canvas-page" style={{ width: PAGE_W }}>
                                                <DocumentPage
                                                    page={page}
                                                    pageIndex={pageIdx}
                                                    globalFootnoteMap={globalFootnoteMap}
                                                    elementLabelMap={elementLabelMap}
                                                    documentTitle={collection.document?.title || collection.name}
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

                {/* Section sidebar (right) — desktop only */}
                <SectionListSidebar
                    sections={sections}
                    activeSectionId={activeSectionId}
                    onPick={(id) => { setActiveSectionId(id); setCurrentPageIndex(0); scrollContainerRef.current?.scrollTo({ top: 0 }); }}
                    currentPageIndex={currentPageIndex}
                    totalPages={activePages.length}
                />
            </div>

            {/* Mobile zoom controls */}
            {totalPages > 0 && (
                <div className="md:hidden fixed bottom-4 right-4 flex flex-col gap-2 z-30">
                    <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-slate-600">
                        <ChevronUp size={16} />
                    </button>
                    <button onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center text-slate-600">
                        <ChevronDown size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}
