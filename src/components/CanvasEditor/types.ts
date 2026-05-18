export type ElementType = "text" | "image" | "table" | "chart" | "map" | null;
export interface ContentElement { id: string; type: ElementType; payload: any; }
export interface ColumnData { id: string; widthClass: string; elements: ContentElement[]; }
export interface RowData { id: string; columns: ColumnData[]; }
