import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { ChevronUp, ChevronDown, ZoomIn, ZoomOut, Loader2, Layers, X } from "lucide-react";
import { DocumentPage, CoverPage, buildMaps } from "../components/DocumentPageView";
import SectionListSidebar from "../components/SectionListSidebar";
import logo from "../assets/logo.svg";

// Thumbnail dimensions: scale down A4 (794×1123px) to fit sidebar
const THUMB_SCALE = 0.175;
const THUMB_W = Math.round(794 * THUMB_SCALE);  // 139
const THUMB_H = Math.round(1123 * THUMB_SCALE); // 197
const PAGE_W = 794; // A4 canvas width in px

/**
 * Flattened-page meta — jedna stavka po stranici, povezana sa svojom sekcijom.
 * Koristi se za seamless cross-section scroll: sve sekcije se render-uju u jednom toku,
 * a navigacija (dugmad + scroll) operiše nad globalnim indeksom.
 */
type GlobalPage = {
    page: any;
    sectionId: number;
    sectionIndex: number;        // redni broj poglavlja (0-based)
    sectionTitle: string;
    pageIndexInSection: number;  // redni broj strane unutar poglavlja (0-based)
    pagesInSection: number;
    globalIndex: number;
};

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

    useEffect(() => {
        activeRef.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }, [currentPage]);

    return (
        <>
            <div
                className="fixed inset-0 bg-black/40 z-40"
                onClick={onClose}
            />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl">
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
    const [currentGlobalPage, setCurrentGlobalPage] = useState(0);

    const [isMobile, setIsMobile] = useState(false);
    const [mobileZoom, setMobileZoom] = useState(50);
    const [showThumbDrawer, setShowThumbDrawer] = useState(false);

    const mainAreaRef     = useRef<HTMLDivElement>(null);
    const thumbSidebarRef = useRef<HTMLDivElement>(null);
    const sectionTabsRef  = useRef<HTMLDivElement>(null);
    // Sprečava scroll-handler da odmah prepiše currentGlobalPage tokom programatskog skoka.
    const isProgrammaticScrollRef = useRef(false);

    useEffect(() => {
        const update = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (mobile) {
                const availW = window.innerWidth - 32;
                setMobileZoom((availW / PAGE_W) * 100);
            }
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    useEffect(() => {
        const fetchDocument = async () => {
            try {
                const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
                const res = await fetch(`${backendUrl}/api/print-documents/${id}`, {
                    headers: { Accept: "application/json" },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setDocumentTitle(data.document.title || "");
                setSections(data.document.sections || []);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDocument();
    }, [id]);

    const { elementLabelMap, globalFootnoteMap } = useMemo(() => buildMaps(sections), [sections]);

    // Flat lista svih stranica kroz sva poglavlja — osnova za cross-section navigaciju.
    const globalPages = useMemo<GlobalPage[]>(() => {
        const acc: GlobalPage[] = [];
        sections.forEach((s, sIdx) => {
            const pages: any[] = s.canvas_data || [];
            pages.forEach((p, pIdx) => {
                acc.push({
                    page: p,
                    sectionId: s.id,
                    sectionIndex: sIdx,
                    sectionTitle: s.title,
                    pageIndexInSection: pIdx,
                    pagesInSection: pages.length,
                    globalIndex: acc.length,
                });
            });
        });
        return acc;
    }, [sections]);

    const totalGlobalPages = globalPages.length;
    const currentMeta      = globalPages[currentGlobalPage] || null;
    const currentSectionId = currentMeta?.sectionId ?? (sections[0]?.id ?? null);
    const currentSection   = currentMeta ? sections[currentMeta.sectionIndex] : sections[0];
    const currentSectionPages: any[] = currentSection?.canvas_data || [];
    const currentPageInSection = currentMeta?.pageIndexInSection ?? 0;

    // Globalni jump (smooth scroll) — koriste ga dugmad i klik u side panelima.
    const goToGlobalPage = useCallback((idx: number) => {
        if (totalGlobalPages === 0) return;
        const clamped = Math.max(0, Math.min(totalGlobalPages - 1, idx));
        const el = mainAreaRef.current?.querySelector<HTMLElement>(`[data-view-page-index="${clamped}"]`);
        if (!el) return;
        isProgrammaticScrollRef.current = true;
        setCurrentGlobalPage(clamped);
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        // Otpusti programmatic flag posle smooth scroll-a (≈400ms je standardno).
        setTimeout(() => { isProgrammaticScrollRef.current = false; }, 500);
    }, [totalGlobalPages]);

    // Klik na poglavlje (side sidebar ili mobile tabs) — skoči na njegovu prvu stranu.
    const handleSectionPick = useCallback((sectionId: number) => {
        const first = globalPages.find(gp => gp.sectionId === sectionId);
        if (first) goToGlobalPage(first.globalIndex);
    }, [globalPages, goToGlobalPage]);

    // Zoom controls
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

    // Scroll tracking — globalIndex najbliže stranice na vrhu.
    const handleMainScroll = useCallback(() => {
        if (isProgrammaticScrollRef.current) return;
        const container = mainAreaRef.current;
        if (!container) return;
        const pageEls = container.querySelectorAll<HTMLElement>("[data-view-page-index]");
        if (pageEls.length === 0) return;
        const containerTop = container.getBoundingClientRect().top;
        let closestIdx = 0;
        let closestDist = Infinity;
        pageEls.forEach(el => {
            const dist = Math.abs(el.getBoundingClientRect().top - containerTop);
            if (dist < closestDist) {
                closestDist = dist;
                closestIdx = parseInt(el.getAttribute("data-view-page-index") || "0", 10);
            }
        });
        setCurrentGlobalPage(closestIdx);
    }, []);

    useEffect(() => {
        if (isLoading) return;
        const el = mainAreaRef.current;
        if (!el) return;
        el.addEventListener("scroll", handleMainScroll, { passive: true });
        return () => el.removeEventListener("scroll", handleMainScroll);
    }, [isLoading, handleMainScroll]);

    // Auto-scroll thumb sidebar i mobile section tabs kad aktivni indeks promeni.
    useEffect(() => {
        const thumb = thumbSidebarRef.current?.querySelector<HTMLElement>(`[data-thumb-index="${currentPageInSection}"]`);
        if (thumb) thumb.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [currentSectionId, currentPageInSection]);

    useEffect(() => {
        requestAnimationFrame(() => {
            const tab = sectionTabsRef.current?.querySelector<HTMLElement>(`[data-section-id="${currentSectionId}"]`);
            tab?.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
        });
    }, [currentSectionId]);

    const effectiveZoom = isMobile ? mobileZoom : zoom;

    // Helper za prikaz "Поглавље X/N · Стр. Y/M".
    const counterLabel = totalGlobalPages > 0 && currentMeta
        ? `Поглавље ${currentMeta.sectionIndex + 1}/${sections.length} · Стр. ${currentMeta.pageIndexInSection + 1}/${currentMeta.pagesInSection}`
        : "— / —";

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
                DESKTOP TOOLBAR
            ═══════════════════════════════════════════════ */}
            <div className="hidden md:flex h-20 px-8 items-center justify-between bg-background-grey shrink-0">
                <div className="flex items-center gap-3 bg-white rounded-[50px] py-[10px] px-[30px] border border-slate-100 shadow-sm min-w-0 max-w-[45%]">
                    <img src={logo} alt="RATEL" className="h-6 shrink-0" />
                    <span className="font-extrabold text-[13px] uppercase tracking-wide shrink-0">RATEL</span>
                    <div className="h-5 w-px bg-slate-200 shrink-0" />
                    <span className="font-extrabold text-[13px] uppercase tracking-wide truncate">{documentTitle || "Annual Report"}</span>
                </div>

                <div className="flex items-center gap-2 bg-white rounded-[50px] py-[10px] px-[20px] border border-slate-100 shadow-sm">
                    <button onClick={() => goToGlobalPage(currentGlobalPage - 1)} disabled={currentGlobalPage === 0}
                        title="Претходна страна"
                        className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors">
                        <ChevronUp size={16} className="text-slate-600" />
                    </button>
                    <span className="font-bold text-[12px] min-w-[180px] text-center whitespace-nowrap">
                        {counterLabel}
                    </span>
                    <button onClick={() => goToGlobalPage(currentGlobalPage + 1)} disabled={currentGlobalPage >= totalGlobalPages - 1}
                        title="Следећа страна"
                        className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-30 transition-colors">
                        <ChevronDown size={16} className="text-slate-600" />
                    </button>
                </div>

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
                MOBILE TOOLBAR
            ═══════════════════════════════════════════════ */}
            <div className="flex md:hidden h-14 px-4 items-center justify-between bg-white border-b border-slate-100 shrink-0 gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                    <img src={logo} alt="RATEL" className="h-5" />
                    <span className="font-extrabold text-[11px] uppercase tracking-wide">RATEL</span>
                </div>
                <p className="flex-1 text-[11px] font-semibold text-slate-500 truncate text-center">
                    {documentTitle}
                </p>
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={() => setShowThumbDrawer(true)}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors relative"
                        title="Странице"
                    >
                        <Layers size={15} className="text-slate-500" />
                        {currentSectionPages.length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#0056B3] text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                                {currentSectionPages.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Mobile-only section tabs */}
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
                            onClick={() => handleSectionPick(section.id)}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all whitespace-nowrap shrink-0 ${
                                currentSectionId === section.id
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

                {/* Desktop thumbnail sidebar — samo trenutno poglavlje */}
                <div
                    ref={thumbSidebarRef}
                    style={{ width: `${THUMB_W + 20}px` }}
                    className="hidden md:block shrink-0 overflow-y-auto custom-scrollbar pt-2"
                >
                    <div className="flex flex-col gap-3 pb-8">
                        {currentSectionPages.map((page: any, pageIdx: number) => {
                            // Indeks ove stranice u globalnoj flat listi
                            const globalIdx = globalPages.findIndex(
                                gp => gp.sectionId === currentSectionId && gp.pageIndexInSection === pageIdx
                            );
                            return (
                                <div
                                    key={page.id}
                                    data-thumb-index={pageIdx}
                                    onClick={() => goToGlobalPage(globalIdx)}
                                    className="flex flex-col items-center cursor-pointer group"
                                >
                                    <span className={`text-[10px] font-bold mb-1 transition-colors ${
                                        currentPageInSection === pageIdx ? "text-[#0056B3]" : "text-slate-400"
                                    }`}>
                                        {pageIdx + 1}
                                    </span>
                                    <div
                                        style={{ width: THUMB_W, height: THUMB_H, overflow: "hidden", borderRadius: 2, flexShrink: 0 }}
                                        className={`transition-all duration-150 ${
                                            currentPageInSection === pageIdx
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
                                                sectionTitle={currentSection?.title}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Main content — sve stranice svih poglavlja u jednom toku */}
                <div
                    ref={mainAreaRef}
                    className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pt-2"
                >
                    <div
                        className="canvas-wrapper origin-top-left"
                        style={{ zoom: effectiveZoom / 100 }}
                    >
                        <CoverPage />
                        {globalPages.map((gp) => (
                            <div
                                key={`${gp.sectionId}-${gp.page.id}-${gp.globalIndex}`}
                                data-view-page-index={gp.globalIndex}
                                data-section-id={gp.sectionId}
                            >
                                <DocumentPage
                                    page={gp.page}
                                    pageIndex={gp.pageIndexInSection}
                                    globalFootnoteMap={globalFootnoteMap}
                                    elementLabelMap={elementLabelMap}
                                    documentTitle={documentTitle}
                                    sectionTitle={gp.sectionTitle}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Section list sidebar (right) — desktop only */}
                <div className="hidden md:block pt-2 pb-2">
                    <SectionListSidebar
                        sections={sections}
                        activeSectionId={currentSectionId}
                        onPick={handleSectionPick}
                        currentPageIndex={currentPageInSection}
                        totalPages={currentSectionPages.length}
                    />
                </div>
            </div>

            {/* ═══════════════════════════════════════════════
                MOBILE BOTTOM NAVIGATION
            ═══════════════════════════════════════════════ */}
            <div className="flex md:hidden items-center justify-between px-8 py-3 bg-white border-t border-slate-100 shrink-0">
                <button
                    onClick={() => goToGlobalPage(currentGlobalPage - 1)}
                    disabled={currentGlobalPage === 0}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 disabled:opacity-30 active:bg-slate-200 transition-colors"
                >
                    <ChevronUp size={20} className="text-slate-600" />
                </button>

                <button
                    onClick={() => setShowThumbDrawer(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 active:bg-slate-200 transition-colors"
                >
                    <Layers size={13} className="text-slate-500" />
                    <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">
                        {counterLabel}
                    </span>
                </button>

                <button
                    onClick={() => goToGlobalPage(currentGlobalPage + 1)}
                    disabled={currentGlobalPage >= totalGlobalPages - 1}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 disabled:opacity-30 active:bg-slate-200 transition-colors"
                >
                    <ChevronDown size={20} className="text-slate-600" />
                </button>
            </div>

            {/* Mobile thumbnail drawer — stranice trenutnog poglavlja */}
            {showThumbDrawer && (
                <ThumbDrawer
                    pages={currentSectionPages}
                    currentPage={currentPageInSection}
                    onGo={(pageIdx) => {
                        const sectionFirstGlobal = globalPages.findIndex(gp => gp.sectionId === currentSectionId);
                        if (sectionFirstGlobal >= 0) goToGlobalPage(sectionFirstGlobal + pageIdx);
                    }}
                    onClose={() => setShowThumbDrawer(false)}
                    globalFootnoteMap={globalFootnoteMap}
                    elementLabelMap={elementLabelMap}
                    documentTitle={documentTitle}
                    sectionTitle={currentSection?.title}
                />
            )}

        </div>
    );
};

export default ViewPage;
