import { useState, useEffect, useRef, useMemo } from "react";
import {
    Plus, Settings2, Trash2, X, LayoutTemplate, Type,
    Image as ImageIcon, Table2, BarChart3, Map as MapIcon, Check
} from "lucide-react";
import addIcon from "../../assets/apps-add.svg";
import type { ElementType, ColumnData } from "./types";
import { extractFootnoteIds } from "./utils";
import { TextElementBlock } from "./TextBlock";
import { ImageElementBlock } from "./ImageBlock";
import { TableElementBlock } from "./TableBlock";
import { ChartElementBlock } from "./ChartBlock";
import { MapElementBlock } from "./MapBlock";

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

const LayoutSelector = ({ onSelect, position = "bottom" }: any) => {
    return (
        <div
            onClick={(e) => e.stopPropagation()}
            className={`popover-menu ${position}`}
        >
            <button onClick={() => onSelect('1/1')} className="menu-btn blue">
                <LayoutTemplate size={18} /><span>Пуна ширина</span>
            </button>
            <div className="divider"></div>
            <div className="menu-title">Две колоне</div>
            <div className="layout-grid">
                {['1:1', '1:2', '2:1', '1:3', '3:1'].map(l => (
                    <button key={l} onClick={() => onSelect(l)} className="layout-btn">{l}</button>
                ))}
            </div>
            <div className="divider"></div>
            <div className="menu-title">Три колоне</div>
            <div className="layout-grid">
                {['1:1:1', '2:1:1', '1:1:2', '1:2:1'].map(l => (
                    <button key={l} onClick={() => onSelect(l)} className="layout-btn">{l}</button>
                ))}
            </div>
        </div>
    );
};

const ElementSelector = ({ onSelect }: any) => (
    <div
        onClick={(e) => e.stopPropagation()}
        className="popover-menu bottom" style={{ width: '12rem' }}
    >
        <button onClick={() => onSelect('text')} className="menu-btn"><Type size={18} color="#3b82f6" /> ТЕКСТ</button>
        <button onClick={() => onSelect('image')} className="menu-btn"><ImageIcon size={18} color="#22c55e" /> СЛИКА</button>
        <button onClick={() => onSelect('table')} className="menu-btn"><Table2 size={18} color="#f97316" /> ТАБЕЛА</button>
        <div className="divider" style={{ margin: '0.25rem 0' }}></div>
        <button onClick={() => onSelect('chart')} className="menu-btn"><BarChart3 size={18} color="#a855f7" /> ГРАФИКОН</button>
        <button onClick={() => onSelect('map')} className="menu-btn"><MapIcon size={18} color="#14b8a6" /> МАПА</button>
    </div>
);

