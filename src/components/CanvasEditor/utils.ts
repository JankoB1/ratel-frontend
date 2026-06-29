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

export const formatChartValue = (v: any, decimals?: number, isPercentage?: boolean): string => {
    const num = parseVal(v);
    let str: string;
    if (decimals === undefined || decimals === null) {
        if (num % 1 === 0) {
            str = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 }).format(num);
        } else {
            str = new Intl.NumberFormat('sr-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
        }
    } else {
        str = new Intl.NumberFormat('sr-RS', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
    }
    return isPercentage ? `${str}%` : str;
};

// Word-wrap a label into lines no longer than `maxChars` each, so long
// category labels (e.g. horizontal-bar row descriptions with 5-6 words) can be
// rendered on multiple <tspan> lines instead of overflowing / overlapping.
// A single word longer than maxChars is hard-split so it can never overflow.
export const wrapLabelLines = (text: any, maxChars: number): string[] => {
    const limit = Math.max(4, Math.floor(maxChars));
    const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
        if (!cur) cur = w;
        else if ((cur + ' ' + w).length <= limit) cur += ' ' + w;
        else { lines.push(cur); cur = w; }
        while (cur.length > limit) {
            lines.push(cur.slice(0, limit));
            cur = cur.slice(limit);
        }
    }
    if (cur) lines.push(cur);
    return lines;
};

// Pita (pie) — kanonski izračun parčića: vrednost po kategoriji = row[keys[0]],
// sortirano OPADAJUĆE po vrednosti (identično kao <Pie data={pieData}> i sve legende),
// pa se palette-fallback boja dodeljuje po SORTIRANOM indeksu. Vraća { name, value, color }
// tačno onim redosledom i bojama kojima se crtaju parčad — da tabela podataka, legenda i
// swatch-evi u editoru NIKAD ne odstupaju od same pite. Ako je za kategoriju ručno izabrana
// boja (colors[name]), ona ima prednost (isto kao u Pie Cell-ovima).
export const buildPieRows = (
    data: any[],
    keys: any[],
    colors: Record<string, string> = {},
    palette: string[],
): { name: string; value: number; color: string }[] => {
    const k0 = keys?.[0];
    return [...(data || [])]
        .map((d: any) => ({ name: d?.name, value: parseVal(d?.[k0 as any]) }))
        .sort((a, b) => b.value - a.value)
        .map((d, i) => ({ ...d, color: (colors && colors[d.name]) || palette[i % palette.length] }));
};

// --- DOCUMENT SEARCH ---
// Deljeno između editora (PanelPage) i preview stranica (ViewPage/CollectionPage/
// GroupPreviewPage) da bi pretraga radila IDENTIČNO na oba mesta.

export const stripHtml = (html: string) => html.replace(/<[^>]*>/g, ' ');

// Izvlači sav pretraživi tekst iz jednog elementa kanvasa (tekst, tabela, grafikon,
// slika, mapa) i vraća ga malim slovima — pozivalac samo radi `.includes(query)`.
export const extractElementText = (el: any): string => {
    const payload = el.payload || {};
    const settings = payload.settings || {};
    const parts: string[] = [];
    switch (el.type) {
        case 'text':
            parts.push(stripHtml(settings.content || ''));
            break;
        case 'table':
            Object.values(payload.sr?.content || {}).forEach((v: any) => {
                if (typeof v === 'string') parts.push(stripHtml(v));
            });
            if (settings.title) parts.push(settings.title);
            break;
        case 'chart':
            if (settings.title) parts.push(settings.title);
            if (settings.subtitle) parts.push(settings.subtitle);
            if (settings.description) parts.push(settings.description);
            (payload.data || []).forEach((d: any) => { if (d?.name) parts.push(String(d.name)); });
            (payload.keys || []).forEach((k: string) => parts.push(k));
            break;
        case 'image':
            if (settings.altText) parts.push(settings.altText);
            if (settings.caption) parts.push(settings.caption);
            break;
        case 'map':
            if (settings.title) parts.push(settings.title);
            break;
    }
    return parts.join(' ').toLowerCase();
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
