import React, { createContext, useContext, useState } from 'react';

interface SelectedElement {
    pageId: string;
    rowId: string;
    colId: string;
    elementId: string;
    type: 'text' | 'image' | 'table' | 'chart' | 'map' | string;
    subType?: 'table' | 'cell';
    activeCell?: string;
    settings: any;
    // Extra payload za podatke, boje, i specifine tipove
    extraPayload?: {
        data?: any[];
        colors?: Record<string, string>;
        keys?: string[];
        subChartType?: string; // NOVO: Za praćenje 2x2 podtipa
    };
}

interface EditorContextType {
    selectedElement: SelectedElement | null;
    setSelectedElement: (el: SelectedElement | null) => void;
    updateElementSettings: (newSettings: Partial<any>, extraPayload?: Partial<SelectedElement['extraPayload']>) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);

    const updateElementSettings = (newSettings: Partial<any>, newExtraPayload?: Partial<SelectedElement['extraPayload']>) => {
        if (selectedElement) {
            setSelectedElement({
                ...selectedElement,
                settings: { ...selectedElement.settings, ...newSettings },
                extraPayload: newExtraPayload ? { ...selectedElement.extraPayload, ...newExtraPayload } : selectedElement.extraPayload
            });
        }
    };

    return (
        <EditorContext.Provider value={{ selectedElement, setSelectedElement, updateElementSettings }}>
            {children}
        </EditorContext.Provider>
    );
};

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (!context) throw new Error("useEditor mora biti unutar EditorProvider-a");
    return context;
};
