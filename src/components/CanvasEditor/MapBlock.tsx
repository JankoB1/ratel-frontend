import { GripVertical, Trash2 } from "lucide-react";
import { hexToRgba } from "./utils";
import MapGraphic from "../MapGraphic";

export const MapElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, onDelete, onDragStart, onDragEnd, elementLabel }: any) => {
    const defaultSettings = el.payload.settings || {};
    const currentSettings = isSelected && selectedElement?.elementId === el.id ? selectedElement.settings : defaultSettings;

    const data = el.payload.data || currentSettings.data || [];
    const baseColor = currentSettings.baseColor || '#3b82f6';
    const width = currentSettings.width || 100;

    const values = data.map((d: any) => parseFloat(d['Vrednost'])).filter((v: number) => !isNaN(v));
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;

    // Veći kontrast: niža donja granica + gama (>1) gura „manje aktivne" boje svetlije, pa
    // glavna (najjača) boja mnogo više iskače. Ista funkcija se koristi za mapu i za legendu.
    const opacityFor = (t: number) => 0.15 + 0.85 * Math.pow(Math.max(0, Math.min(1, t)), 1.8);

    const calculatedColors: any = {};
    const calculatedValues: any = {};

    data.forEach((d: any) => {
        const val = parseFloat(d['Vrednost']);
        calculatedValues[d.name] = d['Vrednost'];

        if (isNaN(val) || d['Vrednost'] === '' || d['Vrednost'] === undefined) {
            calculatedColors[d.name] = '#f1f5f9';
        } else {
            const opacity = max > min ? opacityFor((val - min) / (max - min)) : 1;
            calculatedColors[d.name] = hexToRgba(baseColor, opacity);
        }
    });

    const formatVal = (val: number) => {
        return new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 1 }).format(val);
    };

    const legendItems = [];
    if (values.length > 0) {
        if (max === min) {
            legendItems.push({ color: hexToRgba(baseColor, 1), label: `${formatVal(min)}` });
        } else {
            const step = (max - min) / 3;
            legendItems.push({
                color: hexToRgba(baseColor, opacityFor(1 / 6)),
                label: `${formatVal(min)} - ${formatVal(min + step)}`
            });
            legendItems.push({
                color: hexToRgba(baseColor, opacityFor(1 / 2)),
                label: `${formatVal(min + step)} - ${formatVal(min + 2 * step)}`
            });
            legendItems.push({
                color: hexToRgba(baseColor, opacityFor(5 / 6)),
                label: `${formatVal(min + 2 * step)} - ${formatVal(max)}`
            });
        }
    }

    legendItems.push({
        color: '#f1f5f9',
        label: 'Nema podataka',
        isNoData: true
    });

    return (
        <div
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)} onDragEnd={onDragEnd}
            onClick={(e) => {
                e.stopPropagation();
                setSelectedElement({
                    pageId,
                    rowId,
                    colId,
                    elementId: el.id,
                    type: 'map',
                    settings: currentSettings,
                    extraPayload: { data: el.payload.data }
                });
            }}
            className={`element-block element-block-map break-inside-avoid ${isSelected ? 'is-selected' : ''}`}
            style={{ marginTop: `${currentSettings.marginTop || 0}px`, marginBottom: `${currentSettings.marginBottom || 0}px` }}
        >
            {isSelected && (
                <div className="element-actions">
                    <div className="action-btn grab"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="action-btn danger"><Trash2 size={14} /></button>
                </div>
            )}

            {elementLabel && (
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '8px', textAlign: 'left', borderLeft: '3px solid #3b82f6', paddingLeft: '8px', width: '100%', wordBreak: 'break-word' }}>
                    {elementLabel}{currentSettings.title ? `: ${currentSettings.title}` : ''}
                </div>
            )}

            <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{
                    width: `${width}%`,
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    transition: 'width 0.2s',
                    pointerEvents: 'auto'
                }}>
                    <MapGraphic colors={calculatedColors} values={calculatedValues} />
                </div>

                {currentSettings.showLegend && (
                    <div style={{
                        position: 'absolute',
                        bottom: '16px',
                        left: '16px',
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: '16px',
                        background: 'rgba(255,255,255,0.95)',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                        zIndex: 10
                    }}>
                        {legendItems.map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    backgroundColor: item.isNoData ? '#ffffff' : item.color,
                                    border: item.isNoData ? '1px solid #cbd5e1' : 'none'
                                }} />
                                <span style={{ fontSize: '11px', color: '#475569', fontWeight: 500 }}>
                                    {item.label}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
