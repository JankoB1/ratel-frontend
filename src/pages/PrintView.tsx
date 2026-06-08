import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { DocumentPage, CoverPage, buildMaps, COVER_IMAGE_URL } from "../components/DocumentPageView";

// Browsershot čeka samo na #print-ready selektor, ne na učitavanje slika. Korica je
// najteži (265KB) i jedini cross-origin asset, pa se ne stigne iscrtati pre snimanja →
// prazna prva strana u PDF-u. Zato je preload-ujemo i tek onda signaliziramo spremnost.
const preloadImage = (src: string, timeoutMs = 8000) =>
    new Promise<void>((resolve) => {
        const img = new Image();
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };
        img.onload = done;
        img.onerror = done;
        img.src = src;
        if (img.complete) done();
        setTimeout(done, timeoutMs);
    });

const PrintView = () => {
    const { id } = useParams();
    const [sections, setSections] = useState<any[]>([]);
    const [documentTitle, setDocumentTitle] = useState('');
    const [isReady, setIsReady] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        const fetchDocument = async () => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
                const params = new URLSearchParams(window.location.search);
                const dataUrl = params.get('dataUrl');
                let data: any;
                if (dataUrl) {
                    const res = await fetch(dataUrl);
                    clearTimeout(timeoutId);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    data = await res.json();
                } else {
                    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
                    const res = await fetch(`${backendUrl}/api/print-documents/${id}`, {
                        headers: { 'Accept': 'application/json' },
                        signal: controller.signal,
                    });
                    clearTimeout(timeoutId);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    data = await res.json();
                }
                setDocumentTitle(data.document.title || '');
                setSections(data.document.sections);
                await preloadImage(COVER_IMAGE_URL, 8000);
                setTimeout(() => setIsReady(true), 1000);
            } catch (error: any) {
                clearTimeout(timeoutId);
                setErrorMsg(`Greška: ${error.message}`);
                setIsReady(true);
            }
        };
        fetchDocument();
    }, [id]);

    const { elementLabelMap, globalFootnoteMap } = useMemo(() => buildMaps(sections), [sections]);

    if (!isReady) {
        return <div className="p-10 text-center font-bold text-slate-500">Priprema dokumenta za štampu...</div>;
    }
    if (errorMsg) {
        return <div id="print-ready" className="p-10 text-center text-red-500 font-bold text-xl">{errorMsg}</div>;
    }
    return (
        <div id="print-ready" style={{ background: '#fff' }}>
            <CoverPage isPrint={true} />
            {sections.map(section =>
                (section.canvas_data || []).map((page: any, pageIndex: number) => (
                    <DocumentPage key={page.id} page={page} pageIndex={pageIndex} globalFootnoteMap={globalFootnoteMap} elementLabelMap={elementLabelMap} isPrint={true} documentTitle={documentTitle} sectionTitle={section.title} />
                ))
            )}
        </div>
    );
};

export default PrintView;
