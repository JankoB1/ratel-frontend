export const extractFootnoteIds = (html: string) => {
    const regex = /data-footnote-id="([^"]+)"/g;
    const ids = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
        ids.push(match[1]);
    }
    return ids;
};

export const parseVal = (v: any): number => {
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    const n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? 0 : n;
};

export const hexToRgba = (hex: string, opacity: number) => {
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    const r = parseInt(cleanHex.slice(0, 2), 16) || 59;
    const g = parseInt(cleanHex.slice(2, 4), 16) || 130;
    const b = parseInt(cleanHex.slice(4, 6), 16) || 246;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
