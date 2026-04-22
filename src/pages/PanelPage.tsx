import { useState, useEffect } from "react";
import LeftSidebar from "../components/LeftSidebar";
import Header from "../components/Header";
import RightSidebar from "../components/RightSidebar";
import ContentList from "../components/ContentList";
import Canvas from "../components/Canvas.tsx";

import axiosClient from "../axios-client";
import { Loader2 } from "lucide-react";
import { useEditor } from "../contexts/EditorContext";

const PanelPage = () => {
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
            alert("✅ Sekcija je uspešno sačuvana!");
        } catch (error) {
            alert("❌ Greška pri čuvanju sekcije!");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPdf = async () => {
        await handleSave();
        setIsSaving(true);

        try {
            const response = await axiosClient.post(`/api/documents/${DOCUMENT_ID}/export`);

            if (response.data.success) {
                const link = document.createElement('a');
                link.href = response.data.download_url;
                link.setAttribute('download', 'Izvestaj.pdf');
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
        } catch (error) {
            alert("Greška pri generisanju PDF-a!");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSectionChange = (id: number) => {
        setSelectedElement(null);
        setActiveSectionId(id);
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
            <div className="w-full h-screen flex flex-col items-center justify-center gap-4 text-slate-400 bg-background-grey">
                <Loader2 className="animate-spin text-blue-500" size={40} />
                <span className="font-semibold tracking-wider uppercase text-sm">Учитавање извештаја...</span>
            </div>
        );
    }

    const activeSection = sections.find(s => s.id === activeSectionId);
    const canvasData = activeSection?.canvas_data || [{ id: `page-${Date.now()}`, rows: [{ id: Math.random().toString(36).substr(2, 9), columns: [] }] }];

    return (
        <div className="bg-background-grey text-dark-blue font-sans h-screen flex flex-col overflow-hidden">

            <section className="flex shrink-0">
                <Header />
            </section>

            <section className="flex mx-8 flex-1 overflow-hidden">

                <LeftSidebar
                    onSave={handleSave}
                    onDownload={handleDownloadPdf}
                    isSaving={isSaving}
                />

                <div className="flex-1 flex p-10 pt-0 gap-10 justify-center overflow-y-auto custom-scrollbar relative">

                    <ContentList
                        sections={sections}
                        activeSectionId={activeSectionId}
                        onSectionChange={handleSectionChange}
                    />

                    {activeSection ? (
                        <Canvas pages={canvasData} setPages={handlePagesChange} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 w-full">
                            Изаберите секцију.
                        </div>
                    )}
                </div>

                <RightSidebar />
            </section>

        </div>
    );
};

export default PanelPage;
