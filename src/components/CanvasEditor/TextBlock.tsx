import { useEffect, useRef, type FormEvent } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { extractFootnoteIds } from "./utils";

export const TextElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart, onAutoSplit, globalFootnoteMap }: any) => {
    const defaultSettings = el.payload.settings;
    const currentSettings = isSelected ? selectedElement.settings : defaultSettings;
    const editorRef = useRef<HTMLDivElement>(null);
    const contentAreaRef = useRef<HTMLElement | null>(null);

    const overflowTimeoutRef = useRef<any>(null);
    const isSplitting = useRef(false);
    const savedRangeRef = useRef<Range | null>(null);

    const saveSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (editorRef.current?.contains(range.commonAncestorContainer)) {
                savedRangeRef.current = range.cloneRange();
            }
        }
    };

    useEffect(() => {
        contentAreaRef.current = document.getElementById(`page-content-${pageId}`);
    }, [pageId]);

    useEffect(() => {
        if (editorRef.current && currentSettings.content !== undefined) {
            if (editorRef.current.innerHTML !== currentSettings.content) {
                editorRef.current.innerHTML = currentSettings.content;
            }
            if (overflowTimeoutRef.current) clearTimeout(overflowTimeoutRef.current);
            overflowTimeoutRef.current = setTimeout(() => {
                checkOverflow(currentSettings.content);
            }, 100);
        }
    }, [currentSettings.content]);

    useEffect(() => {
        const handleInsertFn = (e: any) => {
            if (e.detail?.elementId === el.id && isSelected) {
                if (editorRef.current) {
                    editorRef.current.focus();

                    const selection = window.getSelection();
                    if (savedRangeRef.current && selection) {
                        selection.removeAllRanges();
                        selection.addRange(savedRangeRef.current);
                        handleAddFootnote();
                    } else {
                        const range = document.createRange();
                        range.selectNodeContents(editorRef.current);
                        range.collapse(false);
                        selection?.removeAllRanges();
                        selection?.addRange(range);
                        handleAddFootnote();
                    }
                }
            }
        };
        window.addEventListener('insert-footnote', handleInsertFn);
        return () => window.removeEventListener('insert-footnote', handleInsertFn);
    }, [isSelected, el.id, currentSettings.footnotes]);

    useEffect(() => {
        if (!editorRef.current) return;
        const sups = editorRef.current.querySelectorAll('sup[data-footnote-id]');
        sups.forEach(sup => {
            const id = sup.getAttribute('data-footnote-id');
            if (id && globalFootnoteMap[id]) {
                const numStr = `[${globalFootnoteMap[id]}]`;
                if (sup.innerHTML !== numStr) {
                    sup.innerHTML = numStr;
                }
            }
        });
    }, [currentSettings.content, globalFootnoteMap]);

    const checkOverflow = (htmlToCheck: string) => {
        if (isSplitting.current) return;
        const contentArea = contentAreaRef.current;
        if (!contentArea || !editorRef.current) return;

        const areaRect = contentArea.getBoundingClientRect();

        if (editorRef.current.getBoundingClientRect().bottom > areaRect.bottom + 5) {
            isSplitting.current = true;

            let words = htmlToCheck.split(/(<[^>]*>|\s+)/).filter(Boolean);

            let low = 0;
            let high = words.length;
            let bestFitIndex = 0;

            while (low <= high) {
                let mid = Math.floor((low + high) / 2);
                editorRef.current.innerHTML = words.slice(0, mid).join('');

                if (editorRef.current.getBoundingClientRect().bottom > areaRect.bottom) {
                    high = mid - 1;
                } else {
                    bestFitIndex = mid;
                    low = mid + 1;
                }
            }

            editorRef.current.innerHTML = words.slice(0, bestFitIndex).join('');

            while (editorRef.current.getBoundingClientRect().bottom > areaRect.bottom && bestFitIndex > 0) {
                bestFitIndex--;
                editorRef.current.innerHTML = words.slice(0, bestFitIndex).join('');
            }

            const safeHtml = words.slice(0, bestFitIndex).join('');
            const remainingText = words.slice(bestFitIndex).join('');

            if (remainingText.trim() !== '') {
                const oldFootnotes = currentSettings.footnotes || {};

                const safeIds = extractFootnoteIds(safeHtml);
                const remIds = extractFootnoteIds(remainingText);

                const safeFns: any = {};
                const remFns: any = {};

                safeIds.forEach(id => safeFns[id] = oldFootnotes[id] || '');
                remIds.forEach(id => remFns[id] = oldFootnotes[id] || '');

                onAutoSplit({
                    sourcePageId: pageId,
                    elementId: el.id,
                    remainingContent: remainingText,
                    safeHtml: safeHtml,
                    safeFootnotes: safeFns,
                    remainingFootnotes: remFns
                });
            }

            setTimeout(() => { isSplitting.current = false; }, 150);
        }
    };

    const handleAddFootnote = () => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
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

        range.deleteContents();
        range.insertNode(sup);

        range.setStartAfter(sup);
        range.setEndAfter(sup);
        selection.removeAllRanges();
        selection.addRange(range);

        if (editorRef.current) {
            const newHtml = editorRef.current.innerHTML;
            const currentIds = extractFootnoteIds(newHtml);
            const oldFootnotes = currentSettings.footnotes || {};
            const newFootnotes: any = {};
            currentIds.forEach(cid => { newFootnotes[cid] = oldFootnotes[cid] || ''; });
            newFootnotes[id] = 'Унесите текст фусноте...';

            updateElementSettings({ content: newHtml, footnotes: newFootnotes });
            editorRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    const handleInput = (e: FormEvent<HTMLDivElement>) => {
        const html = e.currentTarget.innerHTML;
        const currentIds = extractFootnoteIds(html);
        const oldFootnotes = currentSettings.footnotes || {};
        const newFootnotes: any = {};

        currentIds.forEach(id => {
            newFootnotes[id] = oldFootnotes[id] !== undefined ? oldFootnotes[id] : '';
        });

        if (isSelected) {
            updateElementSettings({ content: html, footnotes: newFootnotes });
        }

        if (overflowTimeoutRef.current) clearTimeout(overflowTimeoutRef.current);
        overflowTimeoutRef.current = setTimeout(() => {
            checkOverflow(html);
        }, 50);
    };

    return (
        <div
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)}
            onClick={(e) => {
                e.stopPropagation();
                setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'text', settings: { ...currentSettings, content: editorRef.current?.innerHTML || currentSettings.content } });
            }}
            className={`element-block cursor-text ${isSelected ? 'is-selected' : ''}`}
            style={{
                marginTop: `${currentSettings.marginTop || 0}px`,
                marginBottom: `${currentSettings.marginBottom || 0}px`,
                backgroundColor: currentSettings.backgroundColor || 'transparent',
                padding: currentSettings.backgroundColor ? '16px' : '0px',
                borderRadius: currentSettings.backgroundColor ? '8px' : '0px'
            }}
        >
            {isSelected && (
                <div className="element-actions">
                    <div className="action-btn grab"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="action-btn danger"><Trash2 size={14} /></button>
                </div>
            )}

            <div
                id={`editor-${el.id}`}
                ref={editorRef} contentEditable suppressContentEditableWarning data-placeholder="Унесите текст..."
                onInput={handleInput}
                onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain');
                    document.execCommand('insertText', false, text);
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        document.execCommand('insertText', false, '    ');
                    }
                }}
                onBlur={saveSelection}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                className="editor-content"
                style={{ color: currentSettings.color, textAlign: currentSettings.alignment }}
            />
        </div>
    );
};
