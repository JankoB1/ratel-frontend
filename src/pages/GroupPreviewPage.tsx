import { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, ZoomIn, ZoomOut, Loader2, ExternalLink } from "lucide-react";
import { DocumentPage, buildMaps } from "../components/DocumentPageView";
import { useDocumentSearch, DocumentSearchBox } from "../components/DocumentSearch";
import { formatLastModified } from "../components/SectionListSidebar";
import logo from "../assets/logo.svg";

interface Group {
    id: number;
    name: string;
    elements: any[];
    rows_data?: any[] | null;
    document_id: number | null;
    document: { id: number; title: string } | null;
    updated_at: string;
}

// Razloži grupu u ravan niz redova koje DocumentPage ume da iscrta.
// Novi format (rows_data) zadržava originalni više-kolonski raspored — svaki red je atomska
// jedinica za prelom na strane. Stari format (elements) nema redove, pa svaki element dobija
// svoj red (col-span-12) da bi prelom mogao da ih raspodeli po stranama.
function groupToRows(group: Group): any[] {
    const rows = (group.rows_data && group.rows_data.length > 0)
        ? group.rows_data
        : (group.elements ?? []).map((el: any, i: number) => ({
            id: `gr-row-${el?.id ?? i}`,
            columns: [{ id: `gr-col-${el?.id ?? i}`, widthClass: "col-span-12", elements: [el] }],
        }));
    // DocumentPage preskače redove bez kolona (render → null), pa ih i ovde izbacujemo da bi
    // broj izmerenih .canvas-row čvorova odgovarao broju redova (inače prelom omaši).
    return rows.filter((r: any) => Array.isArray(r?.columns) && r.columns.length > 0);
}

