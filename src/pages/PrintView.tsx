import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { DocumentPage, CoverPage, TableOfContents, FullPageImage, buildMaps, COVER_IMAGE_URL, TOC_BACKGROUND_URL, SECOND_PAGE_IMAGE_URL, CONTACT_PAGE_IMAGE_URL, type TocEntry } from "../components/DocumentPageView";

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
                // Pune A4 slike (korica, strana posle korice, kontakt) su teške i jedini
                // su asseti na koje #print-ready ne čeka — preload-ujemo ih paralelno.
                await Promise.all([
                    preloadImage(COVER_IMAGE_URL, 8000),
                    preloadImage(SECOND_PAGE_IMAGE_URL, 8000),
                    preloadImage(CONTACT_PAGE_IMAGE_URL, 8000),
                    ...(TOC_BACKGROUND_URL ? [preloadImage(TOC_BACKGROUND_URL, 8000)] : []),
                ]);
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

    // Globalna numeracija strana. Korica i Sadržaj su "front matter" (bez broja), a sadržajne
    // strane se broje globalno počev od 1 — pa broj u Sadržaju odgovara broju u podnožju te
    // strane. tocEntries: prva strana svake sekcije; flatPages: sve strane sa globalnim brojem.
    const { tocEntries, flatPages } = useMemo(() => {
        let counter = 0;
        const toc: TocEntry[] = [];
        const flat: { page: any; sectionTitle: string; globalPage: number }[] = [];
        sections.forEach((section: any) => {
            const pages: any[] = section.canvas_data || [];
            if (pages.length > 0) {
                toc.push({ title: section.title || 'Sekcija', page: counter + 1 });
            }
            pages.forEach((page: any) => {
                counter += 1;
                flat.push({ page, sectionTitle: section.title, globalPage: counter });
            });
        });
        return { tocEntries: toc, flatPages: flat };
    }, [sections]);

    if (!isReady) {
        return <div className="p-10 text-center font-bold text-slate-500">Priprema dokumenta za štampu...</div>;
    }
    if (errorMsg) {
        return <div id="print-ready" className="p-10 text-center text-red-500 font-bold text-xl">{errorMsg}</div>;
    }
    return (
        <div id="print-ready" style={{ background: '#fff' }}>
            <CoverPage isPrint={true} />
            <FullPageImage src={SECOND_PAGE_IMAGE_URL} isPrint={true} />
            <TableOfContents entries={tocEntries} isPrint={true} />
            {flatPages.map(fp => (
                // pageIndex = globalPage - 1 → podnožje (pageIndex + 1) prikazuje globalni broj strane.
                <DocumentPage key={`p-${fp.globalPage}`} page={fp.page} pageIndex={fp.globalPage - 1} globalFootnoteMap={globalFootnoteMap} elementLabelMap={elementLabelMap} isPrint={true} documentTitle={documentTitle} sectionTitle={fp.sectionTitle} />
            ))}
            <FullPageImage src={CONTACT_PAGE_IMAGE_URL} isPrint={true} />
        </div>
    );
};

export default PrintView;
