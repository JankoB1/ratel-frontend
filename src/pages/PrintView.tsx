import { useEffect, useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { DocumentPage, buildMaps } from "../components/DocumentPageView";

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
                const token = params.get('token');
                let data: any;
                if (token) {
                    const res = await fetch(`/print-data/${token}.json`, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    if (!res.ok) throw new Error(`Statički fajl nije nađen: HTTP ${res.status}`);
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
                setTimeout(() => setIsReady(true), 1500);
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
            {sections.map(section =>
                (section.canvas_data || []).map((page: any, pageIndex: number) => (
                    <DocumentPage key={page.id} page={page} pageIndex={pageIndex} globalFootnoteMap={globalFootnoteMap} elementLabelMap={elementLabelMap} isPrint={true} documentTitle={documentTitle} sectionTitle={section.title} />
                ))
            )}
        </div>
    );
};

export default PrintView;
