import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ZoomIn, ZoomOut, Loader2, ExternalLink } from "lucide-react";
import { DocumentPage, buildMaps } from "../components/DocumentPageView";
import logo from "../assets/logo.svg";

// A saved group's elements are a flat array of ContentElement.
// We wrap them into a single-column page so DocumentPage can render them.
function elementsToPage(elements: any[], groupId: number) {
    return {
        id: `group-page-${groupId}`,
        rows: [
            {
                id: "gr-row-1",
                columns: [
                    {
                        id: "gr-col-1",
                        widthClass: "w-full",
                        elements: elements,
                    },
                ],
            },
        ],
    };
}

interface Group {
    id: number;
    name: string;
    elements: any[];
    document_id: number | null;
    document: { id: number; title: string } | null;
    updated_at: string;
}

const GroupPreviewPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [zoom, setZoom] = useState(100);

    const mainAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
        fetch(`${backendUrl}/api/portal/saved-groups/${id}`, { headers: { Accept: "application/json" } })
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then(data => setGroup(data))
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [id]);

    const page = useMemo(() => {
        if (!group) return null;
        return elementsToPage(group.elements ?? [], group.id);
    }, [group]);

    const fakeSection = useMemo(() => {
        if (!page) return [];
        return [{ id: group!.id, canvas_data: [page] }];
    }, [page, group]);

    const { elementLabelMap, globalFootnoteMap } = useMemo(() => buildMaps(fakeSection), [fakeSection]);

    const zoomIn  = useCallback(() => setZoom(z => Math.min(200, z + 25)), []);
    const zoomOut = useCallback(() => setZoom(z => Math.max(50,  z - 25)), []);
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

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4 text-slate-400 bg-background-grey">
                <Loader2 className="animate-spin text-blue-500" size={40} />
                <span className="font-semibold tracking-wider uppercase text-sm">Učitavanje...</span>
            </div>
        );
    }

    if (!group || !page) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4 text-slate-400 bg-background-grey">
                <span className="font-semibold text-sm">Grupa nije pronađena.</span>
                <button onClick={() => navigate("/")} className="text-[#0056B3] font-bold text-sm hover:underline">
                    ← Nazad
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-background-grey overflow-hidden font-sans text-dark-blue">

            {/* ── Toolbar ── */}
            <div className="h-20 px-8 flex items-center justify-between bg-background-grey shrink-0">

                {/* Back + title */}
                <div className="flex items-center gap-3 bg-white rounded-[50px] py-[10px] px-[20px] border border-slate-100 shadow-sm">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-dark-blue transition-colors"
                    >
                        <ChevronLeft size={16} />
                        <span className="font-bold text-[13px]">Назад</span>
                    </button>
                    <div className="h-5 w-px bg-slate-200" />
                    <img src={logo} alt="RATEL" className="h-5" />
                    <span className="font-extrabold text-[13px] uppercase tracking-wide truncate max-w-[260px]">
                        {group.name}
                    </span>
                </div>

                {/* Document link (if bound) */}
                {group.document && (
                    <div className="flex items-center gap-2 bg-white rounded-[50px] py-[10px] px-[20px] border border-slate-100 shadow-sm">
                        <span className="text-[12px] text-slate-400">Из документа:</span>
                        <button
                            onClick={() => window.open(`/document/${group.document!.id}/view`, "_blank")}
                            className="flex items-center gap-1.5 font-bold text-[13px] text-[#0056B3] hover:underline"
                        >
                            {group.document.title}
                            <ExternalLink size={12} />
                        </button>
                    </div>
                )}

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

            {/* ── Main scroll area ── */}
            <div
                ref={mainAreaRef}
                className="flex-1 overflow-y-auto custom-scrollbar pt-2 px-8 pb-8"
            >
                <div className="canvas-wrapper" style={{ zoom: zoom / 100 }}>
                    <DocumentPage
                        page={page}
                        pageIndex={0}
                        globalFootnoteMap={globalFootnoteMap}
                        elementLabelMap={elementLabelMap}
                    />
                </div>
            </div>
        </div>
    );
};

export default GroupPreviewPage;
