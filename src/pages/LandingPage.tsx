import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ExternalLink, FileText, Loader2, ChevronRight, Layers } from "lucide-react";
import logo from "../assets/logo.svg";
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
    // New format: rows_data contains the original row/column structure
    if (group.rows_data && group.rows_data.length > 0) {
        const els: any[] = [];
        group.rows_data.forEach((row: any) => {
            (row.columns ?? []).forEach((col: any) => {
                (col.elements ?? []).forEach((el: any) => els.push(el));
            });
        });
        return els;
    }
    // Legacy format: flat elements array
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
                // Cell values (stored as HTML strings keyed by "row_col")
                const cells = payload.sr?.content ?? {};
                Object.values(cells).forEach((v: any) => {
                    parts.push(typeof v === "string" ? stripHtml(v) : "");
                });
                // Column header labels — settings.columns is a NUMBER (column count), not an array
                // so we safely skip it here; header labels come from sr.content row 0 instead
                break;
            }

            case "chart":
                // Title / subtitle / description
                if (settings.title)       parts.push(settings.title);
                if (settings.subtitle)    parts.push(settings.subtitle);
                if (settings.description) parts.push(settings.description);
                // Row names (category axis labels)
                (payload.data ?? []).forEach((row: any) => {
                    if (row?.name) parts.push(String(row.name));
                });
                // Series keys
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
// Uses rows_data (new format) when available to preserve original multi-column layout.
// Falls back to a single col-span-12 column for legacy groups.
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

const DocFeaturedCard = ({ doc, large, onClick }: { doc: PortalDoc; large?: boolean; onClick: () => void }) => {
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
            {/* Content */}
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

            {/* Dark overlay + title */}
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

            {/* Hover */}
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
            <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#0056B3]/70 mb-1 flex items-center gap-1">
                    <Layers size={9} /> Издвојени садржај
                </p>
                <h3 className="text-sm font-extrabold text-dark-blue line-clamp-2 leading-snug">{group.name}</h3>
                {group.document && (
                    <p className="text-[11px] text-slate-400 mt-1 truncate">из: {group.document.title}</p>
                )}
            </div>
        </button>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────────

const LandingPage = () => {
    const navigate = useNavigate();
    const [docs, setDocs] = useState<PortalDoc[]>([]);
    const [groups, setGroups] = useState<SavedGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
        const headers = { Accept: "application/json" };
        Promise.all([
            fetch(`${backendUrl}/api/portal/documents`, { headers }).then(r => r.json()),
            fetch(`${backendUrl}/api/portal/saved-groups`, { headers }).then(r => r.json()),
        ])
            .then(([docsData, groupsData]) => {
                setDocs(docsData.data ?? []);
                setGroups(groupsData.data ?? []);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const featuredDocs = docs.slice(0, 5);

    const query = search.toLowerCase();
    const visibleGroups = groups.filter(g => {
        if (!query) return true;
        if (g.name.toLowerCase().includes(query)) return true;
        return extractGroupText(g).toLowerCase().includes(query);
    });

    const openDoc   = (id: number) => window.open(`/document/${id}/view`, "_blank");
    const openGroup = (id: number) => navigate(`/group/${id}/preview`);

    return (
        <div className="min-h-screen bg-white font-sans text-dark-blue">

            {/* ── Nav ── */}
            <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <img src={logo} alt="RATEL" className="h-7" />
                        <span className="font-extrabold text-[15px] uppercase tracking-wide">RATEL</span>
                    </div>
                    <button
                        onClick={() => navigate("/login")}
                        className="bg-[#0056B3] text-white rounded-full px-5 py-2 text-sm font-bold hover:bg-blue-700 transition"
                    >
                        Пријавите се
                    </button>
                </div>
            </nav>

            {/* ── Hero ── */}
            <section className="max-w-7xl mx-auto px-8 pt-14 pb-16 grid grid-cols-[1fr_1.1fr] gap-16 items-center">
                {/* Left: text */}
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-[#0056B3] mb-4">
                        Регулаторна агенција за електронске комуникације и поштанске услуге
                    </p>
                    <h1 className="text-4xl font-extrabold leading-tight text-dark-blue mb-6">
                        Добродошли на<br />Рателов Портал<br />прегледа тржишта
                    </h1>
                    <p className="text-base text-slate-500 leading-relaxed max-w-md">
                        Истражите годишње извештаје, финансијске анализе и студије тржишта електронских комуникација у Републици Србији.
                    </p>
                    <button
                        onClick={() => document.getElementById("documents-section")?.scrollIntoView({ behavior: "smooth" })}
                        className="mt-8 flex items-center gap-2 bg-[#0056B3] text-white rounded-full px-6 py-3 text-sm font-bold hover:bg-blue-700 transition"
                    >
                        Прегледај документа <ChevronRight size={16} />
                    </button>
                </div>

                {/* Right: featured documents (hardcoded first 5) */}
                {loading ? (
                    <div className="h-72 flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-300" size={32} />
                    </div>
                ) : featuredDocs.length === 0 ? null : (
                    <div className="grid grid-cols-2 gap-3 h-[340px]">
                        {featuredDocs[0] && (
                            <div className="row-span-2 h-full">
                                <DocFeaturedCard doc={featuredDocs[0]} large onClick={() => openDoc(featuredDocs[0].id)} />
                            </div>
                        )}
                        {featuredDocs.slice(1, 5).map(doc => (
                            <DocFeaturedCard key={doc.id} doc={doc} onClick={() => openDoc(doc.id)} />
                        ))}
                    </div>
                )}
            </section>

            {/* ── Document list ── */}
            <section id="documents-section" className="bg-[#F0F2F5] pt-10 pb-20 min-h-[60vh]">
                <div className="max-w-7xl mx-auto px-8">

                    {/* Section header */}
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                        <h2 className="font-extrabold text-lg text-dark-blue">Издвојени садржај</h2>
                        <div className="flex items-center gap-2 bg-white rounded-full px-4 py-2 border border-slate-100 shadow-sm">
                            <Search size={13} className="text-slate-400 shrink-0" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Претрага..."
                                className="text-sm outline-none bg-transparent placeholder:text-slate-300 w-40"
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
                            <span className="text-sm font-semibold">Нема издвојеног садржаја</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {visibleGroups.map(group => (
                                <GroupCard key={group.id} group={group} onClick={() => openGroup(group.id)} />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="bg-white border-t border-slate-100 py-8">
                <div className="max-w-7xl mx-auto px-8 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                        <img src={logo} alt="RATEL" className="h-5 opacity-40" />
                        <span className="font-bold uppercase tracking-wide">RATEL</span>
                        <span>— Регулаторна агенција за електронске комуникације и поштанске услуге</span>
                    </div>
                    <span>© {new Date().getFullYear()}</span>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
