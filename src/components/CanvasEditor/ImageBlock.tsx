import { useState, type ChangeEvent } from "react";
import { UploadCloud, GripVertical, Trash2 } from "lucide-react";
import axiosClient from "../../axios-client.ts";

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

export const ImageElementBlock = ({ el, pageId, rowId, colId, isSelected, selectedElement, setSelectedElement, updateElementSettings, onDelete, onDragStart, onDragEnd, elementLabel }: any) => {
    const defaultSettings = el.payload.settings;
    const currentSettings = isSelected ? selectedElement.settings : defaultSettings;
    const [isUploading, setIsUploading] = useState(false);

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData(); formData.append("image", file);
        try {
            const match = document.cookie.match(new RegExp('(^| )XSRF-TOKEN=([^;]+)'));
            const csrfToken = match ? decodeURIComponent(match[2]) : '';
            const response = await axiosClient.post("/api/upload-image", formData, { headers: { 'Content-Type': 'multipart/form-data', 'X-XSRF-TOKEN': csrfToken } });
            if (response.data?.url) updateElementSettings({ url: response.data.url });
        } catch (error) { alert("Greška pri otpremanju."); } finally { setIsUploading(false); }
    };

    return (
        <div
            draggable onDragStart={(e) => onDragStart(e, pageId, rowId, colId, el.id)} onDragEnd={onDragEnd}
            onClick={(e) => { e.stopPropagation(); setSelectedElement({ pageId, rowId, colId, elementId: el.id, type: 'image', settings: currentSettings }); }}
            className={`element-block break-inside-avoid ${isSelected ? 'is-selected' : ''}`}
            style={{ marginTop: `${currentSettings.marginTop || 0}px`, marginBottom: `${currentSettings.marginBottom || 0}px` }}
        >
            {isSelected && (
                <div className="element-actions">
                    <div className="action-btn grab"><GripVertical size={14} /></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(pageId, rowId, colId, el.id); }} className="action-btn danger"><Trash2 size={14} /></button>
                </div>
            )}

            <ElementLabel label={elementLabel} title={currentSettings.altText} />

            {currentSettings.url ? (
                <div style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: currentSettings.alignment === 'left' ? 'flex-start' : currentSettings.alignment === 'right' ? 'flex-end' : 'center', textAlign: currentSettings.alignment === 'left' ? 'left' : currentSettings.alignment === 'right' ? 'right' : 'center' }}>
                    <img
                        src={currentSettings.url}
                        alt={currentSettings.altText}
                        style={{ width: `${currentSettings.width || 100}%`, height: 'auto', borderRadius: '0', transition: 'all 0.2s' }}
                    />
                </div>
            ) : (
                <div style={{ padding: '2rem', width: '100%', minHeight: '180px', backgroundColor: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {isUploading ? (
                        <span style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite', fontSize: '14px', fontWeight: 600, color: '#3b82f6' }}>Otpremanje...</span>
                    ) : (
                        <label style={{ cursor: 'pointer', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <UploadCloud size={32} />
                            <span style={{ fontSize: '12px', fontWeight: 600 }}>Odaberi sliku</span>
                            <input type="file" style={{ display: 'none' }} onChange={handleImageUpload} />
                        </label>
                    )}
                </div>
            )}
        </div>
    );
};
