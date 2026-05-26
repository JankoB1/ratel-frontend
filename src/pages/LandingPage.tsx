import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ExternalLink, FileText, Loader2, ChevronRight, ChevronDown, Layers } from "lucide-react";
import logo from "../assets/logo.svg";
import mainBg from "../assets/main-bg.png";
import trz1 from "../assets/trz1.png";
import trz2 from "../assets/trz2.png";
import trz3 from "../assets/trz3.png";
import { DocumentPage, buildMaps } from "../components/DocumentPageView";

// Thumbnail scale for document preview cards
const THUMB_SCALE = 0.22;
const THUMB_W = Math.round(794 * THUMB_SCALE); // ~175px
const THUMB_H = Math.round(1123 * THUMB_SCALE); // ~247px

const TYPE_LABELS: Record<string, string> = {
    annual_report:    "Годишњи извештај",
    financial_report: "Финансијски извештај",
    financial_plan:   "Финансијски план",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortalDoc {
    id: number;
    title: string;
    type: string;
    status: string;
    updated_at: string;
    first_page: any | null;
}

interface SavedGroup {
    id: number;
    name: string;
    elements: any[];
    rows_data?: any[] | null;
    document_id: number | null;
    document: { id: number; title: string } | null;
    updated_at: string;
}

// Strips HTML tags and returns plain text
function stripHtml(html: string): string {
    return (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// Flattens a group into a plain elements array regardless of storage format
function flattenGroupElements(group: SavedGroup): any[] {
    if (group.rows_data && group.rows_data.length > 0) {
        const els: any[] = [];
        group.rows_data.forEach((row: any) => {
            (row.columns ?? []).forEach((col: any) => {
                (col.elements ?? []).forEach((el: any) => els.push(el));
            });
        });
        return els;
    }
    return group.elements ?? [];
}

// Extracts all searchable text from a group's elements
function extractGroupText(group: SavedGroup): string {
    const parts: string[] = [];
    const elements = flattenGroupElements(group);

    for (const el of elements) {
        const payload  = el.payload ?? {};
        const settings = payload.settings ?? {};

        switch (el.type) {
            case "text":
                parts.push(stripHtml(settings.content ?? ""));
                break;

            case "table": {
                const cells = payload.sr?.content ?? {};
                Object.values(cells).forEach((v: any) => {
                    parts.push(typeof v === "string" ? stripHtml(v) : "");
                });
                break;
            }

            case "chart":
                if (settings.title)       parts.push(settings.title);
                if (settings.subtitle)    parts.push(settings.subtitle);
                if (settings.description) parts.push(settings.description);
                (payload.data ?? []).forEach((row: any) => {
                    if (row?.name) parts.push(String(row.name));
                });
                (payload.keys ?? []).forEach((k: any) => {
                    if (k) parts.push(String(k));
                });
                break;

            case "map":
                if (settings.title) parts.push(settings.title);
                break;

            case "image":
                if (settings.caption) parts.push(settings.caption);
                if (settings.alt)     parts.push(settings.alt);
                break;
        }
    }

    return parts.join(" ");
}

// Wraps a group into a page structure DocumentPage can render.
function elementsToPage(group: SavedGroup) {
    if (group.rows_data && group.rows_data.length > 0) {
        return {
            id: `group-page-${group.id}`,
            rows: group.rows_data,
        };
    }
    return {
        id: `group-page-${group.id}`,
        rows: [{
            id: "gr-row-1",
            columns: [{ id: "gr-col-1", widthClass: "col-span-12", elements: group.elements ?? [] }],
        }],
    };
}

// ── Document featured card (hero) ─────────────────────────────────────────────

// Exported (with underscore prefix) — kept for future re-enabling of dynamic hero cards.
export const _DocFeaturedCard = ({ doc, large, onClick }: { doc: PortalDoc; large?: boolean; onClick: () => void }) => {
    const scale = large ? 0.32 : 0.24;
    const w = Math.round(794 * scale);
    const h = Math.round(1123 * scale);

    const { elementLabelMap, globalFootnoteMap } = useMemo(() => {
        if (!doc.first_page) return { elementLabelMap: {} as Record<string, string>, globalFootnoteMap: {} as Record<string, number> };
        return buildMaps([{ id: doc.id, canvas_data: [doc.first_page] }]);
    }, [doc]);

    return (
        <button
            onClick={onClick}
            className="relative overflow-hidden rounded-2xl border border-white/20 group cursor-pointer text-left w-full h-full"
        >
            {doc.first_page ? (
                <div style={{ width: w, height: h, overflow: "hidden", position: "absolute", inset: 0, margin: "auto" }}>
                    <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: "794px", height: "1123px", pointerEvents: "none" }}>
                        <DocumentPage page={doc.first_page} pageIndex={0} globalFootnoteMap={globalFootnoteMap} elementLabelMap={elementLabelMap} />
                    </div>
                </div>
            ) : (
                <div className={`absolute inset-0 ${large ? "bg-gradient-to-br from-blue-600 to-blue-800" : "bg-gradient-to-br from-slate-600 to-slate-800"}`} />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/60 mb-1">{TYPE_LABELS[doc.type] ?? doc.type}</p>
                <p className={`font-extrabold text-white leading-snug ${large ? "text-sm" : "text-xs"}`}>{doc.title}</p>
            </div>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow">
                    <ChevronRight size={14} className="text-[#0056B3]" />
                </div>
            </div>
        </button>
    );
};

// ── Group thumbnail card (hero) ───────────────────────────────────────────────

export const _GroupFeaturedCard = ({ group, large, onClick }: { group: SavedGroup; large?: boolean; onClick: () => void }) => {
    const hasElements = group.elements?.length > 0;
    const scale = large ? 0.32 : 0.24;
    const w = Math.round(794 * scale);
    const h = Math.round(1123 * scale);

    const page = useMemo(() => elementsToPage(group), [group]);

    const { elementLabelMap, globalFootnoteMap } = useMemo(
        () => buildMaps([{ id: group.id, canvas_data: [page] }]),
        [page, group.id]
    );

    return (
        <button
            onClick={onClick}
            className={`relative overflow-hidden rounded-2xl border border-white/20 group cursor-pointer text-left w-full h-full ${large ? "row-span-2" : ""}`}
        >
            {hasElements ? (
                <div style={{
                    width: w, height: h, overflow: "hidden",
                    position: "absolute", inset: 0, margin: "auto",
                }}>
                    <div style={{
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                        width: "794px",
                        height: "1123px",
                        pointerEvents: "none",
                    }}>
                        <DocumentPage
                            page={page}
                            pageIndex={0}
                            globalFootnoteMap={globalFootnoteMap}
                            elementLabelMap={elementLabelMap}
                        />
                    </div>
                </div>
            ) : (
                <div className={`absolute inset-0 ${large ? "bg-gradient-to-br from-blue-600 to-blue-800" : "bg-gradient-to-br from-slate-600 to-slate-800"}`} />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/60 mb-1 flex items-center gap-1">
                    <Layers size={10} /> Издвојени садржај
                </p>
                <p className={`font-extrabold text-white leading-snug ${large ? "text-sm" : "text-xs"}`}>
                    {group.name}
                </p>
                {group.document && (
                    <p className="text-[10px] text-white/50 mt-0.5 truncate">из: {group.document.title}</p>
                )}
            </div>

            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-200" />
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shadow">
                    <ChevronRight size={14} className="text-[#0056B3]" />
                </div>
            </div>
        </button>
    );
};

// ── Document thumbnail card ───────────────────────────────────────────────────

export const _DocCard = ({ doc, onClick }: { doc: PortalDoc; onClick: () => void }) => {
    const hasThumbnail = !!doc.first_page;

    const { elementLabelMap, globalFootnoteMap } = useMemo(() => {
        if (!doc.first_page) return { elementLabelMap: {} as Record<string, string>, globalFootnoteMap: {} as Record<string, number> };
        return buildMaps([{ id: doc.id, canvas_data: [doc.first_page] }]);
    }, [doc]);

    return (
        <button
            onClick={onClick}
            className="flex flex-col text-left group bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
            {/* Thumbnail */}
            <div
                className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 shrink-0"
                style={{ width: "100%", paddingBottom: `${(THUMB_H / THUMB_W) * 100}%` }}
            >
                <div className="absolute inset-0">
                    {hasThumbnail ? (
                        <div style={{ width: THUMB_W, height: THUMB_H, overflow: "hidden", position: "absolute", inset: 0, margin: "auto" }}>
                            <div style={{
                                transform: `scale(${THUMB_SCALE})`,
                                transformOrigin: "top left",
                                width: "794px",
                                height: "1123px",
                                pointerEvents: "none",
                            }}>
                                <DocumentPage
                                    page={doc.first_page}
                                    pageIndex={0}
                                    globalFootnoteMap={globalFootnoteMap}
                                    elementLabelMap={elementLabelMap}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <FileText size={36} className="text-slate-200" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-[#0056B3]/0 group-hover:bg-[#0056B3]/10 transition-colors duration-200 flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full px-3 py-1.5 text-xs font-bold text-[#0056B3] shadow flex items-center gap-1.5">
                            <ExternalLink size={11} /> Отвори
                        </div>
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#0056B3]/70 mb-1">
                    {TYPE_LABELS[doc.type] ?? doc.type}
                </p>
                <h3 className="text-sm font-extrabold text-dark-blue line-clamp-2 leading-snug">{doc.title}</h3>
                <p className="text-[11px] text-slate-400 mt-1.5">
                    {new Date(doc.updated_at).toLocaleDateString("sr-RS", { day: "2-digit", month: "long", year: "numeric" })}
                </p>
            </div>
        </button>
    );
};

// ── Group card (grid) ─────────────────────────────────────────────────────────

const GroupCard = ({ group, onClick }: { group: SavedGroup; onClick: () => void }) => {
    const hasElements = group.elements?.length > 0;

    const page = useMemo(() => elementsToPage(group), [group]);
    const { elementLabelMap, globalFootnoteMap } = useMemo(
        () => buildMaps([{ id: group.id, canvas_data: [page] }]),
        [page, group.id]
    );

    return (
        <button
            onClick={onClick}
            className="flex flex-col text-left group bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
            {/* Thumbnail */}
            <div
                className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 shrink-0"
                style={{ width: "100%", paddingBottom: `${(THUMB_H / THUMB_W) * 100}%` }}
            >
                <div className="absolute inset-0">
                    {hasElements ? (
                        <div style={{ width: THUMB_W, height: THUMB_H, overflow: "hidden", position: "absolute", inset: 0, margin: "auto" }}>
                            <div style={{ transform: `scale(${THUMB_SCALE})`, transformOrigin: "top left", width: "794px", height: "1123px", pointerEvents: "none" }}>
                                <DocumentPage page={page} pageIndex={0} globalFootnoteMap={globalFootnoteMap} elementLabelMap={elementLabelMap} />
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Layers size={32} className="text-slate-200" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-[#0056B3]/0 group-hover:bg-[#0056B3]/10 transition-colors duration-200 flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full px-3 py-1.5 text-xs font-bold text-[#0056B3] shadow flex items-center gap-1.5">
                            <ExternalLink size={11} /> Отвори
                        </div>
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="px-3 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#0056B3]/70 mb-1 flex items-center gap-1">
                    <Layers size={9} /> Издвојени садржај
                </p>
                <h3 className="text-xs font-extrabold text-dark-blue line-clamp-2 leading-snug">{group.name}</h3>
                {group.document && (
                    <p className="text-[10px] text-slate-400 mt-1 truncate">из: {group.document.title}</p>
                )}
            </div>
        </button>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────────

const LandingPage = () => {
    const navigate = useNavigate();
    const [groups, setGroups] = useState<SavedGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
        const headers = { Accept: "application/json" };
        fetch(`${backendUrl}/api/portal/saved-groups`, { headers })
            .then(r => r.json())
            .then((groupsData) => setGroups(groupsData.data ?? []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const query = search.toLowerCase();
    const visibleGroups = groups.filter(g => {
        if (!query) return true;
        if (g.name.toLowerCase().includes(query)) return true;
        return extractGroupText(g).toLowerCase().includes(query);
    });

    const openGroup = (id: number) => navigate(`/group/${id}/preview`);

    return (
        <div className="min-h-screen font-sans text-dark-blue" style={{
            backgroundImage: `url(${mainBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundAttachment: 'fixed',
            backgroundRepeat: 'no-repeat',
        }}>

            {/* ── Nav ── */}
            <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 md:h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src={logo} alt="RATEL" className="h-6 md:h-7" />
                        <span className="font-extrabold text-[13px] md:text-[15px] uppercase tracking-wide">РАТЕЛ</span>
                    </div>

                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="max-w-7xl mx-auto px-4 md:px-8 pt-10 md:pt-14 pb-10 md:pb-16 flex flex-col lg:grid lg:grid-cols-[1fr_1.4fr] gap-8 lg:gap-16 items-start lg:items-center">

                {/* Left: title */}
                <div>
                    <h1 className="text-[30px] md:text-[38px] lg:text-[40px] font-extrabold leading-[1.1] text-dark-blue tracking-tight">
                        Добродошли на<br />Рателов Портал<br />прегледа тржишта електронских комуникација и поштанских услуга у Републици Србији.
                    </h1>
                    <button
                        onClick={() => document.getElementById("documents-section")?.scrollIntoView({ behavior: "smooth" })}
                        className="mt-8 md:mt-12 w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-[#0056B3] transition"
                        aria-label="Скроли до садржаја"
                    >
                        <ChevronDown size={28} />
                    </button>
                </div>

                {/* Right: 1-2-1-2 grid
                    Mobile (2 col): white | blue / image | lightblue
                    Desktop (4 col): white(span2) | blue | image(span2) | lightblue / _ | lightblue | _ | lightblue
                */}
                <div className="w-full grid grid-cols-2 grid-rows-2 lg:grid-cols-4 lg:grid-rows-2 gap-2.5 md:gap-3 h-[240px] sm:h-[280px] lg:h-[420px]">

                    {/* COL 1: tall white card — row-span-2 on desktop only — link to preview doc #1 */}
                    <button
                        type="button"
                        onClick={() => window.open('/document/1/view', '_blank')}
                        className="lg:row-span-2 bg-white border border-slate-100 rounded-2xl p-4 md:p-5 flex flex-col justify-end shadow-sm relative overflow-hidden text-left cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                        style={{
                            backgroundImage: `url(${trz1})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                    >
                        {/* Soft white-to-transparent gradient so the text stays legible over the photo */}
                        <div className="absolute inset-0 pointer-events-none" style={{
                            background: 'linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.75) 35%, rgba(255,255,255,0) 65%)'
                        }} />
                        <p className="relative text-xs md:text-sm text-slate-700 font-semibold leading-snug">
                            Погледајте комплетан<br />преглед тржишта 2025
                        </p>
                        {/* Hover arrow */}
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-7 h-7 bg-[#0056B3] rounded-full flex items-center justify-center shadow">
                                <ChevronRight size={14} className="text-white" />
                            </div>
                        </div>
                    </button>

                    {/* COL 2 / ROW 1: main featured doc — trz2.png */}
                    <div className="rounded-2xl p-3 md:p-5 relative text-white flex flex-col justify-end overflow-hidden" style={{
                        backgroundImage: `url(${trz2})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}>
                        {/* Dark gradient so white text stays legible */}
                        <div className="absolute inset-0 pointer-events-none" style={{
                            background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0) 100%)'
                        }} />
                        <p className="relative text-xs md:text-sm font-semibold leading-snug">
                            Преглед тржишта електронских комуникација 2025
                        </p>
                    </div>

                    {/* COL 3: image — row-span-2 on desktop — trz3.png */}
                    <div className="lg:row-span-2 rounded-2xl overflow-hidden relative" style={{
                        backgroundImage: `url(${trz3})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}>
                        <div className="absolute inset-0 pointer-events-none" style={{
                            background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0) 100%)'
                        }} />
                        <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                            <p className="text-white text-xs md:text-sm font-semibold">Квартални подаци</p>
                        </div>
                    </div>

                    {/* COL 4 / ROW 1: info bezbednost — server room / data security */}
                    <div className="bg-[#E8F0FB] rounded-2xl p-3 md:p-5 flex flex-col justify-end relative overflow-hidden" style={{
                        backgroundImage: 'url(https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}>
                        <div className="absolute inset-0 pointer-events-none" style={{
                            background: 'linear-gradient(to top, rgba(232,240,251,0.95) 0%, rgba(232,240,251,0.75) 35%, rgba(232,240,251,0) 65%)'
                        }} />
                        <p className="relative text-[10px] md:text-xs text-dark-blue font-semibold leading-snug">
                            Преглед тржишта<br />информациона<br />безбедност 2025
                        </p>
                    </div>

                    {/* COL 2 / ROW 2: hidden on mobile — poštanske usluge — parcels / packages */}
                    <div className="hidden lg:flex bg-[#E8F0FB] rounded-2xl p-5 flex-col justify-end relative overflow-hidden" style={{
                        backgroundImage: 'url(https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?auto=format&fit=crop&w=600&q=80)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}>
                        <div className="absolute inset-0 pointer-events-none" style={{
                            background: 'linear-gradient(to top, rgba(232,240,251,0.95) 0%, rgba(232,240,251,0.75) 35%, rgba(232,240,251,0) 65%)'
                        }} />
                        <p className="relative text-xs text-dark-blue font-semibold leading-snug">
                            Преглед тржишта<br />поштанских<br />услуга 2025
                        </p>
                    </div>

                    {/* COL 4 / ROW 2: hidden on mobile — prethodni pregledi — analytics dashboard / reports */}
                    <div className="hidden lg:flex bg-[#E8F0FB] rounded-2xl p-5 flex-col justify-end relative overflow-hidden" style={{
                        backgroundImage: 'url(https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }}>
                        <div className="absolute inset-0 pointer-events-none" style={{
                            background: 'linear-gradient(to top, rgba(232,240,251,0.95) 0%, rgba(232,240,251,0.75) 35%, rgba(232,240,251,0) 65%)'
                        }} />
                        <p className="relative text-xs text-dark-blue font-semibold leading-snug">
                            Погледајте претходне<br />прегледе тржишта
                        </p>
                    </div>
                </div>
            </section>

            {/* ── Издвојени садржај (bottom section) ── */}
            <section id="documents-section" className="pt-8 md:pt-12 pb-16 md:pb-24 min-h-[60vh]">
                <div className="max-w-7xl mx-auto px-4 md:px-8">

                    {/* Section header */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 md:mb-8 gap-4">
                        <div>
                            <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[#0056B3]/60 mb-1">
                                Портал
                            </p>
                            <h2 className="font-extrabold text-xl md:text-2xl text-dark-blue leading-tight">
                                Издвојени садржај
                            </h2>
                            <p className="text-xs md:text-sm text-slate-400 mt-1 hidden sm:block">
                                Графикони, табеле и анализе из извештаја РАТЕЛ-а
                            </p>
                        </div>
                        {/* Search */}
                        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 border border-slate-100 shadow-sm self-start sm:self-auto">
                            <Search size={13} className="text-slate-400 shrink-0" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Претрага садржаја..."
                                className="text-sm outline-none bg-transparent placeholder:text-slate-300 w-36 md:w-48"
                            />
                        </div>
                    </div>

                    {/* Groups grid */}
                    {loading ? (
                        <div className="flex items-center justify-center py-24 gap-4 text-slate-300">
                            <Loader2 className="animate-spin text-blue-300" size={32} />
                            <span className="text-sm font-semibold">Учитавање...</span>
                        </div>
                    ) : visibleGroups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-slate-300 gap-3">
                            <Layers size={48} />
                            <span className="text-sm font-semibold">
                                {search ? "Нема резултата претраге" : "Нема издвојеног садржаја"}
                            </span>
                            {search && (
                                <button
                                    onClick={() => setSearch("")}
                                    className="text-xs text-[#0056B3] font-semibold underline underline-offset-2"
                                >
                                    Обриши претрагу
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                                {visibleGroups.map(group => (
                                    <GroupCard key={group.id} group={group} onClick={() => openGroup(group.id)} />
                                ))}
                            </div>
                            {visibleGroups.length >= 10 && (
                                <div className="mt-8 md:mt-10 flex justify-center">
                                    <p className="text-xs text-slate-400 font-semibold">
                                        Приказано {visibleGroups.length} резултата
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="bg-white border-t border-slate-100 py-6 md:py-8">
                <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-4">
                    {/* Disclaimer */}
                    <p className="text-[11px] text-slate-400 leading-relaxed border-l-2 border-slate-200 pl-3">
                        RATEL не преузима одговорност за тачност података које су доставили оператори путем годишњих упитника.
                    </p>
                    {/* Bottom row */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                        <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                            <img src={logo} alt="RATEL" className="h-5 opacity-40" />
                            <span className="font-bold uppercase tracking-wide">RATEL</span>
                            <span className="hidden sm:inline">—</span>
                            <span className="text-center sm:text-left">Регулаторна агенција за електронске комуникације и поштанске услуге</span>
                        </div>
                        <span className="shrink-0">© {new Date().getFullYear()}</span>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
