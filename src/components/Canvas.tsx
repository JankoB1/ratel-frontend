import { useState, useEffect, useRef, useMemo, type FC } from "react";
import { Plus, Copy } from "lucide-react";
import { useEditor } from "../contexts/EditorContext";
import axiosClient from "../axios-client.ts";
import { PageItem } from "./CanvasEditor/PageItem";
import type { ElementType, RowData, ColumnData } from "./CanvasEditor/types";
import { extractFootnoteIds } from "./CanvasEditor/utils";
import { SERBIAN_DISTRICTS } from "./CanvasEditor/constants";

export { extractFootnoteIds };

interface CanvasProps {
    pages: any[];
    setPages: (action: any) => void;
    sectionNum?: number;
    documentTitle?: string;
    sectionTitle?: string;
    readOnly?: boolean;
}

const Canvas: FC<CanvasProps> = ({ pages, setPages, sectionNum = 1, documentTitle, sectionTitle, readOnly = false }) => {
    const { setSelectedElement, selectedElement, updateElementSettings, isGroupingMode, setIsGroupingMode, groupSelection, setGroupSelection } = useEditor();

    const pagesRef = useRef(pages);
    useEffect(() => { pagesRef.current = pages; }, [pages]);

    const [activeRowMenu, setActiveRowMenu] = useState<{pageId: string, rowId: string} | null>(null);
    const [activeColMenu, setActiveColMenu] = useState<{pageId: string, colId: string} | null>(null);
    const [draggedItem, setDraggedItem] = useState<any>(null);
    const draggedItemRef = useRef<any>(null);
    const initialPagesRef = useRef<any>(null);

    // ── Drag & Drop ────────────────────────────────────────────────────────────

    const onDragStart = (e: React.DragEvent, pageId: string, rowId: string, colId: string, elementId: string) => {
        e.dataTransfer.setData('text/plain', elementId);
        e.dataTransfer.effectAllowed = 'move';
        const item = { pageId, rowId, colId, elementId };
        draggedItemRef.current = item;
        setDraggedItem(item);
        // Apply source dimming AFTER the browser has captured the default drag image
        requestAnimationFrame(() => {
            const sourceEl = document.querySelector(`[data-element-id="${elementId}"]`) as HTMLElement | null;
            if (sourceEl) sourceEl.classList.add('is-dragging');
        });
    };

    const onDragEnd = () => {
        document.querySelectorAll('[data-element-id].is-dragging').forEach(el => el.classList.remove('is-dragging'));
        document.querySelectorAll('.element-drop-wrapper.drop-above, .element-drop-wrapper.drop-below').forEach(el => el.classList.remove('drop-above', 'drop-below'));
        document.querySelectorAll('.canvas-col.is-drop-target').forEach(el => el.classList.remove('is-drop-target'));
        draggedItemRef.current = null;
        setDraggedItem(null);
    };

    /**
     * Drop at a specific position index within a column.
     * index = 0  → insert before first element
     * index = n  → insert after last element
     */
    const onDropAtZone = (targetPageId: string, targetRowId: string, targetColId: string, targetIndex: number) => {
        const item = draggedItemRef.current;
        if (!item) { onDragEnd(); return; }

        const { pageId: srcPageId, colId: srcColId, elementId } = item;

        setPages((prev: any[]) => {
            let dragEl: any = null;
            let srcIdx = -1;

            // Step 1: remove element from its source column
            const withoutEl = prev.map(page => ({
                ...page,
                rows: page.rows.map((row: any) => ({
                    ...row,
                    columns: row.columns.map((col: any) => {
                        if (col.id === srcColId && page.id === srcPageId) {
                            const idx = col.elements.findIndex((e: any) => e.id === elementId);
                            if (idx !== -1) { dragEl = col.elements[idx]; srcIdx = idx; }
                            return { ...col, elements: col.elements.filter((e: any) => e.id !== elementId) };
                        }
                        return col;
                    }),
                })),
            }));

            if (!dragEl) return prev;

            // Step 2: adjust insert index when moving within the same column
            // (removal shifted indices for items after the source)
            let insertAt = targetIndex;
            if (srcColId === targetColId && srcPageId === targetPageId && srcIdx < targetIndex) {
                insertAt = targetIndex - 1;
            }
            insertAt = Math.max(0, insertAt);

            // Step 3: insert into target column at calculated position
            return withoutEl.map(page => page.id !== targetPageId ? page : {
                ...page,
                rows: page.rows.map((row: any) => row.id !== targetRowId ? row : {
                    ...row,
                    columns: row.columns.map((col: any) => {
                        if (col.id !== targetColId) return col;
                        const els = [...col.elements];
                        els.splice(insertAt, 0, dragEl);
                        return { ...col, elements: els };
                    }),
                }),
            });
        });

        onDragEnd();
        setSelectedElement(null);
    };

    // ── Page/Element CRUD ──────────────────────────────────────────────────────

    const handleInsertPage = (index: number) => {
        setPages((prev: any[]) => {
            const newPage = {
                id: `page-${Date.now()}`,
                rows: [{ id: Math.random().toString(36).substr(2, 9), columns: [] }]
            };
            const updated = [...prev];
            updated.splice(index, 0, newPage);
            return updated;
        });
    };

    const handleDuplicatePage = (index: number) => {
        setPages((prev: any[]) => {
            const original = prev[index];
            const freshId = () => Math.random().toString(36).substr(2, 9);
            const cloned = {
                ...original,
                id: `page-${Date.now()}`,
                rows: (original.rows || []).map((row: any) => ({
                    ...row,
                    id: freshId(),
                    columns: (row.columns || []).map((col: any) => ({
                        ...col,
                        id: freshId(),
                        elements: (col.elements || []).map((el: any) => ({
                            ...el,
                            id: freshId(),
                            payload: el.payload ? JSON.parse(JSON.stringify(el.payload)) : el.payload,
                        })),
                    })),
                })),
            };
            const updated = [...prev];
            updated.splice(index + 1, 0, cloned);
            return updated;
        });
    };

    const elementLabelMap = useMemo(() => {
        const map: Record<string, string> = {};
        let tableCount = 1;
        let mediaCount = 1;
        pages.forEach((page) => {
            page.rows.forEach((row: any) => {
                row.columns.forEach((col: any) => {
                    col.elements.forEach((el: any) => {
                        if (el.type === 'table') { map[el.id] = `Tabela ${sectionNum}.${tableCount}`; tableCount++; }
                        else if (el.type === 'image' || el.type === 'chart') { map[el.id] = `Slika ${sectionNum}.${mediaCount}`; mediaCount++; }
                    });
                });
            });
        });
        return map;
    }, [pages, sectionNum]);

    const globalFootnoteOrder = useMemo(() => {
        const order: string[] = [];
        pages.forEach(page => {
            page.rows.forEach((row: any) => {
                row.columns.forEach((col: any) => {
                    col.elements.forEach((el: any) => {
                        if (el.type === 'text' && el.payload.settings.content) {
                            order.push(...extractFootnoteIds(el.payload.settings.content));
                        } else if (el.type === 'table') {
                            const contentObj = el.payload.sr?.content || {};
                            const sortedKeys = Object.keys(contentObj).sort((a, b) => {
                                const [rA, cA] = a.split('_').map(Number);
                                const [rB, cB] = b.split('_').map(Number);
                                return rA !== rB ? rA - rB : cA - cB;
                            });
                            sortedKeys.forEach(key => {
                                const html = contentObj[key];
                                if (typeof html === 'string') order.push(...extractFootnoteIds(html));
                            });
                        }
                    });
                });
            });
        });
        return order;
    }, [pages]);

    const globalFootnoteMap = useMemo(() => {
        const map: any = {};
        globalFootnoteOrder.forEach((id, index) => { map[id] = index + 1; });
        return map;
    }, [globalFootnoteOrder]);

    useEffect(() => {
        const handleCreateGroup = async (e: any) => {
            const { groupName, selectedIds } = e.detail;
            if (!selectedIds || selectedIds.length === 0) return;

            const extractedElements: any[] = [];
            const rowsData: any[] = [];

            pagesRef.current.forEach((page: any) => {
                page.rows.forEach((row: any) => {
                    const filteredCols = row.columns
                        .map((col: any) => ({ ...col, elements: col.elements.filter((el: any) => selectedIds.includes(el.id)) }))
                        .filter((col: any) => col.elements.length > 0);

                    if (filteredCols.length > 0) {
                        rowsData.push({ ...row, columns: filteredCols });
                        filteredCols.forEach((col: any) => col.elements.forEach((el: any) => extractedElements.push({ ...el })));
                    }
                });
            });

            try {
                await axiosClient.post('/api/saved-groups', { name: groupName, elements: extractedElements, rows_data: rowsData });
                window.dispatchEvent(new Event('group-saved'));
            } catch (error) {
                console.error("Greška pri čuvanju grupe:", error);
                alert("Дошло је до грешке приликом чувања.");
            }

            setIsGroupingMode(false);
            setGroupSelection([]);
        };

        window.addEventListener('create-group', handleCreateGroup);
        return () => window.removeEventListener('create-group', handleCreateGroup);
    }, [setIsGroupingMode, setGroupSelection]);

    useEffect(() => {
        const handleInsertSavedGroup = (e: any) => {
            const { elements } = e.detail;
            if (!elements || elements.length === 0) return;

            const freshElements = elements.map((el: any) => ({ ...el, id: Math.random().toString(36).substr(2, 9) }));
            const newRow = {
                id: Math.random().toString(36).substr(2, 9),
                columns: [{ id: Math.random().toString(36).substr(2, 9), widthClass: 'col-span-12', elements: freshElements }]
            };

            setPages((prevPages: any[]) => {
                if (prevPages.length === 0) return prevPages;
                const lastPageIndex = prevPages.length - 1;
                return prevPages.map((page, index) => index === lastPageIndex ? { ...page, rows: [...page.rows, newRow] } : page);
            });
        };

        window.addEventListener('insert-saved-group', handleInsertSavedGroup);
        return () => window.removeEventListener('insert-saved-group', handleInsertSavedGroup);
    }, [setPages]);

    useEffect(() => {
        if (!initialPagesRef.current && pages.length > 0) initialPagesRef.current = JSON.stringify(pages);
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (initialPagesRef.current !== JSON.stringify(pages)) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [pages]);

    useEffect(() => {
        if (selectedElement) {
            setPages((prev: any[]) => prev.map(page => {
                if (page.id !== selectedElement.pageId) return page;
                return { ...page, rows: page.rows.map((row: any) => ({ ...row, columns: row.columns.map((col: any) => ({ ...col, elements: col.elements.map((el: any) => el.id === selectedElement.elementId ? { ...el, payload: { ...el.payload, settings: selectedElement.settings, ...(selectedElement.extraPayload || {}) } } : el) })) })) };
            }));
        }
    }, [selectedElement]);

    const handleAutoSplit = (params: any) => {
        const { sourcePageId, elementId, remainingContent, safeHtml, tableSettings, tableContent, originalTableSettings, originalTableContent, safeFootnotes, remainingFootnotes } = params;

        if (selectedElement && selectedElement.elementId === elementId) {
            let updatedSettings = { ...selectedElement.settings };
            let updatedExtra: any = selectedElement.extraPayload ? { ...selectedElement.extraPayload } : {};

            if (remainingContent === "TABLE_SPLIT") {
                updatedSettings = { ...updatedSettings, ...originalTableSettings };
                updatedExtra = { sr: { content: originalTableContent } };
            } else {
                updatedSettings = { ...updatedSettings, content: safeHtml, footnotes: safeFootnotes };
            }

            setSelectedElement({ ...selectedElement, settings: updatedSettings, extraPayload: updatedExtra });
        }

        const newElementId = Math.random().toString(36).substr(2, 9);
        const newRowId = Math.random().toString(36).substr(2, 9);
        const newColId = Math.random().toString(36).substr(2, 9);

        setPages((prev: any[]) => {
            const pageIndex = prev.findIndex(p => p.id === sourcePageId);
            if (pageIndex === -1) return prev;

            let originalSettings: any = {};
            const isTableSplit = remainingContent === "TABLE_SPLIT";

            const updatedPages = prev.map((page, idx) => {
                if (idx !== pageIndex) return page;
                return {
                    ...page,
                    rows: page.rows.map((row: any) => ({
                        ...row,
                        columns: row.columns.map((col: any) => ({
                            ...col,
                            elements: col.elements.map((e: any) => {
                                if (e.id === elementId) {
                                    originalSettings = e.payload.settings;
                                    if (isTableSplit) return { ...e, payload: { ...e.payload, settings: originalTableSettings, sr: { content: originalTableContent } } };
                                    return { ...e, payload: { ...e.payload, settings: { ...e.payload.settings, content: safeHtml, footnotes: safeFootnotes } } };
                                }
                                return e;
                            })
                        }))
                    }))
                };
            });

            let newElementPayload: any;
            if (isTableSplit) {
                newElementPayload = { settings: tableSettings, sr: { content: tableContent || {} } };
            } else {
                newElementPayload = { settings: { ...originalSettings, content: remainingContent, footnotes: remainingFootnotes } };
            }

            const newRow: RowData = {
                id: newRowId,
                columns: [{ id: newColId, widthClass: 'col-span-12', elements: [{ id: newElementId, type: isTableSplit ? 'table' : 'text', payload: newElementPayload }] }]
            };

            const nextPageIndex = pageIndex + 1;
            if (nextPageIndex < updatedPages.length) {
                return updatedPages.map((page, idx) => idx === nextPageIndex ? { ...page, rows: [newRow, ...page.rows] } : page);
            } else {
                return [...updatedPages, { id: `page-${Math.random().toString(36).substr(2, 9)}`, rows: [newRow] }];
            }
        });

        if (remainingContent !== "TABLE_SPLIT") {
            setTimeout(() => {
                const newElNode = document.getElementById(`editor-${newElementId}`);
                if (newElNode) {
                    newElNode.focus();
                    const sel = window.getSelection();
                    const range = document.createRange();
                    range.selectNodeContents(newElNode);
                    range.collapse(true);
                    sel?.removeAllRanges();
                    sel?.addRange(range);
                }
            }, 50);
        }
    };

    const getGridCols = (layout: string): ColumnData[] => {
        const gen = () => Math.random().toString(36).substr(2, 9);
        const layouts: any = { '1/1': ['col-span-12'], '1:1': ['col-span-6', 'col-span-6'], '1:2': ['col-span-4', 'col-span-8'], '2:1': ['col-span-8', 'col-span-4'], '1:3': ['col-span-3', 'col-span-9'], '3:1': ['col-span-9', 'col-span-3'], '1:1:1': ['col-span-4', 'col-span-4', 'col-span-4'], '2:1:1': ['col-span-6', 'col-span-3', 'col-span-3'], '1:1:2': ['col-span-3', 'col-span-3', 'col-span-6'], '1:2:1': ['col-span-3', 'col-span-6', 'col-span-3'] };
        return (layouts[layout] || layouts['1/1']).map((cls: string) => ({ id: gen(), widthClass: cls, elements: [] }));
    };

    const handleAddElement = (pageId: string, rowId: string, colId: string, type: ElementType) => {
        const id = Math.random().toString(36).substr(2, 9);
        let payload: any = { settings: {} };
        if (type === 'text') payload.settings = { type: 'paragraph', alignment: 'left', content: '', color: '#1E293B', bold: false, footnotes: {} };
        else if (type === 'image') payload.settings = { url: '', altText: '', alignment: 'center' };
        else if (type === 'table') { payload.settings = { rows: 3, columns: 2, cells: { "0_0": { backgroundColor: "#f3f4f6", type: "headline" }, "0_1": { backgroundColor: "#f3f4f6", type: "headline" } } }; payload.sr = { content: { "0_0": "Prihodi", "0_1": "Rashodi" } }; }
        else if (type === 'chart') { payload.settings = { chartType: 'bar', subChartType: 'grouped_v', showLegend: true, showGrid: true, showLabels: false, showDataEditor: true, xAxisLabel: 'Месец' }; payload.data = [{ name: 'Јануар', 'Prihodi': 400, 'Rashodi': 240 }, { name: 'Фебруар', 'Prihodi': 300, 'Rashodi': 139 }, { name: 'Март', 'Prihodi': 200, 'Rashodi': 980 }]; payload.keys = ['Prihodi', 'Rashodi']; payload.colors = { 'Prihodi': '#8b98ff', 'Rashodi': '#34d399' }; }
        else if (type === 'map') { payload.settings = { showLegend: true, width: 100, baseColor: '#3b82f6' }; payload.keys = ['Вредност']; payload.data = SERBIAN_DISTRICTS.map(d => ({ name: d, 'Вредност': '' })); }

        setPages((prev: any[]) => prev.map(page => page.id === pageId ? { ...page, rows: page.rows.map((row: any) => row.id === rowId ? { ...row, columns: row.columns.map((col: any) => col.id === colId ? { ...col, elements: [...col.elements, { id, type, payload }] } : col) } : row) } : page));
        setActiveColMenu(null);
    };

    const handleDeleteElement = (pageId: string, _rowId: string, _colId: string, elId: string) => {
        setPages((prev: any[]) => prev.map(page => page.id === pageId ? { ...page, rows: page.rows.map((row: any) => ({ ...row, columns: row.columns.map((col: any) => ({ ...col, elements: col.elements.filter((el: any) => el.id !== elId) })) })) } : page));
        setSelectedElement(null);
    };
    const handleDeleteRow = (pageId: string, rowId: string) => { setPages((prev: any[]) => prev.map(page => page.id !== pageId ? page : { ...page, rows: page.rows.filter((row: any) => row.id !== rowId) })); };
    const handleDeletePage = (pageId: string) => { if (pages.length <= 1) return; setPages((prev: any[]) => prev.filter(page => page.id !== pageId)); setSelectedElement(null); };

    return (
        <div className="canvas-wrapper" onClick={() => { if (!readOnly) { setSelectedElement(null); setActiveRowMenu(null); setActiveColMenu(null); } }}>
            {pages?.map((page, index) => (
                <div key={page.id} data-page-index={index} style={{ position: 'relative' }}>
                    <PageItem
                        key={page.id}
                        page={page}
                        pageIndex={index}
                        totalPages={pages.length}
                        setPages={setPages}
                        selectedElement={selectedElement}
                        setSelectedElement={setSelectedElement}
                        updateElementSettings={updateElementSettings}
                        handleAutoSplit={handleAutoSplit}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onDropAtZone={onDropAtZone}
                        handleDeleteElement={handleDeleteElement}
                        handleDeleteRow={handleDeleteRow}
                        onDeletePage={handleDeletePage}
                        getGridCols={getGridCols}
                        handleAddElement={handleAddElement}
                        activeRowMenu={activeRowMenu}
                        setActiveRowMenu={setActiveRowMenu}
                        activeColMenu={activeColMenu}
                        setActiveColMenu={setActiveColMenu}
                        globalFootnoteMap={globalFootnoteMap}
                        elementLabelMap={elementLabelMap}
                        isGroupingMode={isGroupingMode}
                        groupSelection={groupSelection}
                        setGroupSelection={setGroupSelection}
                        documentTitle={documentTitle}
                        sectionTitle={sectionTitle}
                        isDragging={!!draggedItem}
                    />
                    {readOnly && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 200, background: 'rgba(255,255,255,0.45)', cursor: 'not-allowed', pointerEvents: 'all' }} />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', padding: '10px 0' }}>
                        <button onClick={(e) => { e.stopPropagation(); handleInsertPage(index + 1); }} style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '4px', border: '1px dashed #cbd5e1', cursor: 'pointer', background: 'white', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Plus size={12} /> Уметни страницу
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDuplicatePage(index); }} title="Дуплирај ову страницу" style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '4px', border: '1px dashed #93c5fd', cursor: 'pointer', background: 'white', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Copy size={12} /> Дуплирај
                        </button>
                    </div>
                </div>
            ))}
            <button onClick={(e) => { e.stopPropagation(); setPages((prev: any[]) => [...prev, { id: `page-${Date.now()}`, rows: [{ id: Math.random().toString(36).substr(2, 9), columns: [] }] }]); }} style={{ padding: '0.875rem 1.75rem', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '9999px', color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '2.5rem' }}>
                <Plus size={20} /> Нова страница
            </button>
        </div>
    );
};

export default Canvas;