export const PageItem = ({ page, pageIndex, totalPages, onDeletePage, setPages, selectedElement, setSelectedElement, updateElementSettings, handleAutoSplit, onDragStart, onDrop, handleDeleteElement, handleDeleteRow, getGridCols, handleAddElement, activeRowMenu, setActiveRowMenu, activeColMenu, setActiveColMenu, globalFootnoteMap, elementLabelMap, isGroupingMode, groupSelection, setGroupSelection }: any) => {
    const [showAddBtn, setShowAddBtn] = useState(true);
    const innerContentRef = useRef<HTMLDivElement>(null);

    const pageFootnotes = useMemo(() => {
        const fns: any[] = [];
        page.rows.forEach((row: any) => {
            row.columns.forEach((col: any) => {
                col.elements.forEach((el: any) => {
                    if (el.type === 'text' && el.payload.settings.content) {
                        const content = el.payload.settings.content;
                        const footnotesDict = el.payload.settings.footnotes || {};
                        const ids = extractFootnoteIds(content);
                        ids.forEach(id => { fns.push({ id, number: globalFootnoteMap[id], text: footnotesDict[id] || '' }); });
                    } else if (el.type === 'table') {
                        const contentObj = el.payload.sr?.content || {};
                        const footnotesDict = el.payload.settings.footnotes || {};
                        const sortedKeys = Object.keys(contentObj).sort((a, b) => {
                            const [rA, cA] = a.split('_').map(Number);
                            const [rB, cB] = b.split('_').map(Number);
                            return rA !== rB ? rA - rB : cA - cB;
                        });
                        sortedKeys.forEach(key => {
                            const html = contentObj[key];
                            if (typeof html === 'string') {
                                const ids = extractFootnoteIds(html);
                                ids.forEach(id => { fns.push({ id, number: globalFootnoteMap[id], text: footnotesDict[id] || '' }); });
                            }
                        });
                    }
                });
            });
        });
        return fns.sort((a, b) => (a.number || 0) - (b.number || 0));
    }, [page, globalFootnoteMap]);

    useEffect(() => {
        if (!innerContentRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (let entry of entries) {
                if (entry.contentRect.height > 800) setShowAddBtn(false);
                else setShowAddBtn(true);
            }
        });
        observer.observe(innerContentRef.current);
        return () => observer.disconnect();
    }, [page.rows]);

    const lastRowEmpty = page.rows.length > 0 && page.rows[page.rows.length - 1].columns.length === 0;

    return (
        <div className="canvas-page">
            {totalPages > 1 && (
                <button onClick={() => onDeletePage(page.id)} className="page-delete-btn" title="Obriši stranicu"><X size={20} /></button>
            )}
            <div className="page-header"><div className="page-header-inner">Annual Report 2026</div></div>
            <div id={`page-content-${page.id}`} className="page-content">
                <div ref={innerContentRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', flexShrink: 0, position: 'relative', zIndex: 20 }}>
                    {page.rows.map((row: any) => {
                        const isRowActive = (activeRowMenu?.pageId === page.id && activeRowMenu?.rowId === row.id) || (activeColMenu?.pageId === page.id && row.columns.some((c: any) => c.id === activeColMenu.colId)) || (selectedElement?.pageId === page.id && selectedElement?.rowId === row.id);
                        return (
                            <div key={row.id} className={`canvas-row break-inside-avoid ${isRowActive ? 'is-active' : ''}`}>
                                {row.columns.length > 0 && (
                                    <div className="row-actions-menu">
                                        <button onClick={(e) => { e.stopPropagation(); setActiveRowMenu(activeRowMenu?.rowId === row.id ? null : { pageId: page.id, rowId: row.id }); }} className="action-btn"><Settings2 size={16} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRow(page.id, row.id); }} className="action-btn danger"><Trash2 size={16} /></button>
                                        {activeRowMenu?.rowId === row.id && <LayoutSelector onSelect={(l: string) => { const newCols = getGridCols(l); setPages((prev: any) => prev.map((p: any) => p.id === page.id ? { ...p, rows: p.rows.map((r: any) => r.id === row.id ? { ...r, columns: newCols.map((nc: ColumnData, i: number) => ({ ...nc, elements: r.columns[i]?.elements || [] })) } : r) } : p)); setActiveRowMenu(null); }} position="right" />}
                                    </div>
                                )}
                                {row.columns.length === 0 ? (
                                    <div className="empty-row-container">
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRow(page.id, row.id); }} className="empty-row-delete" title="Обриши празан ред"><Trash2 size={16} /></button>
                                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <button onClick={(e) => { e.stopPropagation(); setActiveRowMenu({ pageId: page.id, rowId: row.id }); }} className="add-icon-btn"><img src={addIcon} alt="Add" style={{ width: '48px', height: '48px' }} /></button>
                                            {activeRowMenu?.rowId === row.id && (
                                                <LayoutSelector
                                                    onSelect={(l: string) => {
                                                        setPages((prev: any) => prev.map((p: any) => {
                                                            if (p.id !== page.id) return p;
                                                            return {
                                                                ...p,
                                                                rows: p.rows.map((r: any) => r.id === row.id ? { ...r, columns: getGridCols(l) } : r)
                                                            };
                                                        }));
                                                        setActiveRowMenu(null);
                                                    }}
                                                    position="bottom"
                                                />
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-12 gap-0" style={{ position: 'relative', zIndex: 0 }}>
                                        {row.columns.map((col: any) => {
                                            const isColActive = (activeColMenu?.pageId === page.id && activeColMenu?.colId === col.id) || (selectedElement?.pageId === page.id && selectedElement?.colId === col.id);
                                            return (
                                                <div key={col.id} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(page.id, row.id, col.id)} className={`canvas-col ${col.widthClass} ${isColActive ? 'is-active' : ''}`}>
                                                    {col.elements.map((el: any) => {
                                                        const isSelectedForGroup = groupSelection?.includes(el.id);

                                                        return (
                                                            <div
                                                                key={el.id}
                                                                data-element-id={el.id}
                                                                style={{ position: 'relative' }}
                                                                onClickCapture={(e) => {
                                                                    if (isGroupingMode) {
                                                                        e.stopPropagation();
                                                                        e.preventDefault();
                                                                        setGroupSelection((prev: string[]) =>
                                                                            prev.includes(el.id) ? prev.filter(id => id !== el.id) : [...prev, el.id]
                                                                        );
                                                                    }
                                                                }}
                                                            >
                                                                {isGroupingMode && (
                                                                    <div style={{
                                                                        position: 'absolute', inset: 0, zIndex: 50,
                                                                        backgroundColor: isSelectedForGroup ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.5)',
                                                                        border: isSelectedForGroup ? '3px solid #3b82f6' : '1px dashed #cbd5e1',
                                                                        borderRadius: '8px', cursor: 'pointer',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                        backdropFilter: isSelectedForGroup ? 'none' : 'grayscale(50%) blur(1px)'
                                                                    }}>
                                                                        {isSelectedForGroup && (
                                                                            <div style={{ backgroundColor: '#3b82f6', color: 'white', borderRadius: '50%', padding: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                                                                <Check size={32} strokeWidth={3} />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {el.type === 'text' && <TextElementBlock el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} onAutoSplit={handleAutoSplit} globalFootnoteMap={globalFootnoteMap} />}
                                                                {el.type === 'image' && <ImageElementBlock el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} elementLabel={elementLabelMap[el.id]} />}
                                                                {el.type === 'table' && <TableElementBlock el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} onAutoSplit={handleAutoSplit} globalFootnoteMap={globalFootnoteMap} elementLabel={elementLabelMap[el.id]} />}
                                                                {el.type === 'chart' && <ChartElementBlock el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} elementLabel={elementLabelMap[el.id]} />}
                                                                {el.type === 'map' && <MapElementBlock el={el} pageId={page.id} rowId={row.id} colId={col.id} isSelected={selectedElement?.elementId === el.id} selectedElement={selectedElement} setSelectedElement={setSelectedElement} updateElementSettings={updateElementSettings} onDelete={handleDeleteElement} onDragStart={onDragStart} />}
                                                            </div>
                                                        );
                                                    })}
                                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
                                                        <button onClick={(e) => { e.stopPropagation(); setActiveColMenu({ pageId: page.id, colId: col.id }); }} className="col-add-btn"><Plus size={14} /></button>
                                                        {activeColMenu?.colId === col.id && <ElementSelector onSelect={(t: ElementType) => handleAddElement(page.id, row.id, col.id, t)} />}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                {showAddBtn && !lastRowEmpty && (
                    <div style={{ width: '100%', paddingTop: '1rem', paddingBottom: '2rem', flexShrink: 0, position: 'relative', zIndex: 10 }}>
                        <button onClick={() => setPages((prev: any) => prev.map((p: any) => p.id === page.id ? { ...p, rows: [...p.rows, { id: Math.random().toString(36).substr(2, 9), columns: [] }] } : p))} className="add-row-btn-main"><Plus size={18} /> Додај нови ред</button>
                    </div>
                )}
            </div>
            <div className="page-footnotes">
                {pageFootnotes.length > 0 && (
                    <div className="footnotes-container" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pageFootnotes.map((fn) => (
                            <div key={fn.id} className="footnote-item" style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <span style={{ fontWeight: 700, flexShrink: 0, minWidth: '15px' }}>{fn.number}.</span>
                                <span style={{ wordBreak: 'break-word', flex: 1 }} dangerouslySetInnerHTML={{ __html: fn.text || '...' }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className="page-footer"><div className="page-footer-inner">{pageIndex + 1}.</div></div>
        </div>
    );
};
