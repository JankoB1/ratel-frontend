import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ChevronUp, ChevronDown, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { DocumentPage, buildMaps } from "../components/DocumentPageView";
import logo from "../assets/logo.svg";

// Thumbnail dimensions: scale down A4 (794×1123px) to fit sidebar
const THUMB_SCALE = 0.175;
const THUMB_W = Math.round(794 * THUMB_SCALE);  // 139
const THUMB_H = Math.round(1123 * THUMB_SCALE); // 197

const ViewPage = () => {
    const { id } = useParams();
    const [sections, setSections] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [zoom, setZoom] = useState(100);
    const [currentPage, setCurrentPage] = useState(0);
    const [activeSectionId, setActiveSectionId] = useState<number | null>(null);

    const mainAreaRef = useRef<HTMLDivElement>(null);
    const thumbSidebarRef = useRef<HTMLDivElement>(null);

    // --- Data loading ---
    useEffect(() => {
        const fetchDocument = async () => {
            try {
                const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                const res = await fetch(`${backendUrl}/api/print-documents/${id}`, {
                    headers: { 'Accept': 'application/json' },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const fetched = data.document.sections;
                setSections(fetched);
                if (fetched.length > 0) setActiveSectionId(fetched[0].id);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDocument();
    }, [id]);

    const { elementLabelMap, globalFootnoteMap } = useMemo(() => buildMaps(sections), [sections]);

    // Pages of the currently active section
    const activeSection = sections.find(s => s.id === activeSectionId);
    const activePages: any[] = activeSection?.canvas_data || [];
    const totalPages = activePages.length;

    // --- Section change ---
    // Track which section's scroll listener should be ignored (during transition)
    const isChangingSectionRef = useRef(false);

    const handleSectionChange = useCallback((sectionId: number) => {
        isChangingSectionRef.current = true;
        setActiveSectionId(sectionId);
        setCurrentPage(0);
    }, []);

    // After section changes and React re-renders new pages, scroll to top
    useEffect(() => {
        if (activeSectionId == null) return;
        // Defer to next frame so new pages are mounted before we scroll/measure
        const raf = requestAnimationFrame(() => {
            mainAreaRef.current?.scrollTo({ top: 0 });
            thumbSidebarRef.current?.scrollTo({ top: 0 });
            setCurrentPage(0);
            // Re-enable scroll-driven page tracking shortly after
            setTimeout(() => { isChangingSectionRef.current = false; }, 150);
        });
        return () => cancelAnimationFrame(raf);
    }, [activeSectionId]);

    // --- Zoom ---
    const zoomIn  = useCallback(() => setZoom(z => Math.min(200, z + 25)), []);
    const zoomOut = useCallback(() => setZoom(z => Math.max(50, z - 25)), []);
    const resetZoom = useCallback(() => setZoom(100), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === '0') { e.preventDefault(); resetZoom(); }
            else if (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === '+' || e.key === '=')) zoomIn();
            else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key === '-') zoomOut();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [zoomIn, zoomOut, resetZoom]);

    // --- Scroll tracking (main area → update current page) ---
    const handleMainScroll = useCallback(() => {
        // Ignore scroll events while a section change is in flight (DOM may be stale)
        if (isChangingSectionRef.current) return;
        const container = mainAreaRef.current;
        if (!container) return;
        const pageEls = container.querySelectorAll<HTMLElement>('[data-view-page-index]');
        if (pageEls.length === 0) return;
        const containerTop = container.getBoundingClientRect().top;
        let closestIdx = 0;
        let closestDist = Infinity;
        pageEls.forEach(el => {
            const dist = Math.abs(el.getBoundingClientRect().top - containerTop);
            if (dist < closestDist) { closestDist = dist; closestIdx = parseInt(el.getAttribute('data-view-page-index') || '0', 10); }
        });
        setCurrentPage(closestIdx);
    }, []);

    useEffect(() => {
        // Wait until main content is rendered (after loading) before attaching listener
        if (isLoading) return;
        const el = mainAreaRef.current;
        if (!el) return;
        el.addEventListener('scroll', handleMainScroll, { passive: true });
        return () => el.removeEventListener('scroll', handleMainScroll);
    }, [isLoading, handleMainScroll]);

    // Auto-scroll thumbnail sidebar to keep current thumbnail visible
    useEffect(() => {
        const thumb = thumbSidebarRef.current?.querySelector<HTMLElement>(`[data-thumb-index="${currentPage}"]`);
        if (thumb) thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [currentPage]);

    // --- Page navigation ---
    const goToPage = useCallback((pageIdx: number) => {
        const el = mainAreaRef.current?.querySelector<HTMLElement>(`[data-view-page-index="${pageIdx}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    // --- Loading state ---
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4 text-slate-400 bg-background-grey">
                <Loader2 className="animate-spin text-blue-500" size={40} />
                <span className="font-semibold tracking-wider uppercase text-sm">Učitavanje dokumenta...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background-grey overflow-hidden font-sans text-dark-blue">

            {/* ── Toolbar ── */}
            <div className="h-20 px-8 flex items-center justify-between bg-background-grey shrink-0">
                {/* Logo + title */}
                <div className="flex items-center gap-3 bg-white rounded-[50px] py-[10px] px-[30px] border border-slate-100 shadow-sm">
                    <img src={logo} alt="RATEL" className="h-6" />
                    <span className="font-extrabold text-[13px] uppercase tracking-wide">RATEL</span>
                    <div className="h-5 w-px bg-slate-200" />
                    <span className="font-extrabold text-[13px] uppercase tracking-wide">Annual Report 2026</span>
                </div>

                {/* Page navigation */}
                <div className="flex items-center gap-2 bg-white rounded-[50px] py-[10px] px-[20px] border border-slate-100 shadow-sm">
                    <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0}
                        className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors">
                        <ChevronUp size={16} className="text-slate-600" />
                    </button>
                    <span className="font-bold text-[13px] min-w-[60px] text-center">
                        {totalPages > 0 ? `${currentPage + 1} / ${totalPages}` : '— / —'}
                    </span>
                    <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages - 1}
                        className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors">
                        <ChevronDown size={16} className="text-slate-600" />
                    </button>
                </div>

                {/* Zoom */}
                <div className="flex items-center gap-3 bg-white rounded-[50px] py-[10px] px-[25px] border border-slate-100 shadow-sm">
                    <button onClick={zoomOut} disabled={zoom <= 50}
                        className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors">
                        <ZoomOut size={16} className="text-slate-600" />
                    </button>
                    <button onClick={resetZoom} title="Resetuj zoom na 100%"
                        className="font-bold text-[13px] min-w-[40px] text-center hover:text-blue-600 transition-colors">
                        {zoom}%
                    </button>
                    <button onClick={zoomIn} disabled={zoom >= 200}
                        className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors">
                        <ZoomIn size={16} className="text-slate-600" />
                    </button>
                </div>
            </div>

            {/* ── Section tabs ── */}
            <div className="px-8 pb-4 shrink-0">
                <div className="flex flex-wrap items-center gap-1.5 bg-white rounded-2xl px-2.5 py-2 border border-slate-100 shadow-sm">
                    {sections.map(section => (
                        <button
                            key={section.id}
                            onClick={() => handleSectionChange(section.id)}
                            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                                activeSectionId === section.id
                                    ? 'bg-[#0056B3] text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            {section.title}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 overflow-hidden px-8 pb-8 gap-4">

                {/* Thumbnail sidebar */}
                <div
                    ref={thumbSidebarRef}
                    style={{ width: `${THUMB_W + 20}px` }}
                    className="shrink-0 overflow-y-auto custom-scrollbar pt-2"
                >
                    <div className="flex flex-col gap-3 pb-8">
                        {activePages.map((page: any, pageIdx: number) => (
                            <div
                                key={page.id}
                                data-thumb-index={pageIdx}
                                onClick={() => goToPage(pageIdx)}
                                className="flex flex-col items-center cursor-pointer group"
                            >
                                <span className={`text-[10px] font-bold mb-1 transition-colors ${
                                    currentPage === pageIdx ? 'text-[#0056B3]' : 'text-slate-400'
                                }`}>
                                    {pageIdx + 1}
                                </span>
                                <div
                                    style={{ width: THUMB_W, height: THUMB_H, overflow: 'hidden', borderRadius: 2, flexShrink: 0 }}
                                    className={`transition-all duration-150 ${
                                        currentPage === pageIdx
                                            ? 'ring-2 ring-[#0056B3] ring-offset-1'
                                            : 'ring-1 ring-slate-200 group-hover:ring-blue-300'
                                    }`}
                                >
                                    <div style={{
                                        transform: `scale(${THUMB_SCALE})`,
                                        transformOrigin: 'top left',
                                        width: '794px',
                                        height: '1123px',
                                        pointerEvents: 'none',
                                    }}>
                                        <DocumentPage
                                            page={page}
                                            pageIndex={pageIdx}
                                            globalFootnoteMap={globalFootnoteMap}
                                            elementLabelMap={elementLabelMap}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main scroll area */}
                <div
                    ref={mainAreaRef}
                    className="flex-1 overflow-y-auto custom-scrollbar pt-2"
                >
                    <div className="canvas-wrapper" style={{ zoom: zoom / 100 }}>
                        {activePages.map((page: any, pageIdx: number) => (
                            <div
                                key={page.id}
                                data-view-page-index={pageIdx}
                            >
                                <DocumentPage
                                    page={page}
                                    pageIndex={pageIdx}
                                    globalFootnoteMap={globalFootnoteMap}
                                    elementLabelMap={elementLabelMap}
                                />
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ViewPage;
