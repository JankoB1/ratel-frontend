import { useCallback, useEffect, useRef, useState } from "react";
import { Search as SearchIcon, ChevronUp, ChevronDown, X } from "lucide-react";
import { extractElementText } from "./CanvasEditor/utils";

// Deljena pretraga dokumenta — koristi se na preview stranicama (ViewPage,
// CollectionPage, GroupPreviewPage). Radi IDENTIČNO kao pretraga u editoru
// (PanelPage): Ctrl/Cmd+F otvara, Escape zatvara, Enter/Shift+Enter kreće kroz
// rezultate, brojač N / M, isti highlight (.search-match / .search-match-current)
// i scrollIntoView na trenutni rezultat.
//
// Razlika u odnosu na editor: ovde je opseg CEO dokument (sve sekcije), pošto su
// na preview stranicama sve sekcije/strane već iscrtane u jednom scroll kontejneru.

export interface SearchableSection {
    canvas_data?: any[] | null;
}

export interface DocumentSearchApi {
    searchOpen: boolean;
    searchQuery: string;
    setSearchQuery: (v: string) => void;
    searchMatches: string[];
    currentMatchIdx: number;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    openSearch: () => void;
    closeSearch: () => void;
    nextMatch: () => void;
    prevMatch: () => void;
}

/**
 * @param sections   Sve sekcije nad kojima se pretražuje. MORA biti stabilna
 *                   (memoizovana) referenca, inače se efekat za računanje
 *                   rezultata vrti u krug. Pozivaoci koriste useState/useMemo.
 * @param containerRef Scroll kontejner u kome su iscrtani [data-element-id] čvorovi.
 */
export function useDocumentSearch<T extends HTMLElement>(
    sections: SearchableSection[],
    containerRef: React.RefObject<T | null>,
): DocumentSearchApi {
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchMatches, setSearchMatches] = useState<string[]>([]);
    const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const openSearch = useCallback(() => {
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
    }, []);
    const closeSearch = useCallback(() => {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchMatches([]);
    }, []);
    const nextMatch = useCallback(() => {
        setCurrentMatchIdx(i => (searchMatches.length ? (i + 1) % searchMatches.length : 0));
    }, [searchMatches.length]);
    const prevMatch = useCallback(() => {
        setCurrentMatchIdx(i => (searchMatches.length ? (i - 1 + searchMatches.length) % searchMatches.length : 0));
    }, [searchMatches.length]);

    // Ctrl/Cmd+F otvara, Escape zatvara — isto kao u editoru.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
                e.preventDefault();
                openSearch();
            }
            if (e.key === 'Escape' && searchOpen) {
                closeSearch();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [openSearch, closeSearch, searchOpen]);

    // Računanje rezultata kroz SVE sekcije (ceo dokument).
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchMatches([]);
            setCurrentMatchIdx(0);
            return;
        }
        const q = searchQuery.toLowerCase().trim();
        const matched: string[] = [];
        sections.forEach((section) => {
            (section?.canvas_data || []).forEach((page: any) => {
                page.rows?.forEach((row: any) => {
                    row.columns?.forEach((col: any) => {
                        col.elements?.forEach((el: any) => {
                            if (extractElementText(el).includes(q)) matched.push(el.id);
                        });
                    });
                });
            });
        });
        setSearchMatches(matched);
        setCurrentMatchIdx(0);
    }, [searchQuery, sections]);

    // Primeni highlight klase na DOM + skroluj na trenutni rezultat.
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.querySelectorAll('.search-match, .search-match-current').forEach(el => {
            el.classList.remove('search-match', 'search-match-current');
        });
        searchMatches.forEach((id, idx) => {
            const el = container.querySelector(`[data-element-id="${CSS.escape(id)}"]`);
            if (el) {
                el.classList.add('search-match');
                if (idx === currentMatchIdx) el.classList.add('search-match-current');
            }
        });
        if (searchMatches.length > 0) {
            const id = searchMatches[currentMatchIdx];
            const el = container.querySelector(`[data-element-id="${CSS.escape(id)}"]`);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [searchMatches, currentMatchIdx, containerRef]);

    // Očisti highlight kada se pretraga zatvori.
    useEffect(() => {
        if (searchOpen) return;
        const container = containerRef.current;
        container?.querySelectorAll('.search-match, .search-match-current').forEach(el => {
            el.classList.remove('search-match', 'search-match-current');
        });
    }, [searchOpen, containerRef]);

    return {
        searchOpen, searchQuery, setSearchQuery, searchMatches, currentMatchIdx,
        searchInputRef, openSearch, closeSearch, nextMatch, prevMatch,
    };
}