// A4 geometrija (px) — mora da prati .canvas-page / .page-* iz index.css.
const PAGE_INNER_H = 973;    // 1123 − 100 (header) − 50 (footer) = prostor za sadržaj + fusnote
const CONTENT_CAP_H = 923;   // .page-content max-height
const SAFETY_MARGIN = 6;     // jastuk za sub-pixel zaokruživanja

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

    // Svi redovi grupe (ravan niz). Iz njih merimo visine i pravimo prelom na strane.
    const allRows = useMemo(() => (group ? groupToRows(group) : []), [group]);

    // Jedna „virtuelna" strana sa SVIM redovima — služi za buildMaps (numeracija labela/fusnota je
    // globalna i dosledna kroz sve strane) i za pretragu (data-element-id čvorovi su isti bez
    // obzira na to na kojoj se vidljivoj strani element na kraju nađe).
    const measurePage = useMemo(
        () => ({ id: `group-measure-${group?.id ?? 0}`, rows: allRows }),
        [allRows, group],
    );

    const fakeSection = useMemo(() => {
        if (!group) return [];
        return [{ id: group.id, canvas_data: [measurePage] }];
    }, [measurePage, group]);

    // Strane posle preloma — niz page objekata, svaki sa svojim podskupom redova.
    const [paginatedPages, setPaginatedPages] = useState<any[] | null>(null);
    const measureRef = useRef<HTMLDivElement>(null);
    const slicesKeyRef = useRef<string>("");

    const { elementLabelMap, globalFootnoteMap } = useMemo(() => buildMaps(fakeSection), [fakeSection]);

    // Pretraga grupe — identično kao u editoru (Ctrl/Cmd+F, Enter/Shift+Enter, Esc).
    // fakeSection je već memoizovan, pa je referenca stabilna.
    const search = useDocumentSearch(fakeSection, mainAreaRef);

    // ── Auto-prelom na strane ──────────────────────────────────────────────────────────────
    // Sadržaj grupe može biti viši od jedne A4 strane. Ranije se sve trpalo u jednu .canvas-page
    // (fiksno 1123px) pa je višak „curio" van okvira. Sada redove merimo u skrivenom kontejneru
    // (ista širina i isti CSS kao prava strana, ali van ekrana) i pohlepno ih pakujemo u više
    // strana. Grafikoni rezervišu svoju visinu (chartAreaHeight) i bez montiranja, pa je merenje
    // tačno i van ekrana. Skriveni kontejner je SIBLING glavnog scroll-a (mainAreaRef), pa njegovi
    // duplirani data-element-id čvorovi ne smetaju pretrazi (ona traži unutar mainAreaRef).
    useLayoutEffect(() => {
        const root = measureRef.current;
        if (allRows.length === 0) {
            slicesKeyRef.current = "";
            // Grupa bez sadržaja → jedna prazna strana (kao i ranije), umesto „ispadanja".
            setPaginatedPages(group ? [{ id: "group-page-0", rows: [] }] : null);
            return;
        }
        if (!root) return;

        const recompute = () => {
            const node = measureRef.current;
            if (!node) return;
            const rowEls = Array.from(
                node.querySelectorAll<HTMLElement>(".page-content > div > .canvas-row"),
            );
            if (rowEls.length !== allRows.length) return; // DOM još nije spreman

            const tops = rowEls.map(r => r.offsetTop);
            const heights = rowEls.map(r => r.offsetHeight);

            // Konzervativno: rezerviši visinu SVIH fusnota na svakoj strani. Fusnote po strani su
            // uvek podskup ovog skupa, pa nikad ne prekorače rezervu → nema preklapanja sa futerom.
            const fnEl = node.querySelector<HTMLElement>(".page-footnotes .footnotes-container");
            const footnotesReserve = fnEl ? fnEl.offsetHeight : 0;

            const budget = Math.min(CONTENT_CAP_H, PAGE_INNER_H - footnotesReserve) - SAFETY_MARGIN;

            // Pohlepno pakovanje: dodaji redove dok visina (od vrha prvog reda strane do dna tekućeg,
            // razmaci između redova su uračunati kroz offsetTop) ne prebaci budžet; tada zatvori
            // stranu i počni novu. Red viši od budžeta ide sam na svoju stranu (i > start uslov).
            const slices: Array<[number, number]> = [];
            let start = 0;
            for (let i = 0; i < rowEls.length; i++) {
                const used = tops[i] + heights[i] - tops[start];
                if (used > budget && i > start) {
                    slices.push([start, i - 1]);
                    start = i;
                }
            }
            slices.push([start, rowEls.length - 1]);

            const key = `${budget}|${slices.map(s => s.join("-")).join(",")}`;
            if (key === slicesKeyRef.current) return; // bez promene → ne diraj state (anti-loop)
            slicesKeyRef.current = key;
            setPaginatedPages(
                slices.map(([a, b], idx) => ({ id: `group-page-${idx}`, rows: allRows.slice(a, b + 1) })),
            );
        };

        recompute();

        // Grafikoni dobiju stvarnu širinu tek kad njihov ResizeObserver okine (pa se visina hbar
        // grafikona — a time i prelom — može promeniti), a tekst zavisi od učitanog fonta. Zato
        // re-merimo na promenu veličine mernog sadržaja i kada se fontovi učitaju.
        const ro = new ResizeObserver(() => window.requestAnimationFrame(recompute));
        const content = root.querySelector(".page-content");
        if (content) ro.observe(content);
        const fonts = (document as any).fonts;
        if (fonts?.ready) fonts.ready.then(() => window.requestAnimationFrame(recompute));
        return () => ro.disconnect();
    }, [allRows, group, globalFootnoteMap, elementLabelMap]);

    const zoomIn  = useCallback(() => setZoom(z => Math.min(200, z + 25)), []);
    const zoomOut = useCallback(() => setZoom(z => Math.max(50,  z - 25)), []);
    const resetZoom = useCallback(() => setZoom(100), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Ne diraj zoom dok korisnik kuca u polje (npr. search box) — inače "+"/"-" zumira.
            const t = e.target as HTMLElement | null;
            if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
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

    if (!group) {
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

            {/* Plutajuća pretraga (Ctrl/Cmd+F) — radi identično kao u editoru */}
            <DocumentSearchBox search={search} />

            {/* ── Toolbar ── */}
            <div className="h-20 px-8 flex items-center justify-between bg-background-grey shrink-0">

                {/* Back + title */}
                <div className="flex items-center gap-3 bg-white rounded-[50px] py-[10px] px-[20px] border border-slate-100 shadow-sm">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1.5 text-slate-500 hover:text-dark-blue transition-colors"
                    >
                        <ChevronLeft size={16} />
                        <span className="font-bold text-[13px]">Nazad</span>
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
                        <span className="text-[12px] text-slate-400">Iz dokumenta:</span>
                        <button
                            onClick={() => window.open(`/document/${group.document!.id}/view`, "_blank")}
                            className="flex items-center gap-1.5 font-bold text-[13px] text-[#0056B3] hover:underline"
                        >
                            {group.document.title}
                            <ExternalLink size={12} />
                        </button>
                    </div>
                )}

                {/* Poslednja izmena + Zoom (desno) */}
                <div className="flex items-center gap-4">
                    {formatLastModified(group.updated_at) && (
                        <span className="hidden lg:block text-[11px] text-slate-400 text-right leading-snug">
                            Poslednji put izmenjeno{" "}
                            <span className="font-semibold text-slate-500">{formatLastModified(group.updated_at)}</span>
                        </span>
                    )}
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
            </div>

            {/* ── Main scroll area ── */}
            <div
                ref={mainAreaRef}
                className="flex-1 overflow-y-auto custom-scrollbar pt-2 px-8 pb-8"
            >
                <div className="canvas-wrapper" style={{ zoom: zoom / 100 }}>
                    {(paginatedPages ?? []).map((pg, idx) => (
                        <DocumentPage
                            key={pg.id}
                            page={pg}
                            pageIndex={idx}
                            globalFootnoteMap={globalFootnoteMap}
                            elementLabelMap={elementLabelMap}
                        />
                    ))}
                </div>
            </div>

            {/* Skriveni merni kontejner: ista širina (794px) i isti CSS kao prava strana, ali van
                ekrana. Iz njega merimo visine redova/fusnota za prelom. NE sme display:none (tada
                nema layout-a → offsetHeight = 0) — zato off-screen + visibility:hidden. Stoji izvan
                mainAreaRef da njegovi data-element-id duplikati ne bi ometali pretragu/scroll. */}
            <div
                aria-hidden
                style={{ position: "fixed", left: "-10000px", top: 0, width: "794px", visibility: "hidden", pointerEvents: "none", zIndex: -1 }}
            >
                <div ref={measureRef}>
                    <DocumentPage
                        page={measurePage}
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
