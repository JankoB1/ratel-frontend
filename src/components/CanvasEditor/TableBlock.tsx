import { useState, useEffect, useRef } from "react";
import { AlignLeft, AlignCenter, AlignRight, GripVertical, Trash2 } from "lucide-react";
import { extractFootnoteIds } from "./utils";

const ElementLabel = ({ label, title }: { label: string; title?: string }) => {
    if (!label) return null;
    return (
        <div style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#1e293b',
            marginBottom: '8px',
            textAlign: 'left',
            borderLeft: '3px solid #3b82f6',
            paddingLeft: '8px',
            width: '100%',
            wordBreak: 'break-word'
        }}>
            {label}{title ? `: ${title}` : ''}
        </div>
    );
};

const EditableCell = ({ value, onBlur, style, isActive, onClick, cellSt, colSpan, rowSpan, elId, globalFootnoteMap }: any) => {
    const cellRef = useRef<HTMLDivElement>(null);
    const savedRangeRef = useRef<Range | null>(null);

    const saveSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (cellRef.current?.contains(range.commonAncestorContainer)) {
                savedRangeRef.current = range.cloneRange();
            }
        }
    };

    useEffect(() => {
        const handleInsertFn = (e: any) => {
            if (e.detail?.elementId === elId && isActive) {
                if (cellRef.current) {
                    cellRef.current.focus();

                    const selection = window.getSelection();
                    if (savedRangeRef.current && selection) {
                        selection.removeAllRanges();
                        selection.addRange(savedRangeRef.current);
                    } else {
                        const range = document.createRange();
                        range.selectNodeContents(cellRef.current);
                        range.collapse(false);
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                    }

                    const id = `fn-${Math.random().toString(36).substr(2, 9)}`;
                    const sup = document.createElement('sup');
                    sup.setAttribute('data-footnote-id', id);
                    sup.setAttribute('contenteditable', 'false');
                    sup.style.color = '#3b82f6';
                    sup.style.cursor = 'pointer';
                    sup.style.fontWeight = 'bold';
                    sup.style.padding = '0 1px';
                    sup.style.userSelect = 'none';
                    sup.style.display = 'inline';
                    sup.innerHTML = '[*]';

                    const range2 = window.getSelection()?.getRangeAt(0);
                    if (range2) {
                        range2.deleteContents();
                        range2.insertNode(sup);
                        range2.setStartAfter(sup);
                        range2.setEndAfter(sup);
                        const sel = window.getSelection();
                        sel?.removeAllRanges();
                        sel?.addRange(range2);
                    }

                    const newHtml = cellRef.current.innerHTML;
                    onBlur(newHtml, id);
                }
            }
        };
        window.addEventListener('insert-footnote', handleInsertFn);
        return () => window.removeEventListener('insert-footnote', handleInsertFn);
    }, [isActive, elId, onBlur]);

    useEffect(() => {
        if (cellRef.current && value !== cellRef.current.innerHTML) {
            cellRef.current.innerHTML = value || '';
        }
    }, [value]);

    useEffect(() => {
        if (!cellRef.current) return;
        const sups = cellRef.current.querySelectorAll('sup[data-footnote-id]');
        sups.forEach(sup => {
            const id = sup.getAttribute('data-footnote-id');
            if (id && globalFootnoteMap && globalFootnoteMap[id]) {
                const numStr = `[${globalFootnoteMap[id]}]`;
                if (sup.innerHTML !== numStr) {
                    sup.innerHTML = numStr;
                }
            }
        });
    }, [value, globalFootnoteMap]);

    return (
        <td
            onClick={onClick}
            style={{ ...style, border: '1px solid #e2e8f0', padding: '0.5rem', transition: 'all 0.2s', position: 'relative', boxShadow: isActive ? 'inset 0 0 0 2px #60a5fa' : 'none', backgroundColor: isActive ? 'rgba(239, 246, 255, 0.3)' : style.backgroundColor }}
            colSpan={colSpan}
            rowSpan={rowSpan}
        >
            <div
                ref={cellRef}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => onBlur(e.currentTarget.innerHTML)}
                onBlur={saveSelection}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                className="outline-none text-sm break-words"
                style={{ fontWeight: cellSt.type === 'headline' ? 'bold' : 'normal', fontSize: cellSt.type === 'headline' ? '15px' : '14px', outline: 'none', wordBreak: 'break-word', display: 'inline-block', minHeight: '24px', width: '100%' }}
            />
        </td>
    );
};

