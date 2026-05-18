import { createContext, useContext, useState, type ReactNode, type FC } from 'react';

interface SelectedElement {
    pageId: string;
    rowId: string;
    colId: string;
    elementId: string;
    type: 'text' | 'image' | 'table' | 'chart' | 'map' | string;
    subType?: 'table' | 'cell';
    activeCell?: string;
    settings: any;
    extraPayload?: {
        data?: any[];
        colors?: Record<string, string>;
        keys?: string[];
        subChartType?: string;
    };
}

interface EditorContextType {
    selectedElement: SelectedElement | null;
    setSelectedElement: (el: SelectedElement | null) => void;
    updateElementSettings: (newSettings: Partial<any>, extraPayload?: Partial<SelectedElement['extraPayload']>) => void;
    isChartModalOpen: boolean;
    setIsChartModalOpen: (isOpen: boolean) => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
    const [isChartModalOpen, setIsChartModalOpen] = useState(false); // Dodato

    const [isGroupingMode, setIsGroupingMode] = useState(false);
    const [groupSelection, setGroupSelection] = useState<string[]>([]);

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
        <EditorContext.Provider value={{ isGroupingMode, setIsGroupingMode, groupSelection, setGroupSelection, selectedElement, setSelectedElement, updateElementSettings, isChartModalOpen, setIsChartModalOpen }}>
            {children}
        </EditorContext.Provider>
    );
};

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (!context) throw new Error("useEditor mora biti unutar EditorProvider-a");
    return context;
};
