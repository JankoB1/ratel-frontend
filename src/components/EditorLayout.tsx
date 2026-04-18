import { useState, useEffect } from 'react';
import LeftSidebar from './LeftSidebar';
import Canvas from './Canvas';
import axiosClient from '../axios-client';
import { Loader2 } from 'lucide-react';
import { useEditor } from '../contexts/EditorContext';

const EditorLayout = () => {
    const { setSelectedElement } = useEditor();
    const [sections, setSections] = useState<any[]>([]);
    const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const DOCUMENT_ID = 1;

    useEffect(() => {
        const fetchDocument = async () => {
            try {
                const response = await axiosClient.get(`/api/documents/${DOCUMENT_ID}`);
                const fetchedSections = response.data.document.sections;

                setSections(fetchedSections);
                if (fetchedSections && fetchedSections.length > 0) {
                    setActiveSectionId(fetchedSections[0].id);
                }
            } catch (error) {
                console.error("Greska pri ucitavanju:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDocument();
    }, []);

    const handleSave = async () => {
        if (!activeSectionId) return;
        setIsSaving(true);

        const activeSection = sections.find(s => s.id === activeSectionId);

        try {
            await axiosClient.put(`/api/sections/${activeSectionId}`, {
                canvas_data: activeSection.canvas_data
            });
        } catch (error) {
            alert("Greška pri čuvanju sekcije!");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPdf = () => {
        alert("Preuzimanje PDF-a u pripremi!");
    };

    const handlePagesChange = (action: any) => {
        setSections(prevSections => prevSections.map(sec => {
            if (sec.id === activeSectionId) {
                const currentData = sec.canvas_data || [{ id: `page-${Date.now()}`, rows: [{ id: Math.random().toString(36).substr(2, 9), columns: [] }] }];
                const nextData = typeof action === 'function' ? action(currentData) : action;
                return { ...sec, canvas_data: nextData };
            }
            return sec;
        }));
    };

    if (isLoading) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center gap-4 text-slate-400 bg-slate-50">
                <Loader2 className="animate-spin text-blue-500" size={40} />
                <span className="font-semibold tracking-wider uppercase text-sm">Учитавање извештаја...</span>
            </div>
        );
    }

    const activeSection = sections.find(s => s.id === activeSectionId);
    const canvasData = activeSection?.canvas_data || [{ id: `page-${Date.now()}`, rows: [{ id: Math.random().toString(36).substr(2, 9), columns: [] }] }];

    return (
        <div className="flex w-full h-screen overflow-hidden bg-slate-50">
            <LeftSidebar
                onSave={handleSave}
                onDownload={handleDownloadPdf}
                isSaving={isSaving}
            />

            <main className="flex-1 overflow-y-auto custom-scrollbar relative">
                {activeSection ? (
                    <Canvas pages={canvasData} setPages={handlePagesChange} />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        Изаберите секцију са леве стране.
                    </div>
                )}
            </main>
        </div>
    );
};

export default EditorLayout;
