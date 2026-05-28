import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ChevronUp, ChevronDown, ZoomIn, ZoomOut, Loader2, Layers, X } from "lucide-react";
import { DocumentPage, buildMaps } from "../components/DocumentPageView";
import SectionListSidebar from "../components/SectionListSidebar";
import logo from "../assets/logo.svg";

// Thumbnail dimensions: scale down A4 (794×1123px) to fit sidebar
const THUMB_SCALE = 0.175;
const THUMB_W = Math.round(794 * THUMB_SCALE);  // 139
const THUMB_H = Math.round(1123 * THUMB_SCALE); // 197
const PAGE_W = 794; // A4 canvas width in px

// ── Thumbnail drawer (mobile) ──────────────────────────────────────────────────

const ThumbDrawer = ({
    pages, currentPage, onGo, onClose,
    globalFootnoteMap, elementLabelMap, documentTitle, sectionTitle,
}: {
    pages: any[];
    currentPage: number;
    onGo: (idx: number) => void;
    onClose: () => void;
    globalFootnoteMap: Record<string, number>;
    elementLabelMap: Record<string, string>;
    documentTitle: string;
    sectionTitle?: string;
}) => {
    const activeRef = useRef<HTMLDivElement>(null);

    // Scroll active thumb into view when drawer opens or page changes
    useEffect(() => {
        activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, [currentPage]);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={onClose}
            />
            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl">
                {/* Handle + header */}
                <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
                    <div className="w-10 h-1 bg-slate-200 rounded-full absolute left-1/2 -translate-x-1/2 top-2" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Странице ({pages.length})
                    </span>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100"
                    >
                        <X size={14} className="text-slate-500" />
                    </button>
                </div>

                {/* Horizontal scrollable thumb strip */}
                <div
                    className="flex gap-3 px-4 py-4 overflow-x-auto"
                    style={{ scrollbarWidth: "none" }}
                >
                    {pages.map((page: any, pageIdx: number) => {
                        const isActive = pageIdx === currentPage;
                        return (
                            <div
                                key={page.id}
                                ref={isActive ? activeRef : undefined}
                                onClick={() => { onGo(pageIdx); onClose(); }}
                                className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer"
                            >
                                <span className={`text-[10px] font-bold ${isActive ? "text-[#0056B3]" : "text-slate-400"}`}>
                                    {pageIdx + 1}
                                </span>
                                <div
                                    style={{ width: THUMB_W, height: THUMB_H, overflow: "hidden", borderRadius: 4, flexShrink: 0 }}
                                    className={`transition-all duration-150 ${
                                        isActive
                                            ? "ring-2 ring-[#0056B3] ring-offset-1"
                                            : "ring-1 ring-slate-200"
                                    }`}
                                >
                                    <div style={{
                                        transform: `scale(${THUMB_SCALE})`,
                                        transformOrigin: "top left",
                                        width: "794px",
                                        height: "1123px",
                                        pointerEvents: "none",
                                    }}>
                                        <DocumentPage
                                            page={page}
                                            pageIndex={pageIdx}
                                            globalFootnoteMap={globalFootnoteMap}
                                            elementLabelMap={elementLabelMap}
                                            documentTitle={documentTitle}
                                            sectionTitle={sectionTitle}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

const ViewPage = () => {
    const { id } = useParams();
    const [sections, setSections] = useState<any[]>([]);
    const [documentTitle, setDocumentTitle] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [zoom, setZoom] = useState(100);
    const [currentPage, setCurrentPage] = useState(0);
    const [activeSectionId, setActiveSectionId] = useState<number | null>(null);

    // Mobile state
    const [isMobile, setIsMobile] = useState(false);
    const [mobileZoom, setMobileZoom] = useState(50); // will be computed from viewport
    const [showThumbDrawer, setShowThumbDrawer] = useState(false);

    const mainAreaRef    = useRef<HTMLDivElement>(null);
    const thumbSidebarRef = useRef<HTMLDivElement>(null);
    const sectionTabsRef  = useRef<HTMLDivElement>(null);

    // ── Responsive detection + auto-zoom ──
    useEffect(() => {
        const update = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                // 16px padding each side
                const availW = window.innerWidth - 32;
                setMobileZoom((availW / PAGE_W) * 100);
            }
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    // ── Data loading ──
    useEffect(() => {
        const fetchDocument = async () => {
            try {
                const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
                const res = await fetch(`${backendUrl}/api/print-documents/${id}`, {
                    headers: { Accept: "application/json" },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const fetched = data.document.sections;
                setDocumentTitle(data.document.title || "");
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

    const activeSection = sections.find(s => s.id === activeSectionId);
    const activePages: any[] = activeSection?.canvas_data || [];
    const totalPages = activePages.length;

    // ── Section change ──
    const isChangingSectionRef = useRef(false);

    const handleSectionChange = useCallback((sectionId: number) => {
        isChangingSectionRef.current = true;
        setActiveSectionId(sectionId);
        setCurrentPage(0);
        // Scroll section tab pill into view
        requestAnimationFrame(() => {
            const tab = sectionTabsRef.current?.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`);
            tab?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
        });
    }, []);

    useEffect(() => {
        if (activeSectionId == null) return;
        const raf = requestAnimationFrame(() => {
            mainAreaRef.current?.scrollTo({ top: 0 });
            thumbSidebarRef.current?.scrollTo({ top: 0 });
            setCurrentPage(0);
            setTimeout(() => { isChangingSectionRef.current = false; }, 150);
        });
        return () => cancelAnimationFrame(raf);
    }, [activeSectionId]);

    // ── Zoom (desktop) ──
    const zoomIn   = useCallback(() => setZoom(z => Math.min(200, z + 25)), []);
    const zoomOut  = useCallback(() => setZoom(z => Math.max(50, z - 25)), []);
    const resetZoom = useCallback(() => setZoom(100), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === "0") { e.preventDefault(); resetZoom(); }
            else if (!e.ctrlKey && !e.altKey && !e.metaKey && (e.key === "+" || e.key === "=")) zoomIn();
            else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key === "-") zoomOut();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [zoomIn, zoomOut, resetZoom]);

    // ── Scroll tracking ──
    const handleMainScroll = useCallback(() => {
        if (isChangingSectionRef.current) return;
        const container = mainAreaRef.current;
        if (!container) return;
        const pageEls = container.querySelectorAll<HTMLElement>("[data-view-page-index]");
        if (pageEls.length === 0) return;
        const containerTop = container.getBoundingClientRect().top;
        let closestIdx = 0;
        let closestDist = Infinity;
        pageEls.forEach(el => {
            const dist = Math.abs(el.getBoundingClientRect().top - containerTop);
            if (dist < closestDist) { closestDist = dist; closestIdx = parseInt(el.getAttribute("data-view-page-index") || "0", 10); }
        });
        setCurrentPage(closestIdx);
    }, []);

    useEffect(() => {
        if (isLoading) return;
        const el = mainAreaRef.current;
        if (!el) return;
        el.addEventListener("scroll", handleMainScroll, { passive: true });
        return () => el.removeEventListener("scroll", handleMainScroll);
    }, [isLoading, handleMainScroll]);

    // Auto-scroll desktop sidebar thumbnail into view
    useEffect(() => {
        const thumb = thumbSidebarRef.current?.querySelector<HTMLElement>(`[data-thumb-index="${currentPage}"]`);
        if (thumb) thumb.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [currentPage]);

    // ── Page navigation ──
    const goToPage = useCallback((pageIdx: number) => {
        const el = mainAreaRef.current?.querySelector<HTMLElement>(`[data-view-page-index="${pageIdx}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

    const effectiveZoom = isMobile ? mobileZoom : zoom;

    // ── Loading ──
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4 text-slate-400 bg-background-grey">
                <Loader2 className="animate-spin text-blue-500" size={40} />
                <span className="font-semibold tracking-wider uppercase text-sm">Учитавање документа...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background-grey overflow-hidden font-sans text-dark-blue">

            {/* ═══════════════════════════════════════════════
                DESKTOP TOOLBAR (hidden on mobile)
            ═══════════════════════════════════════════════ */}
            <div className="hidden md:flex h-20 px-8 items-center justify-between bg-background-grey shrink-0">
                {/* Logo + title */}
                <div className="flex items-center gap-3 bg-white rounded-[50px] py-[10px] px-[30px] border border-slate-100 shadow-sm min-w-0 max-w-[45%]">
                    <img src={logo} alt="RATEL" className="h-6 shrink-0" />
                    <span className="font-extrabold text-[13px] uppercase tracking-wide shrink-0">RATEL</span>
                    <div className="h-5 w-px bg-slate-200 shrink-0" />
                    <span className="font-extrabold text-[13px] uppercase tracking-wide truncate">{documentTitle || "Annual Report"}</span>
                </div>

                {/* Page navigation */}
                <div className="flex items-center gap-2 bg-white rounded-[50px] py-[10px] px-[20px] border border-slate-100 shadow-sm">
                    <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 0}
                        className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors">
                        <ChevronUp size={16} className="text-slate-600" />
                    </button>
                    <span className="font-bold text-[13px] min-w-[60px] text-center">
                        {totalPages > 0 ? `${currentPage + 1} / ${totalPages}` : "— / —"}
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

            {/* ═══════════════════════════════════════════════
                MOBILE TOOLBAR (hidden on desktop)
            ═══════════════════════════════════════════════ */}
            <div className="flex md:hidden h-14 px-4 items-center justify-between bg-white border-b border-slate-100 shrink-0 gap-2">
                {/* Logo */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <img src={logo} alt="RATEL" className="h-5" />
                    <span className="font-extrabold text-[11px] uppercase tracking-wide">RATEL</span>
                </div>
                {/* Doc title */}
                <p className="flex-1 text-[11px] font-semibold text-slate-500 truncate text-center">
                    {documentTitle}
                </p>
                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={() => setShowThumbDrawer(true)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors relative"
                        title="Странице"
                    >
                        <Layers size={15} className="text-slate-500" />
                        {totalPages > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#0056B3] text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                                {totalPages}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Mobile-only section tabs (kept horizontal on mobile; desktop has right sidebar) */}
            <div className="md:hidden px-4 py-2 shrink-0">
                <div
                    ref={sectionTabsRef}
                    className="flex items-center gap-1 bg-white rounded-2xl px-2 py-1.5 border border-slate-100 shadow-sm overflow-x-auto"
                    style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                >
                    {sections.map(section => (
                        <button
                            key={section.id}
                            data-section-id={section.id}
                            onClick={() => handleSectionChange(section.id)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap shrink-0 ${
                                activeSectionId === section.id
                                    ? "bg-[#0056B3] text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                            {section.title}
                        </button>
                    ))}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
                BODY
            ═══════════════════════════════════════════════ */}
            <div className="flex flex-1 overflow-hidden px-4 md:px-8 pb-2 md:pb-8 gap-4">

                {/* Desktop thumbnail sidebar */}
                <div
                    ref={thumbSidebarRef}
                    style={{ width: `${THUMB_W + 20}px` }}
                    className="hidden md:block shrink-0 overflow-y-auto custom-scrollbar pt-2"
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
                                    currentPage === pageIdx ? "text-[#0056B3]" : "text-slate-400"
                                }`}>
                                    {pageIdx + 1}
                                </span>
                                <div
                                    style={{ width: THUMB_W, height: THUMB_H, overflow: "hidden", borderRadius: 2, flexShrink: 0 }}
                                    className={`transition-all duration-150 ${
                                        currentPage === pageIdx
                                            ? "ring-2 ring-[#0056B3] ring-offset-1"
                                            : "ring-1 ring-slate-200 group-hover:ring-blue-300"
                                    }`}
                                >
                                    <div style={{
                                        transform: `scale(${THUMB_SCALE})`,
                                        transformOrigin: "top left",
                                        width: "794px",
                                        height: "1123px",
                                        pointerEvents: "none",
                                    }}>
                                        <DocumentPage
                                            page={page}
                                            pageIndex={pageIdx}
                                            globalFootnoteMap={globalFootnoteMap}
                                            elementLabelMap={elementLabelMap}
                                            documentTitle={documentTitle}
                                            sectionTitle={activeSection?.title}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main content */}
                <div
                    ref={mainAreaRef}
                    className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pt-2"
                >
                    <div
                        className="canvas-wrapper origin-top-left"
                        style={{ zoom: effectiveZoom / 100 }}
                    >
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
                                    documentTitle={documentTitle}
                                    sectionTitle={activeSection?.title}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Section list sidebar (right) — desktop only */}
                <div className="hidden md:block pt-2 pb-2">
                    <SectionListSidebar
                        sections={sections}
                        activeSectionId={activeSectionId}
                        onPick={(id) => handleSectionChange(id)}
                        currentPageIndex={currentPage}
                        totalPages={activePages.length}
                    />
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
                MOBILE BOTTOM NAVIGATION
            ═══════════════════════════════════════════════ */}
            <div className="flex md:hidden items-center justify-between px-8 py-3 bg-white border-t border-slate-100 shrink-0">
                {/* Prev page */}
                <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 0}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 disabled:opacity-30 active:bg-slate-200 transition-colors"
                >
                    <ChevronUp size={20} className="text-slate-600" />
                </button>

                {/* Page counter + thumb button */}
                <button
                    onClick={() => setShowThumbDrawer(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
                >
                    <Layers size={13} className="text-slate-500" />
                    <span className="text-sm font-bold text-slate-600">
                        {totalPages > 0 ? `${currentPage + 1} / ${totalPages}` : "—"}
                    </span>
                </button>

                {/* Next page */}
                <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage >= totalPages - 1}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 disabled:opacity-30 active:bg-slate-200 transition-colors"
                >
                    <ChevronDown size={20} className="text-slate-600" />
                </button>
            </div>

            {/* ═══════════════════════════════════════════════
                MOBILE THUMBNAIL DRAWER (portal-style bottom sheet)
            ═══════════════════════════════════════════════ */}
            {showThumbDrawer && (
                <ThumbDrawer
                    pages={activePages}
                    currentPage={currentPage}
                    onGo={goToPage}
                    onClose={() => setShowThumbDrawer(false)}
                    globalFootnoteMap={globalFootnoteMap}
                    elementLabelMap={elementLabelMap}
                    documentTitle={documentTitle}
                    sectionTitle={activeSection?.title}
                />
            )}

        </div>
    );
};

export default ViewPage;