// Plutajući search box — vizuelno i ponašanjem identičan editorskom.
export function DocumentSearchBox({ search }: { search: DocumentSearchApi }) {
    const {
        searchOpen, searchQuery, setSearchQuery, searchMatches, currentMatchIdx,
        searchInputRef, closeSearch, nextMatch, prevMatch,
    } = search;

    if (!searchOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 110,
                right: 40,
                zIndex: 100,
                background: 'white',
                borderRadius: 16,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                border: '1px solid #e2e8f0',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 380,
            }}
        >
            <SearchIcon size={16} className="text-slate-400" />
            <input
                ref={searchInputRef}
                autoFocus
                type="text"
                placeholder="Pretraži u dokumentu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (e.shiftKey) prevMatch();
                        else nextMatch();
                    } else if (e.key === 'Escape') {
                        closeSearch();
                    }
                }}
                style={{ flex: 1, outline: 'none', fontSize: 14, color: '#1e293b', background: 'transparent', border: 'none' }}
            />
            <span style={{ fontSize: 12, color: '#64748b', minWidth: 72, textAlign: 'center', fontWeight: 600 }}>
                {searchQuery.trim() === ''
                    ? ''
                    : searchMatches.length === 0
                        ? 'Nema rezultata'
                        : `${currentMatchIdx + 1} / ${searchMatches.length}`}
            </span>
            <button
                onClick={prevMatch}
                disabled={!searchMatches.length}
                title="Prethodni (Shift+Enter)"
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: searchMatches.length ? '#475569' : '#cbd5e1', cursor: searchMatches.length ? 'pointer' : 'not-allowed' }}
            >
                <ChevronUp size={16} />
            </button>
            <button
                onClick={nextMatch}
                disabled={!searchMatches.length}
                title="Sledeći (Enter)"
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: searchMatches.length ? '#475569' : '#cbd5e1', cursor: searchMatches.length ? 'pointer' : 'not-allowed' }}
            >
                <ChevronDown size={16} />
            </button>
            <button
                onClick={closeSearch}
                title="Zatvori (Esc)"
                style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', color: '#475569', cursor: 'pointer' }}
            >
                <X size={16} />
            </button>
        </div>
    );
}

// Uvek vidljivo polje za pretragu (za razliku od DocumentSearchBox koji se
// pojavljuje tek na Ctrl/Cmd+F). Ista logika i highlight, ali polje stoji stalno.
//   variant="inline"          → pill u desktop toolbaru (postavlja se levo od zoom kontrola)
//   variant="floating-bottom" → elegantno plutajuće polje na dnu (mobilni prikaz)
// Ctrl/Cmd+F i dalje radi — samo fokusira ovo polje (hook poziva openSearch→focus).
export function DocumentSearchField({
    search,
    variant = 'inline',
}: {
    search: DocumentSearchApi;
    variant?: 'inline' | 'floating-bottom';
}) {
    const {
        searchQuery, setSearchQuery, searchMatches, currentMatchIdx,
        searchInputRef, nextMatch, prevMatch,
    } = search;

    const hasMatches = searchMatches.length > 0;
    const counter =
        searchQuery.trim() === ''
            ? ''
            : !hasMatches
                ? 'Nema rezultata'
                : `${currentMatchIdx + 1} / ${searchMatches.length}`;

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.shiftKey) prevMatch();
            else nextMatch();
        } else if (e.key === 'Escape') {
            // Polje je uvek vidljivo: Escape čisti upit i sklanja fokus (ne sakriva polje).
            setSearchQuery('');
            e.currentTarget.blur();
        }
    };

    const arrowCls = (enabled: boolean) =>
        `w-7 h-7 flex items-center justify-center rounded-full transition-colors shrink-0 ${
            enabled ? 'text-slate-600 hover:bg-slate-100 cursor-pointer' : 'text-slate-300 cursor-not-allowed'
        }`;

    const inner = (
        <>
            <SearchIcon size={16} className="text-slate-400 shrink-0" />
            <input
                ref={searchInputRef}
                type="text"
                placeholder="Pretraži u dokumentu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={onKeyDown}
                className="flex-1 min-w-0 bg-transparent border-none outline-none text-[14px] text-slate-800 placeholder:text-slate-400"
            />
            {counter && (
                <span className="text-[12px] font-semibold text-slate-500 text-center shrink-0" style={{ minWidth: 64 }}>
                    {counter}
                </span>
            )}
            {searchQuery && (
                <button
                    onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                    title="Očisti"
                    className="w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
                >
                    <X size={14} />
                </button>
            )}
            <button onClick={prevMatch} disabled={!hasMatches} title="Prethodni (Shift+Enter)" className={arrowCls(hasMatches)}>
                <ChevronUp size={16} />
            </button>
            <button onClick={nextMatch} disabled={!hasMatches} title="Sledeći (Enter)" className={arrowCls(hasMatches)}>
                <ChevronDown size={16} />
            </button>
        </>
    );

    if (variant === 'floating-bottom') {
        return (
            <div
                className="fixed left-4 right-4 z-30 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-full border border-slate-200 px-4 py-2.5"
                style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', boxShadow: '0 10px 30px rgba(15,23,42,0.18)' }}
            >
                {inner}
            </div>
        );
    }

    // inline (desktop) — pill koji se vizuelno uklapa uz ostale kontrole u toolbaru.
    return (
        <div
            className="flex items-center gap-2 bg-white rounded-[50px] py-[10px] px-[20px] border border-slate-100 shadow-sm"
            style={{ width: 300 }}
        >
            {inner}
        </div>
    );
}
