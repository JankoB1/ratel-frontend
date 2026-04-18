import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useEditor } from "../contexts/EditorContext";

const ChartDataEditor = () => {
    const { isChartModalOpen, setIsChartModalOpen, selectedElement, updateElementSettings } = useEditor();

    const [localData, setLocalData] = useState<any[]>([]);
    const [localKeys, setLocalKeys] = useState<string[]>([]);
    const [localColors, setLocalColors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isChartModalOpen && selectedElement && selectedElement.type === 'chart') {
            setLocalData([...(selectedElement.extraPayload?.data || selectedElement.settings?.data || [])]);
            setLocalKeys([...(selectedElement.extraPayload?.keys || selectedElement.settings?.keys || [])]);
            setLocalColors({...(selectedElement.extraPayload?.colors || selectedElement.settings?.colors || {})});
        }
    }, [isChartModalOpen, selectedElement]);

    if (!isChartModalOpen || !selectedElement) return null;

    const handleDataChange = (rowIndex: number, key: string, value: string) => {
        const newData = [...localData];
        newData[rowIndex][key] = isNaN(Number(value)) || value === '' ? value : Number(value);
        setLocalData(newData);
    };

    const handleKeyNameChange = (keyIndex: number, newName: string) => {
        const oldKey = localKeys[keyIndex];
        const newKeys = [...localKeys];
        newKeys[keyIndex] = newName || `Serija ${keyIndex + 1}`;
        setLocalKeys(newKeys);

        const newData = localData.map(row => {
            const newRow = { ...row };
            newRow[newKeys[keyIndex]] = newRow[oldKey];
            delete newRow[oldKey];
            return newRow;
        });
        setLocalData(newData);

        const newColors = { ...localColors };
        if (newColors[oldKey]) {
            newColors[newKeys[keyIndex]] = newColors[oldKey];
            delete newColors[oldKey];
            setLocalColors(newColors);
        }
    };

    const handleColorChange = (identifier: string, color: string) => {
        setLocalColors(prev => ({ ...prev, [identifier]: color }));
    };

    const addRow = () => {
        const newRow: any = { name: `Ставка ${localData.length + 1}` };
        localKeys.forEach(k => newRow[k] = 0);
        setLocalData([...localData, newRow]);
    };

    const addColumn = () => {
        const newKey = `Серија ${localKeys.length + 1}`;
        setLocalKeys([...localKeys, newKey]);
        setLocalData(localData.map(row => ({ ...row, [newKey]: 0 })));
    };

    const removeRow = (index: number) => {
        setLocalData(localData.filter((_, i) => i !== index));
    };

    const removeColumn = (key: string) => {
        setLocalKeys(localKeys.filter(k => k !== key));
        setLocalData(localData.map(row => {
            const newRow = { ...row };
            delete newRow[key];
            return newRow;
        }));
    };

    const handleSave = () => {
        updateElementSettings({}, { data: localData, keys: localKeys, colors: localColors });
        setIsChartModalOpen(false);
    };

    return (
        // NOVO: Apsolutno pozicioniran kontejner sa stopPropagation (nema više celog blura ekrana!)
        <div
            className="absolute top-[calc(100%+15px)] left-1/2 -translate-x-1/2 w-[700px] z-[99999] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-top-4 fade-in cursor-default"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()} // Sprečava da popover pokrene "drag" grafikona
        >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h2 className="text-lg font-bold text-slate-700">Уређивање података и боја</h2>
                <button onClick={() => setIsChartModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all">
                    <X size={20} />
                </button>
            </div>

            {/* Modal Body - Tabela */}
            <div className="p-6 overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                <table className="w-full border-collapse">
                    <thead>
                    <tr>
                        <th className="p-2 border-b border-r border-slate-200 bg-slate-50 min-w-[150px]">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Категорија</span>
                        </th>
                        {localKeys.map((key, kIdx) => (
                            <th key={kIdx} className="p-2 border-b border-r border-slate-200 bg-slate-50 min-w-[150px] relative group">
                                <div className="flex items-center gap-2">
                                    <label className="cursor-pointer shrink-0">
                                        <input type="color" value={localColors[key] || '#3b82f6'} onChange={(e) => handleColorChange(key, e.target.value)} className="sr-only" />
                                        <div className="w-4 h-4 rounded-full border border-slate-300 shadow-inner" style={{ backgroundColor: localColors[key] || '#3b82f6' }} />
                                    </label>
                                    <input
                                        type="text"
                                        value={key}
                                        onChange={(e) => handleKeyNameChange(kIdx, e.target.value)}
                                        className="w-full bg-transparent font-bold text-slate-700 text-sm outline-none border-b border-transparent focus:border-blue-400"
                                    />
                                    <button onClick={() => removeColumn(key)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                                        <X size={14} />
                                    </button>
                                </div>
                            </th>
                        ))}
                        <th className="p-2 border-b border-slate-200 bg-slate-50 w-[50px]">
                            <button onClick={addColumn} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded mx-auto block">
                                <Plus size={16} />
                            </button>
                        </th>
                    </tr>
                    </thead>
                    <tbody>
                    {localData.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/50">
                            <td className="p-2 border-b border-r border-slate-200">
                                <div className="flex items-center gap-2">
                                    <label className="cursor-pointer shrink-0">
                                        <input type="color" value={localColors[row.name] || '#10b981'} onChange={(e) => handleColorChange(row.name, e.target.value)} className="sr-only" />
                                        <div className="w-4 h-4 rounded-full border border-slate-300 shadow-inner" style={{ backgroundColor: localColors[row.name] || '#10b981' }} />
                                    </label>
                                    <input
                                        type="text"
                                        value={row.name}
                                        onChange={(e) => handleDataChange(rIdx, 'name', e.target.value)}
                                        className="w-full bg-transparent text-sm text-slate-700 font-medium outline-none border-b border-transparent focus:border-blue-400 p-1"
                                    />
                                </div>
                            </td>
                            {localKeys.map((key, kIdx) => (
                                <td key={kIdx} className="p-2 border-b border-r border-slate-200">
                                    <input
                                        type="text"
                                        value={row[key] !== undefined ? row[key] : ''}
                                        onChange={(e) => handleDataChange(rIdx, key, e.target.value)}
                                        className="w-full bg-transparent text-sm text-slate-600 text-right outline-none border-b border-transparent focus:border-blue-400 p-1"
                                    />
                                </td>
                            ))}
                            <td className="p-2 border-b border-slate-200 text-center">
                                <button onClick={() => removeRow(rIdx)} className="p-1.5 text-slate-400 hover:text-red-500 rounded">
                                    <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>

                <button onClick={addRow} className="mt-4 flex items-center gap-2 text-sm text-blue-500 font-bold hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-all">
                    <Plus size={16} /> Додај ред (категорију)
                </button>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                <button onClick={() => setIsChartModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-all">
                    Откажи
                </button>
                <button onClick={handleSave} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-500 hover:bg-blue-600 shadow-md hover:shadow-lg rounded-xl transition-all">
                    Сачувај податке
                </button>
            </div>
        </div>
    );
};

export default ChartDataEditor;
