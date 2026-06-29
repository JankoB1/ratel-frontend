import { useEffect, useState, useMemo, Fragment } from "react";
import { useParams } from "react-router-dom";
import { DocumentPage, CoverPage, IntroLogoPage, TableOfContents, FullPageImage, SectionTitlePage, DisclaimerPage, buildMaps, COVER_BG_URL, COVER_LOGO_URL, PAGE2_BG_URL, PAGE2_LOGO_URL, TOC_BACKGROUND_URL, CONTACT_PAGE_IMAGE_URL, SECTION_TITLE_BACKGROUND_URL, type TocEntry } from "../components/DocumentPageView";
import { formatLastModified } from "../components/SectionListSidebar";

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

// Browsershot čeka samo na #print-ready, ne i na web-fontove. Bez ovoga se PDF snimi pre
// nego što se Nunito Sans učita → tekst i tabele padnu na fallback font i izgledaju drugačije
// nego u editoru (a različite širine glifova razvlače ćelije pa borderi deluju "pomereno").
// Zato eksplicitno učitamo korišćene težine pre nego što signaliziramo spremnost.
const preloadFonts = async () => {
    if (!('fonts' in document)) return;
    try {
        await Promise.all([
            document.fonts.load('400 14px "Nunito Sans"'),
            document.fonts.load('600 14px "Nunito Sans"'),
            document.fonts.load('700 15px "Nunito Sans"'),
            document.fonts.load('800 42px "Nunito Sans"'),
        ]);
        await document.fonts.ready;
    } catch {
        /* best-effort — nastavi sa snimanjem i ako učitavanje fonta padne */
    }
};

// Skuplja sve URL-ove korisničkih (upload-ovanih) slika iz strukture dokumenta:
// sekcije → strane (canvas_data) → redovi → kolone → elementi tipa 'image'.
const collectImageUrls = (sections: any[]): string[] => {
    const urls: string[] = [];
    (sections || []).forEach((section: any) =>
        (section.canvas_data || []).forEach((page: any) =>
            (page.rows || []).forEach((row: any) =>
                (row.columns || []).forEach((col: any) =>
                    (col.elements || []).forEach((el: any) => {
                        if (el?.type === 'image' && el?.payload?.settings?.url) urls.push(el.payload.settings.url);
                    })
                )
            )
        )
    );
    return urls;
};

const PrintView = () => {
    const { id } = useParams();
    const [sections, setSections] = useState<any[]>([]);
    const [documentTitle, setDocumentTitle] = useState('');
    const [coverTitle, setCoverTitle] = useState('');
    const [coverBig, setCoverBig] = useState('');
    const [coverSubtitle, setCoverSubtitle] = useState('');
    const [introText, setIntroText] = useState('');
    const [disclaimerText, setDisclaimerText] = useState('');
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
                setCoverTitle(data.document.cover_title || '');
                setCoverBig(data.document.cover_big || '');
                setCoverSubtitle(data.document.cover_subtitle || '');
                setIntroText(data.document.intro_text || '');
                setDisclaimerText(data.document.disclaimer_text || '');
                setSections(data.document.sections);
                // Korisničke slike (upload-ovane u editoru) su na backend originu, a Browsershot
                // čeka samo na #print-ready — ne i na njihovo učitavanje. Bez preload-a prva snimka
                // uhvati prazan <img> ("nema slike" u PDF-u). Zato ih grejemo u keš pre spremnosti.
                const contentImageUrls = collectImageUrls(data.document.sections);
                // Pune A4 slike (korica, strana posle korice, kontakt) su teške i jedini
                // su asseti na koje #print-ready ne čeka — preload-ujemo ih paralelno.
                await Promise.all([
                    preloadImage(COVER_BG_URL, 8000),
                    preloadImage(COVER_LOGO_URL, 8000),
                    preloadImage(PAGE2_BG_URL, 8000),
                    preloadImage(PAGE2_LOGO_URL, 8000),
                    preloadImage(CONTACT_PAGE_IMAGE_URL, 8000),
                    ...(TOC_BACKGROUND_URL ? [preloadImage(TOC_BACKGROUND_URL, 8000)] : []),
                    ...(SECTION_TITLE_BACKGROUND_URL ? [preloadImage(SECTION_TITLE_BACKGROUND_URL, 8000)] : []),
                    ...contentImageUrls.map((u) => preloadImage(u, 8000)),
                    preloadFonts(),
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
        let fallbackNo = 0; // rezerva ako sekcija nema `order` (rastući položaj u nizu)
        const toc: TocEntry[] = [];
        const flat: { page: any; sectionTitle: string; sectionNumber: number; globalPage: number; isSectionStart: boolean; isSectionEnd: boolean; sectionUpdatedAt?: string }[] = [];
        sections.forEach((section: any) => {
            const pages: any[] = section.canvas_data || [];
            fallbackNo += 1;
            // Redni broj poglavlja = `order` iz baze. Tako i export pojedinačne sekcije zadrži
            // njen pravi broj (npr. "6.", a ne "1."), a numeracija je ista i u punom exportu —
            // konzistentno bez obzira na način izvoza. Fallback na položaj u nizu ako order fali.
            const sectionNumber = (typeof section.order === 'number' && section.order > 0) ? section.order : fallbackNo;
            if (pages.length > 0) {
                toc.push({ number: sectionNumber, title: section.title || 'Sekcija', page: counter + 1 });
            }
            pages.forEach((page: any, idx: number) => {
                counter += 1;
                // isSectionStart → pred prvu stranu sekcije ubacujemo njenu naslovnu stranu.
                // isSectionEnd → poslednja strana sekcije nosi datum poslednje izmene te sekcije u footeru.
                flat.push({ page, sectionTitle: section.title, sectionNumber, globalPage: counter, isSectionStart: idx === 0, isSectionEnd: idx === pages.length - 1, sectionUpdatedAt: section.updated_at });
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
            <CoverPage isPrint={true} title={coverTitle || documentTitle} big={coverBig} subtitle={coverSubtitle} />
            <IntroLogoPage isPrint={true} introText={introText} />
            {/* Napomena o podacima — samostalna strana posle RATEL logo strane, pre Sadržaja. */}
            <DisclaimerPage isPrint={true} text={disclaimerText} />
            <TableOfContents entries={tocEntries} isPrint={true} />
            {flatPages.map(fp => (
                <Fragment key={`p-${fp.globalPage}`}>
                    {/* Naslovna strana sekcije (nenumerisana) — pre prve strane svake sekcije. */}
                    {fp.isSectionStart && <SectionTitlePage number={fp.sectionNumber} title={fp.sectionTitle || 'Sekcija'} isPrint={true} />}
                    {/* pageIndex = globalPage - 1 → podnožje (pageIndex + 1) prikazuje globalni broj strane. */}
                    <DocumentPage page={fp.page} pageIndex={fp.globalPage - 1} globalFootnoteMap={globalFootnoteMap} elementLabelMap={elementLabelMap} isPrint={true} documentTitle={documentTitle} sectionTitle={fp.sectionTitle} footerDate={fp.isSectionEnd ? formatLastModified(fp.sectionUpdatedAt) : undefined} />
                </Fragment>
            ))}
            <FullPageImage src={CONTACT_PAGE_IMAGE_URL} isPrint={true} />
        </div>
    );
};

export default PrintView;