export const TableElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart, onAutoSplit, globalFootnoteMap, elementLabel }: any) => {
    const defaultSettings = el.payload.settings;
    const currentSettings = isSelected ? selectedElement.settings : defaultSettings;
    const content = el.payload.sr?.content || {};

    const tableContainerRef = useRef<HTMLDivElement>(null);
    const contentAreaRef = useRef<HTMLElement | null>(null);
    const isSplitting = useRef(false);

    const colsCount = currentSettings.columns || 1;
    const defaultWidths = Array(colsCount).fill(100 / colsCount);
    const [localWidths, setLocalWidths] = useState<number[]>(currentSettings.columnWidths || defaultWidths);
    const startDragRef = useRef<{ startX: number, startWidths: number[], index: number } | null>(null);

    useEffect(() => {
        if (currentSettings.columnWidths && currentSettings.columnWidths.length === colsCount) {
            setLocalWidths(currentSettings.columnWidths);
        } else {
            setLocalWidths(Array(colsCount).fill(100 / colsCount));
        }
    }, [currentSettings.columnWidths, colsCount]);

    const onResizeMouseDown = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        startDragRef.current = {
            startX: e.clientX,
            startWidths: [...localWidths],
            index
        };
        document.addEventListener('mousemove', onResizeMouseMove);
        document.addEventListener('mouseup', onResizeMouseUp);
    };

    const onResizeMouseMove = (e: MouseEvent) => {
        if (!startDragRef.current || !tableContainerRef.current) return;
        const { startX, startWidths, index } = startDragRef.current;
        const tableWidth = tableContainerRef.current.offsetWidth;
        const deltaX = e.clientX - startX;
        const deltaPct = (deltaX / tableWidth) * 100;

        const newWidths = [...startWidths];
        const maxDelta = startWidths[index] - 5;
        const minDelta = -(startWidths[index + 1] - 5);
        const clampedDelta = Math.max(minDelta, Math.min(maxDelta, deltaPct));

        newWidths[index] = startWidths[index] + clampedDelta;
        newWidths[index + 1] = startWidths[index + 1] - clampedDelta;

        setLocalWidths(newWidths);
    };

    const onResizeMouseUp = () => {
        if (startDragRef.current) {
            setLocalWidths((currentLocal) => {
                updateElementSettings({ ...currentSettings, columnWidths: currentLocal });
                return currentLocal;
            });
        }
        startDragRef.current = null;
        document.removeEventListener('mousemove', onResizeMouseMove);
        document.removeEventListener('mouseup', onResizeMouseUp);
    };

    const updateCellSetting = (prop: string, value: string) => {
        if (!selectedElement?.activeCell) return;
        const key = selectedElement.activeCell;
        const currentCells = currentSettings.cells || {};
        const cellSt = currentCells[key] || {};

        const newSettings = {
            ...currentSettings,
            cells: {
                ...currentCells,
                [key]: { ...cellSt, [prop]: value }
            }
        };
        updateElementSettings(newSettings);
    };

    useEffect(() => {
        contentAreaRef.current = document.getElementById(`page-content-${pageId}`);
    }, [pageId]);

    const checkTableOverflow = () => {
        if (isSplitting.current) return;
        const contentArea = contentAreaRef.current;
        const tableContainer = tableContainerRef.current;
        if (!contentArea || !tableContainer) return;

        const areaRect = contentArea.getBoundingClientRect();
        const tableRect = tableContainer.getBoundingClientRect();

        if (tableRect.bottom > areaRect.bottom + 5) {
            const trs = tableContainer.querySelectorAll('tbody tr');
            let splitIndex = -1;
            for (let i = 0; i < trs.length; i++) {
                const trRect = trs[i].getBoundingClientRect();
                if (trRect.bottom > areaRect.bottom) {
                    splitIndex = i;
                    break;
                }
            }
            if (splitIndex === 0) splitIndex = 1;
            if (splitIndex > 0 && splitIndex < (currentSettings.rows || 1)) {
                isSplitting.current = true;
                const rowsToKeep = splitIndex;
                const rowsToMove = currentSettings.rows - rowsToKeep;
                const keepContent: any = {};
                const keepCells: any = {};
                const moveContent: any = {};
                const moveCells: any = {};
                const cols = currentSettings.columns || 1;

                for (let r = 0; r < currentSettings.rows; r++) {
                    for (let c = 0; c < cols; c++) {
                        const oldKey = `${r}_${c}`;
                        if (r < rowsToKeep) {
                            if (content[oldKey] !== undefined) keepContent[oldKey] = content[oldKey];
                            if (currentSettings.cells?.[oldKey]) keepCells[oldKey] = currentSettings.cells[oldKey];
                        } else {
                            const newR = r - rowsToKeep;
                            const newKey = `${newR}_${c}`;
                            if (content[oldKey] !== undefined) moveContent[newKey] = content[oldKey];
                            if (currentSettings.cells?.[oldKey]) moveCells[newKey] = currentSettings.cells[oldKey];
                        }
                    }
                }
                onAutoSplit({
                    sourcePageId: pageId,
                    elementId: el.id,
                    remainingContent: "TABLE_SPLIT",
                    tableSettings: { ...currentSettings, rows: rowsToMove, cells: moveCells },
                    tableContent: moveContent,
                    originalTableSettings: { ...currentSettings, rows: rowsToKeep, cells: keepCells },
                    originalTableContent: keepContent
                });
                setTimeout(() => { isSplitting.current = false; }, 300);
            }
        }
    };

    useEffect(() => {
        const timer = setTimeout(checkTableOverflow, 200);
        return () => clearTimeout(timer);
    }, [currentSettings.rows, currentSettings.columns, content]);

    const handleCellChange = (rIdx: number, cIdx: number, html: string, newFnId?: string) => {
        const cellKey = `${rIdx}_${cIdx}`;
        const newContent = { ...content, [cellKey]: html };

        let newSettings = { ...currentSettings };
        if (newFnId) {
            newSettings.footnotes = { ...(newSettings.footnotes || {}), [newFnId]: 'Унесите текст фусноте...' };
        }

        const allHtml = Object.values(newContent).join(' ');
        const currentIds = extractFootnoteIds(allHtml);
        const finalFootnotes: any = {};
        const oldFootnotes = newSettings.footnotes || {};
        currentIds.forEach(id => {
            finalFootnotes[id] = oldFootnotes[id] !== undefined ? oldFootnotes[id] : '';
        });

        newSettings.footnotes = finalFootnotes;

        updateElementSettings(newSettings, { sr: { content: newContent } });
    };

    return (
        <div
            ref={tableContainerRef}
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)}
            className={`element-block break-inside-avoid ${isSelected ? 'is-selected' : ''}`}
            onClick={(e) => { e.stopPropagation(); setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'table', subType: 'table', settings: currentSettings }); }}
            style={{ marginTop: `${currentSettings.marginTop || 0}px`, marginBottom: `${currentSettings.marginBottom || 0}px` }}
        >
            {isSelected && (
                <div className="element-actions">
                    <div className="action-btn grab"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="action-btn danger"><Trash2 size={14} /></button>
                </div>
            )}

            {isSelected && selectedElement?.activeCell && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white border border-slate-200 rounded-lg shadow-xl p-1 flex gap-1 z-[70] items-center" style={{ width: 'max-content' }}>
                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('alignment', 'left'); }} className={`p-1.5 rounded hover:bg-slate-100 ${currentSettings.cells?.[selectedElement.activeCell]?.alignment === 'left' || !currentSettings.cells?.[selectedElement.activeCell]?.alignment ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Poravnaj levo"><AlignLeft size={16}/></button>
                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('alignment', 'center'); }} className={`p-1.5 rounded hover:bg-slate-100 ${currentSettings.cells?.[selectedElement.activeCell]?.alignment === 'center' ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Centriraj horizontalno"><AlignCenter size={16}/></button>
                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('alignment', 'right'); }} className={`p-1.5 rounded hover:bg-slate-100 ${currentSettings.cells?.[selectedElement.activeCell]?.alignment === 'right' ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Poravnaj desno"><AlignRight size={16}/></button>

                    <div className="w-px h-5 bg-slate-200 mx-1" />

                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('verticalAlignment', 'top'); }} className={`p-1.5 px-2 rounded hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider ${currentSettings.cells?.[selectedElement.activeCell]?.verticalAlignment === 'top' || !currentSettings.cells?.[selectedElement.activeCell]?.verticalAlignment ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Poravnaj gore">Gore</button>
                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('verticalAlignment', 'middle'); }} className={`p-1.5 px-2 rounded hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider ${currentSettings.cells?.[selectedElement.activeCell]?.verticalAlignment === 'middle' ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Centriraj vertikalno">Sredina</button>
                    <button onClick={(e) => { e.stopPropagation(); updateCellSetting('verticalAlignment', 'bottom'); }} className={`p-1.5 px-2 rounded hover:bg-slate-100 text-[10px] font-bold uppercase tracking-wider ${currentSettings.cells?.[selectedElement.activeCell]?.verticalAlignment === 'bottom' ? 'bg-blue-50 text-blue-500' : 'text-slate-600'}`} title="Poravnaj dole">Dole</button>
                </div>
            )}

            <ElementLabel label={elementLabel} title={currentSettings.title} />

            <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', borderRadius: '0', position: 'relative' }}>
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', border: '1px solid #cbd5e1', background: 'white', borderRadius: '0', position: 'relative', zIndex: 0 }}>
                    <colgroup>
                        {localWidths.map((w, i) => (
                            <col key={i} style={{ width: `${w}%` }} />
                        ))}
                    </colgroup>
                    <tbody>
                    {Array.from({ length: currentSettings.rows || 1 }).map((_, rIdx) => (
                        <tr key={`row-${rIdx}`}>
                            {Array.from({ length: currentSettings.columns || 1 }).map((_, cIdx) => {
                                const key = `${rIdx}_${cIdx}`;
                                const cellSt = currentSettings.cells?.[key] || {};
                                if (cellSt.hidden) return null;
                                return (
                                    <EditableCell
                                        key={`cell-${key}`}
                                        elId={el.id}
                                        value={content[key] || ''}
                                        cellSt={cellSt}
                                        isActive={selectedElement?.activeCell === key}
                                        globalFootnoteMap={globalFootnoteMap}
                                        style={{
                                            backgroundColor: cellSt.backgroundColor || '#ffffff',
                                            textAlign: cellSt.alignment || 'left',
                                            verticalAlign: cellSt.verticalAlignment || 'top',
                                            color: cellSt.textColor || '#1E293B'
                                        }}
                                        colSpan={cellSt.colSpan || 1}
                                        rowSpan={cellSt.rowSpan || 1}
                                        onClick={(e: any) => { e.stopPropagation(); setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'table', subType: 'cell', activeCell: key, settings: currentSettings }); }}
                                        onBlur={(html: string, fnId?: string) => handleCellChange(rIdx, cIdx, html, fnId)}
                                    />
                                );
                            })}
                        </tr>
                    ))}
                    </tbody>
                </table>

                {isSelected && localWidths.map((_w, i) => {
                    if (i === localWidths.length - 1) return null;
                    const leftPct = localWidths.slice(0, i + 1).reduce((a, b) => a + b, 0);
                    return (
                        <div
                            key={`resizer-${i}`}
                            onMouseDown={(e) => onResizeMouseDown(e, i)}
                            style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                left: `calc(${leftPct}% - 3px)`,
                                width: '6px',
                                cursor: 'col-resize',
                                zIndex: 20,
                                backgroundColor: startDragRef.current?.index === i ? '#3b82f6' : 'transparent',
                            }}
                            className="hover:bg-blue-400 transition-colors"
                            title="Povuci za promenu širine"
                        />
                    );
                })}
            </div>

            {currentSettings.description && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', textAlign: 'left', width: '100%', fontStyle: 'italic' }}>
                    {currentSettings.description}
                </div>
            )}
        </div>
    );
};
