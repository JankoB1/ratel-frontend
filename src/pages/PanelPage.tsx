import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import LeftSidebar from "../components/LeftSidebar";
import Header from "../components/Header";
import RightSidebar from "../components/RightSidebar";
import ContentList from "../components/ContentList";
import Canvas from "../components/Canvas.tsx";

import axiosClient from "../axios-client";
import { Loader2, Search as SearchIcon, ChevronUp, ChevronDown, X, Lock, Send, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { useEditor } from "../contexts/EditorContext";
import { useAuth } from "../contexts/AuthContext";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

// Approval status presentation
const APPROVAL_STATUS_INFO: Record<string, { label: string; color: string; bg: string; border: string }> = {
    draft:                { label: 'У изради',                  color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
    pending_rukovodilac:  { label: 'Чека руководиоца',          color: '#7c3aed', bg: '#f3e8ff', border: '#c4b5fd' },
    pending_direktor:     { label: 'Чека директора',            color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
    pending_kabinet:      { label: 'Чека кабинет',              color: '#059669', bg: '#d1fae5', border: '#6ee7b7' },
    pending_admin:        { label: 'Чека админа (финално)',     color: '#0056B3', bg: '#dbeafe', border: '#93c5fd' },
    approved:             { label: 'Одобрено',                  color: '#15803d', bg: '#dcfce7', border: '#86efac' },
    rejected:             { label: 'Одбијено',                  color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
};
const getApprovalInfo = (s: string | undefined) => APPROVAL_STATUS_INFO[s || 'draft'] || APPROVAL_STATUS_INFO.draft;

const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ');

const extractElementText = (el: any): string => {
    const payload = el.payload || {};
    const settings = payload.settings || {};
    const parts: string[] = [];
    switch (el.type) {
        case 'text':
            parts.push(stripHtml(settings.content || ''));
            break;
        case 'table':
            Object.values(payload.sr?.content || {}).forEach((v: any) => {
                if (typeof v === 'string') parts.push(stripHtml(v));
            });
            if (settings.title) parts.push(settings.title);
            break;
        case 'chart':
            if (settings.title) parts.push(settings.title);
            if (settings.subtitle) parts.push(settings.subtitle);
            if (settings.description) parts.push(settings.description);
            (payload.data || []).forEach((d: any) => { if (d?.name) parts.push(String(d.name)); });
            (payload.keys || []).forEach((k: string) => parts.push(k));
            break;
        case 'image':
            if (settings.altText) parts.push(settings.altText);
            if (settings.caption) parts.push(settings.caption);
            break;
        case 'map':
            if (settings.title) parts.push(settings.title);
            break;
    }
    return parts.join(' ').toLowerCase();
};

const PanelPage = () => {
    const { setSelectedElement } = useEditor();
    const { user } = useAuth();
    const { docId } = useParams<{ docId?: string }>();
    const [searchParams] = useSearchParams();
    const requestedSectionId = searchParams.get('section') ? Number(searchParams.get('section')) : null;
    const DOCUMENT_ID = docId ? Number(docId) : 1; // fallback na 1 ako nije u URL-u
    const [sections, setSections] = useState<any[]>([]);
    const [documentInfo, setDocumentInfo] = useState<{ title: string; status: string } | null>(null);
    const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const historyRef = useRef<string[]>([]);
    const isUndoingRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [canUndo, setCanUndo] = useState(false);

    // --- Concurrent editing lock ---
    const [sectionLockedBy, setSectionLockedBy] = useState<string | null>(null);
    const lockHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lockedSectionIdRef = useRef<number | null>(null); // section we currently hold lock for

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [zoom, setZoom] = useState(1);

    const handleDocumentUpdate = useCallback(async (updates: { title?: string; status?: string }) => {
        try {
            const response = await axiosClient.put(`/api/admin/documents/${DOCUMENT_ID}`, updates);
            const doc = response.data.document;
            setDocumentInfo({ title: doc.title || 'Без наслова', status: doc.status || 'draft' });
        } catch (e) {
            console.error(e);
            alert('Грешка при чувању документа!');
        }
    }, []);

    const stopHeartbeat = useCallback(() => {
        if (lockHeartbeatRef.current) {
            clearInterval(lockHeartbeatRef.current);
            lockHeartbeatRef.current = null;
        }
    }, []);

    const releaseSectionLock = useCallback(async (sectionId: number) => {
        try { await axiosClient.delete(`/api/sections/${sectionId}/lock`); } catch { /* ignore */ }
        lockedSectionIdRef.current = null;
        stopHeartbeat();
    }, [stopHeartbeat]);

    const acquireSectionLock = useCallback(async (sectionId: number) => {
        try {
            const res = await axiosClient.post(`/api/sections/${sectionId}/lock`);
            if (res.data.acquired) {
                setSectionLockedBy(null);
                lockedSectionIdRef.current = sectionId;
                // Heartbeat: refresh lock every 90s so it doesn't expire
                stopHeartbeat();
                lockHeartbeatRef.current = setInterval(async () => {
                    try { await axiosClient.post(`/api/sections/${sectionId}/lock`); } catch { /* ignore */ }
                }, 90_000);
            } else {
                setSectionLockedBy(res.data.locked_by || 'Drugi korisnik');
                lockedSectionIdRef.current = null;
                stopHeartbeat();
            }
        } catch {
            setSectionLockedBy(null);
        }
    }, [stopHeartbeat]);

    // Release lock on unmount
    useEffect(() => {
        return () => {
            stopHeartbeat();
            if (lockedSectionIdRef.current) {
                axiosClient.delete(`/api/sections/${lockedSectionIdRef.current}/lock`).catch(() => {});
            }
        };
    }, [stopHeartbeat]);

    const handleZoomIn = useCallback(() => setZoom(z => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 100) / 100)), []);
    const handleZoomOut = useCallback(() => setZoom(z => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 100) / 100)), []);
    const handleZoomReset = useCallback(() => setZoom(1), []);

    // Search state
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMatches, setSearchMatches] = useState<string[]>([]);
    const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const openSearch = useCallback(() => {
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
    }, []);
    const closeSearch = useCallback(() => {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchMatches([]);
    }, []);
    const nextMatch = useCallback(() => {
        setCurrentMatchIdx(i => (searchMatches.length ? (i + 1) % searchMatches.length : 0));
    }, [searchMatches.length]);
    const prevMatch = useCallback(() => {
        setCurrentMatchIdx(i => (searchMatches.length ? (i - 1 + searchMatches.length) % searchMatches.length : 0));
    }, [searchMatches.length]);

    useEffect(() => {
        const fetchDocument = async () => {
            try {
                const response = await axiosClient.get(`/api/documents/${DOCUMENT_ID}`);
                const doc = response.data.document;
                const fetchedSections = doc.sections;

                setDocumentInfo({ title: doc.title || 'Без наслова', status: doc.status || 'draft' });
                setSections(fetchedSections);
                if (fetchedSections && fetchedSections.length > 0) {
                    // Ako je deeplink ?section=X postoji, koristi tu sekciju
                    const targetId = requestedSectionId && fetchedSections.some((s: any) => s.id === requestedSectionId)
                        ? requestedSectionId
                        : fetchedSections[0].id;
                    setActiveSectionId(targetId);
                    // Acquire lock for the target section (non-blocking)
                    axiosClient.post(`/api/sections/${targetId}/lock`).then(res => {
                        if (res.data.acquired) {
                            lockedSectionIdRef.current = targetId;
                            lockHeartbeatRef.current = setInterval(async () => {
                                try { await axiosClient.post(`/api/sections/${targetId}/lock`); } catch { /* ignore */ }
                            }, 90_000);
                        } else {
                            setSectionLockedBy(res.data.locked_by || 'Drugi korisnik');
                        }
                    }).catch(() => {});
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
        const activeSection = sections.find(s => s.id === activeSectionId);
        const canEdit = !!user?.is_admin || activeSection?.can_edit !== false;
        if (!canEdit) {
            alert("❌ Немате привилегију да мењате ову секцију.");
            return;
        }

        // Confirm pre snimanja ako je sekcija već odobrena — backend će automatski resetovati na draft.
        if (activeSection?.approval_status === 'approved') {
            const ok = confirm('Ова секција је већ одобрена. Чување измена ће поништити сва одобрења и вратити секцију у статус „у изради” (draft). Настављамо?');
            if (!ok) return;
        }

        setIsSaving(true);
        try {
            const { data } = await axiosClient.put(`/api/sections/${activeSectionId}`, {
                canvas_data: activeSection.canvas_data
            });
            // Backend može da je auto-resetovao status (kad je bila approved)
            if (data?.approval_status) {
                setSections(prev => prev.map(sec => sec.id === activeSectionId ? {
                    ...sec,
                    approval_status: data.approval_status,
                    rejected_reason: data.approval_status === 'rejected' ? sec.rejected_reason : null,
                } : sec));
            }
            if (data?.auto_reset) {
                alert("✅ Сачувано. Сва претходна одобрења су поништена — секција је сада у статусу 'У изради'.");
            } else {
                alert("✅ Sekcija je uspešno sačuvana!");
            }
        } catch (error: any) {
            if (error?.response?.status === 403) {
                alert("❌ Немате привилегију да мењате ову секцију.");
            } else {
                alert("❌ Greška pri čuvanju sekcije!");
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPdf = async () => {
        await handleSave();

        // Otvaramo prazan tab odmah (pre await), jer browseri blokiraju window.open posle async operacija
        const pdfWindow = window.open('', '_blank');
        setIsSaving(true);

        try {
            const response = await axiosClient.post(`/api/documents/${DOCUMENT_ID}/export`);

            if (response.data.success && pdfWindow) {
                pdfWindow.location.href = response.data.download_url;
            }
        } catch (error) {
            pdfWindow?.close();
            alert("Greška pri generisanju PDF-a!");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSectionChange = async (id: number) => {
        setSelectedElement(null);
        setSectionLockedBy(null); // clear stale banner immediately

        // Release previous lock before switching
        if (lockedSectionIdRef.current && lockedSectionIdRef.current !== id) {
            await releaseSectionLock(lockedSectionIdRef.current);
        }

        try {
            const response = await axiosClient.get(`/api/sections/${id}`);
            const freshSection = response.data.section;
            setSections(prevSections => prevSections.map(sec =>
                sec.id === id ? freshSection : sec
            ));
        } catch (error) {
            console.error("Greška pri osvežavanju sekcije:", error);
        }

        setActiveSectionId(id);

        // Try to acquire lock for this section
        await acquireSectionLock(id);
    };

    const handleSectionToggleDisabled = async (id: number, currentlyDisabled: boolean) => {
        const newValue = !currentlyDisabled;
        // Optimistically update local state
        setSections(prev => prev.map(sec =>
            sec.id === id ? { ...sec, is_disabled: newValue } : sec
        ));
        // If the now-disabled section was active, deselect it
        if (newValue && activeSectionId === id) {
            setActiveSectionId(null);
            setSelectedElement(null);
        }
        try {
            await axiosClient.put(`/api/sections/${id}`, { is_disabled: newValue });
        } catch (error) {
            console.error("Greška pri promeni statusa sekcije:", error);
            // Revert on error
            setSections(prev => prev.map(sec =>
                sec.id === id ? { ...sec, is_disabled: currentlyDisabled } : sec
            ));
        }
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

    // Derived values placed before hooks so they can be used as dependencies
    const activeSection = sections.find(s => s.id === activeSectionId);
    const canEditSection = !!user?.is_admin || activeSection?.can_edit !== false;
    const canvasData = activeSection?.canvas_data || [{ id: `page-${Date.now()}`, rows: [{ id: Math.random().toString(36).substr(2, 9), columns: [] }] }];
    const activeSectionIndex = sections.findIndex(s => s.id === activeSectionId);
    const sectionNum = activeSectionIndex !== -1 ? activeSectionIndex + 1 : 1;

    useEffect(() => {
        historyRef.current = [];
        setCanUndo(false);
    }, [activeSectionId]);

    useEffect(() => {
        if (isUndoingRef.current) {
            isUndoingRef.current = false;
            return;
        }
        clearTimeout(debounceTimerRef.current);
        const serialized = JSON.stringify(canvasData);
        debounceTimerRef.current = setTimeout(() => {
            const last = historyRef.current[historyRef.current.length - 1];
            if (last !== serialized) {
                historyRef.current = [...historyRef.current.slice(-49), serialized];
                setCanUndo(historyRef.current.length > 1);
            }
        }, 600);
        return () => clearTimeout(debounceTimerRef.current);
    }, [canvasData]);

    const handleUndo = useCallback(() => {
        if (historyRef.current.length < 2) return;
        clearTimeout(debounceTimerRef.current);
        historyRef.current = historyRef.current.slice(0, -1);
        const previousState = JSON.parse(historyRef.current[historyRef.current.length - 1]);
        isUndoingRef.current = true;
        setSelectedElement(null);
        setSections(prevSections => prevSections.map(sec =>
            sec.id === activeSectionId ? { ...sec, canvas_data: previousState } : sec
        ));
        setCanUndo(historyRef.current.length > 1);
    }, [activeSectionId, setSelectedElement]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                const target = e.target as HTMLElement;
                if (target.closest('[contenteditable]')) return;
                e.preventDefault();
                handleUndo();
            }
            // Zoom shortcuts: Cmd/Ctrl + (+ / - / 0)
            if (e.metaKey || e.ctrlKey) {
                if (e.key === '=' || e.key === '+') { e.preventDefault(); handleZoomIn(); }
                else if (e.key === '-' || e.key === '_') { e.preventDefault(); handleZoomOut(); }
                else if (e.key === '0') { e.preventDefault(); handleZoomReset(); }
                else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); openSearch(); }
            }
            // Escape closes search
            if (e.key === 'Escape' && searchOpen) {
                closeSearch();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleZoomIn, handleZoomOut, handleZoomReset, openSearch, closeSearch, searchOpen]);

    // Compute search matches when query or section changes
    useEffect(() => {
        if (!searchQuery.trim() || !activeSection) {
            setSearchMatches([]);
            setCurrentMatchIdx(0);
            return;
        }
        const q = searchQuery.toLowerCase().trim();
        const matched: string[] = [];
        (activeSection.canvas_data || []).forEach((page: any) => {
            page.rows?.forEach((row: any) => {
                row.columns?.forEach((col: any) => {
                    col.elements?.forEach((el: any) => {
                        const text = extractElementText(el);
                        if (text.includes(q)) matched.push(el.id);
                    });
                });
            });
        });
        setSearchMatches(matched);
        setCurrentMatchIdx(0);
    }, [searchQuery, activeSection]);

    // Apply highlight classes to DOM elements + scroll to current
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        container.querySelectorAll('.search-match, .search-match-current').forEach(el => {
            el.classList.remove('search-match', 'search-match-current');
        });
        searchMatches.forEach((id, idx) => {
            const el = container.querySelector(`[data-element-id="${CSS.escape(id)}"]`);
            if (el) {
                el.classList.add('search-match');
                if (idx === currentMatchIdx) el.classList.add('search-match-current');
            }
        });
        if (searchMatches.length > 0) {
            const id = searchMatches[currentMatchIdx];
            const el = container.querySelector(`[data-element-id="${CSS.escape(id)}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchMatches, currentMatchIdx]);

    // Clear highlights when search closes
    useEffect(() => {
        if (searchOpen) return;
        const container = scrollContainerRef.current;
        container?.querySelectorAll('.search-match, .search-match-current').forEach(el => {
            el.classList.remove('search-match', 'search-match-current');
        });
    }, [searchOpen]);

    // Ctrl/Cmd + wheel zoom on the canvas scroll container
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const onWheel = (e: WheelEvent) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            const delta = -Math.sign(e.deltaY) * ZOOM_STEP;
            setZoom(z => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round((z + delta) * 100) / 100)));
        };
        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        let rafId: number;
        const handleScroll = () => {
            cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const pageEls = container.querySelectorAll<HTMLElement>('[data-page-index]');
                const containerTop = container.getBoundingClientRect().top;
                let bestIndex = 0;
                let bestDistance = Infinity;
                pageEls.forEach(el => {
                    const dist = Math.abs(el.getBoundingClientRect().top - containerTop);
                    if (dist < bestDistance) {
                        bestDistance = dist;
                        bestIndex = parseInt(el.getAttribute('data-page-index') || '0');
                    }
                });
                setCurrentPageIndex(bestIndex);
            });
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            container.removeEventListener('scroll', handleScroll);
            cancelAnimationFrame(rafId);
        };
    }, [canvasData.length]);

    const handlePageChange = useCallback((index: number) => {
        const clamped = Math.max(0, Math.min(index, canvasData.length - 1));
        const el = scrollContainerRef.current?.querySelector<HTMLElement>(`[data-page-index="${clamped}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, [canvasData.length]);

    if (isLoading) {
        return (
            <div className="w-full h-screen flex flex-col items-center justify-center gap-4 text-slate-400 bg-background-grey">
                <Loader2 className="animate-spin text-blue-500" size={40} />
                <span className="font-semibold tracking-wider uppercase text-sm">Учитавање извештаја...</span>
            </div>
        );
    }

    return (
        <div className="bg-background-grey text-dark-blue font-sans h-screen flex flex-col overflow-hidden">

            <section className="flex shrink-0">
                <Header
                    onUndo={handleUndo}
                    canUndo={canUndo}
                    zoom={zoom}
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onZoomReset={handleZoomReset}
                    zoomMin={ZOOM_MIN}
                    zoomMax={ZOOM_MAX}
                    onSearchClick={openSearch}
                    documentTitle={documentInfo?.title}
                    documentStatus={documentInfo?.status}
                    onDocumentUpdate={handleDocumentUpdate}
                />
            </section>

            {/* Floating search bar */}
            {searchOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 110,
                        right: 40,
                        zIndex: 100,
                        background: 'white',
                        borderRadius: 16,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        border: '1px solid #e2e8f0',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        minWidth: 380,
                    }}
                >
                    <SearchIcon size={16} className="text-slate-400" />
                    <input
                        ref={searchInputRef}
                        autoFocus
                        type="text"
                        placeholder="Претражи у документу..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (e.shiftKey) prevMatch();
                                else nextMatch();
                            } else if (e.key === 'Escape') {
                                closeSearch();
                            }
                        }}
                        style={{ flex: 1, outline: 'none', fontSize: 14, color: '#1e293b', background: 'transparent', border: 'none' }}
                    />
                    <span style={{ fontSize: 12, color: '#64748b', minWidth: 72, textAlign: 'center', fontWeight: 600 }}>
                        {searchQuery.trim() === ''
                            ? ''
                            : searchMatches.length === 0
                                ? 'Нема резултата'
                                : `${currentMatchIdx + 1} / ${searchMatches.length}`}
                    </span>
                    <button
                        onClick={prevMatch}
                        disabled={!searchMatches.length}
                        title="Претходни (Shift+Enter)"
                        style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: searchMatches.length ? '#475569' : '#cbd5e1', cursor: searchMatches.length ? 'pointer' : 'not-allowed' }}
                    >
                        <ChevronUp size={16} />
                    </button>
                    <button
                        onClick={nextMatch}
                        disabled={!searchMatches.length}
                        title="Следећи (Enter)"
                        style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: searchMatches.length ? '#475569' : '#cbd5e1', cursor: searchMatches.length ? 'pointer' : 'not-allowed' }}
                    >
                        <ChevronDown size={16} />
                    </button>
                    <button
                        onClick={closeSearch}
                        title="Затвори (Esc)"
                        style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer' }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Search highlight styles */}
            <style>{`
                .search-match {
                    outline: 2px solid #fbbf24 !important;
                    outline-offset: 4px;
                    border-radius: 6px;
                    background-color: rgba(254, 243, 199, 0.35);
                    transition: outline-color 0.2s, box-shadow 0.2s, background-color 0.2s;
                }
                .search-match-current {
                    outline: 3px solid #f59e0b !important;
                    outline-offset: 4px;
                    box-shadow: 0 0 0 6px rgba(251, 191, 36, 0.3);
                    background-color: rgba(254, 215, 170, 0.5);
                }
            `}</style>

            <section className="flex mx-8 flex-1 overflow-hidden">

                <LeftSidebar
                    onSave={handleSave}
                    onDownload={handleDownloadPdf}
                    isSaving={isSaving}
                    currentPage={currentPageIndex}
                    totalPages={canvasData.length}
                    onPageChange={handlePageChange}
                />

                <div ref={scrollContainerRef} className="flex-1 flex p-10 pt-0 gap-10 justify-center overflow-y-auto custom-scrollbar relative">

                    <ContentList
                        sections={sections}
                        activeSectionId={activeSectionId}
                        onSectionChange={handleSectionChange}
                        onSectionToggleDisabled={handleSectionToggleDisabled}
                    />

                    {activeSection ? (
                        <div>
                            {/* Approval status banner — info only. Action dugmad i sve detalje su sada u RightSidebar "Одобр." tab-u. */}
                            {(() => {
                                const status = activeSection.approval_status || 'draft';
                                const info = getApprovalInfo(status);
                                const isPending = status.startsWith('pending_');
                                return (
                                    <div style={{
                                        position: 'sticky', top: 0, zIndex: 50,
                                        background: info.bg,
                                        border: `1px solid ${info.border}`,
                                        borderRadius: '12px',
                                        padding: '10px 16px',
                                        marginBottom: '12px',
                                        display: 'flex', alignItems: 'center', gap: '10px',
                                        fontSize: '13px', fontWeight: 600, color: info.color,
                                    }}>
                                        {status === 'approved' ? <CheckCircle2 size={16} /> :
                                         status === 'rejected' ? <AlertCircle size={16} /> :
                                         isPending ? <Clock size={16} /> :
                                         <Send size={16} />}
                                        <span style={{ flex: 1 }}>
                                            <strong>{info.label}.</strong>
                                            {status === 'draft'    && ' Уредник може да пошаље на преглед (десно, „Одобр." таб).'}
                                            {isPending             && ' Сви додељени могу да едитују; акције за одобравање су десно, „Одобр." таб.'}
                                            {status === 'approved' && ' Секција је јавна — измене утичу на јавни приказ.'}
                                            {status === 'rejected' && activeSection.rejected_reason && (
                                                <span style={{ display: 'block', marginTop: 4, fontWeight: 500, fontSize: 12 }}>
                                                    Разлог: „{activeSection.rejected_reason}"
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                );
                            })()}
                            {!canEditSection && !sectionLockedBy && (
                                <div style={{
                                    position: 'sticky', top: 0, zIndex: 50,
                                    background: '#dbeafe',
                                    border: '1px solid #60a5fa',
                                    borderRadius: '12px',
                                    padding: '10px 16px',
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#1e40af',
                                }}>
                                    <Lock size={16} />
                                    <span>
                                        Нисте додељени овој секцији — само је прегледате.
                                    </span>
                                </div>
                            )}
                            {sectionLockedBy && (
                                <div style={{
                                    position: 'sticky', top: 0, zIndex: 50,
                                    background: '#fef3c7',
                                    border: '1px solid #f59e0b',
                                    borderRadius: '12px',
                                    padding: '10px 16px',
                                    marginBottom: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#92400e',
                                }}>
                                    <span style={{ fontSize: '18px' }}>🔒</span>
                                    <span>
                                        <strong>{sectionLockedBy}</strong> тренутно уређује ову секцију. Уређивање је онемогућено.
                                    </span>
                                </div>
                            )}
                            <div style={{ zoom }}>
                                <Canvas
                                    pages={canvasData}
                                    setPages={handlePagesChange}
                                    sectionNum={sectionNum}
                                    documentTitle={documentInfo?.title}
                                    sectionTitle={activeSection.title}
                                    readOnly={!canEditSection || !!sectionLockedBy}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 w-full">
                            Изаберите секцију.
                        </div>
                    )}
                </div>

                <RightSidebar
                    activeSectionId={activeSectionId}
                    activeSectionPageCount={canvasData.length || 1}
                    onApprovalChanged={async () => {
                        if (!activeSectionId) return;
                        try {
                            const { data } = await axiosClient.get(`/api/sections/${activeSectionId}`);
                            setSections(prev => prev.map(sec => sec.id === activeSectionId ? {
                                ...sec,
                                approval_status: data.approval_status,
                                rejected_reason: data.rejected_reason,
                                can_edit: data.can_edit,
                                has_assignment: data.has_assignment,
                            } : sec));
                        } catch { /* ignore */ }
                    }}
                />
            </section>

        </div>
    );
};

export default PanelPage;
