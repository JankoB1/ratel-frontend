import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {Bell, ChevronDown, Search, ZoomIn, ZoomOut, Undo2, LogOut, ShieldCheck} from "lucide-react";
import logo from '../assets/logo.svg';
import { useAuth } from "../contexts/AuthContext";

interface HeaderProps {
    onUndo?: () => void;
    canUndo?: boolean;
    zoom?: number;
    onZoomIn?: () => void;
    onZoomOut?: () => void;
    onZoomReset?: () => void;
    zoomMin?: number;
    zoomMax?: number;
    onSearchClick?: () => void;
    documentTitle?: string;
    documentStatus?: string;
    onDocumentUpdate?: (updates: { title?: string; status?: string }) => void | Promise<void>;
}

const STATUS_INFO: Record<string, { label: string; dotClass: string }> = {
    draft: { label: 'У ИЗРАДИ', dotClass: 'bg-orange-400' },
    published: { label: 'ОБЈАВЉЕНО', dotClass: 'bg-green-500' },
    archived: { label: 'АРХИВИРАНО', dotClass: 'bg-slate-400' },
};

const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Deterministic color from name (HSL)
const colorFromName = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 45%)`;
};

const Avatar = ({ src, name, size = 32 }: { src?: string | null; name: string; size?: number }) => {
    const [errored, setErrored] = useState(false);
    if (src && !errored) {
        return (
            <img
                src={src}
                alt={name}
                onError={() => setErrored(true)}
                style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
        );
    }
    return (
        <div
            style={{
                width: size, height: size,
                borderRadius: '50%',
                backgroundColor: colorFromName(name || 'U'),
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700,
                fontSize: Math.round(size * 0.42),
                flexShrink: 0,
                userSelect: 'none',
            }}
        >
            {getInitials(name || 'U')}
        </div>
    );
};

const Header = ({ onUndo, canUndo = false, zoom = 1, onZoomIn, onZoomOut, onZoomReset, zoomMin = 0.4, zoomMax = 2, onSearchClick, documentTitle, documentStatus, onDocumentUpdate }: HeaderProps) => {
    const statusInfo = STATUS_INFO[documentStatus || 'draft'] ?? STATUS_INFO.draft;

    // Title inline edit
    const [editingTitle, setEditingTitle] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');
    const titleInputRef = useRef<HTMLInputElement>(null);

    const startEditTitle = () => {
        setTitleDraft(documentTitle || '');
        setEditingTitle(true);
        setTimeout(() => titleInputRef.current?.select(), 30);
    };
    const commitTitle = () => {
        const trimmed = titleDraft.trim();
        if (trimmed && trimmed !== documentTitle) onDocumentUpdate?.({ title: trimmed });
        setEditingTitle(false);
    };
    const cancelTitle = () => setEditingTitle(false);

    // Status dropdown
    const [statusOpen, setStatusOpen] = useState(false);
    const statusMenuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setStatusOpen(false);
        };
        if (statusOpen) document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [statusOpen]);
    const canZoomIn = zoom < zoomMax;
    const canZoomOut = zoom > zoomMin;
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, [menuOpen]);

    const handleLogout = async () => {
        setMenuOpen(false);
        await logout();
        navigate('/login');
    };

    const displayName = user?.name || 'Гост';

    return (
        <header className="h-20 px-8 m-8 w-full flex items-center justify-between bg-background-grey">
            <div className="flex items-center gap-4 bg-white rounded-[50px] py-[10px] px-[40px] header-logo">
                <div className="text-[#0056B3] font-bold text-xl flex items-center gap-2">
                    <img src={logo} alt="logo-ratel" />
                    <p className="text-primary-blue font-medium">RATEL</p>
                </div>
                <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                <div className="min-w-0 max-w-[300px] flex flex-col gap-1">
                    {editingTitle ? (
                        <input
                            ref={titleInputRef}
                            value={titleDraft}
                            onChange={(e) => setTitleDraft(e.target.value)}
                            onBlur={commitTitle}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
                                else if (e.key === 'Escape') { e.preventDefault(); cancelTitle(); }
                            }}
                            className="font-extrabold text-[15px] leading-none tracking-[0.05em] uppercase outline-none border-b-2 border-blue-400 bg-transparent px-0 py-1 min-w-0 w-full"
                            autoFocus
                        />
                    ) : (
                        <h1
                            onClick={onDocumentUpdate ? startEditTitle : undefined}
                            className={`font-extrabold text-[15px] leading-none tracking-[0.05em] uppercase truncate ${onDocumentUpdate ? 'cursor-text hover:bg-slate-50 rounded px-1 -mx-1 py-1' : ''}`}
                            title={onDocumentUpdate ? 'Кликни за уређивање назива' : (documentTitle || '')}
                        >
                            {documentTitle || 'Без наслова'}
                        </h1>
                    )}

                    <div ref={statusMenuRef} className="relative">
                        <button
                            type="button"
                            onClick={() => onDocumentUpdate && setStatusOpen(o => !o)}
                            className={`font-normal text-base leading-none tracking-[0.05em] uppercase inline-flex items-center gap-2 px-1 -mx-1 py-1 rounded ${onDocumentUpdate ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                            title={onDocumentUpdate ? 'Промени статус' : ''}
                        >
                            <span className={`w-2 h-2 ${statusInfo.dotClass} rounded-full inline-block`}></span>
                            {statusInfo.label}
                            {onDocumentUpdate && (
                                <ChevronDown size={14} className={`transition-transform ${statusOpen ? 'rotate-180' : ''} text-slate-400`} />
                            )}
                        </button>
                        {statusOpen && (
                            <div className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-[200]" style={{ minWidth: 200 }}>
                                {(['draft', 'published', 'archived'] as const).map((key) => {
                                    const info = STATUS_INFO[key];
                                    const isActive = (documentStatus || 'draft') === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => { setStatusOpen(false); if (!isActive) onDocumentUpdate?.({ status: key }); }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide text-left hover:bg-slate-50 ${isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}`}
                                        >
                                            <span className={`w-2 h-2 ${info.dotClass} rounded-full inline-block`}></span>
                                            {info.label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center bg-white rounded-[50px] px-[20px] py-[20px] gap-3">
                    <button
                        onClick={onUndo}
                        disabled={!canUndo}
                        title="Поништи (Ctrl+Z)"
                        className="disabled:cursor-not-allowed"
                    >
                        <Undo2 size={20} className={canUndo ? "text-dark-blue" : "text-slate-300"} />
                    </button>
                    <div className="w-[1px] h-4 bg-dark-blue"></div>
                    <button
                        onClick={onZoomIn}
                        disabled={!canZoomIn}
                        title="Увећај (Ctrl+ +)"
                        className="disabled:cursor-not-allowed"
                    >
                        <ZoomIn size={20} className={canZoomIn ? "text-dark-blue" : "text-slate-300"} />
                    </button>
                    <button
                        onClick={onZoomReset}
                        title="Поништи зум (Ctrl+0)"
                        className="text-dark-blue text-sm font-bold min-w-[42px]"
                    >
                        {Math.round(zoom * 100)}%
                    </button>
                    <button
                        onClick={onZoomOut}
                        disabled={!canZoomOut}
                        title="Умањи (Ctrl+ -)"
                        className="disabled:cursor-not-allowed"
                    >
                        <ZoomOut size={20} className={canZoomOut ? "text-dark-blue" : "text-slate-300"} />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-6 mr-4 bg-white rounded-[50px] py-[20px] px-[35px]">
                    <button onClick={onSearchClick} title="Претражи (Ctrl+F)">
                        <Search size={20} className="text-dark-blue" />
                    </button>
                    <div className="relative">
                        <Bell size={20} className="text-dark-blue" />
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                    </div>
                </div>
                <div ref={menuRef} className="relative">
                    <button
                        onClick={() => setMenuOpen(o => !o)}
                        className="flex items-center gap-4 bg-white rounded-[50px] py-[14px] px-[20px] hover:bg-slate-50 transition-colors"
                        title={user?.email || 'Налог'}
                    >
                        <Avatar src={user?.avatar} name={displayName} size={36} />
                        <span className="text-base tracking-wider uppercase max-w-[140px] truncate" title={displayName}>
                            {displayName}
                        </span>
                        <ChevronDown size={20} className={`transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {menuOpen && (
                        <div
                            className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
                            style={{ minWidth: 240, zIndex: 200 }}
                        >
                            <div className="px-4 py-3 flex items-center gap-3 border-b border-slate-100">
                                <Avatar src={user?.avatar} name={displayName} size={40} />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-bold text-slate-800 truncate">{displayName}</span>
                                    {user?.email && (
                                        <span className="text-xs text-slate-500 truncate" title={user.email}>{user.email}</span>
                                    )}
                                </div>
                            </div>
                            {user?.is_admin && (
                                <button
                                    onClick={() => { setMenuOpen(false); navigate('/admin'); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-[#0056B3] hover:bg-blue-50 transition-colors text-left border-b border-slate-100"
                                >
                                    <ShieldCheck size={16} />
                                    Админ панел
                                </button>
                            )}
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors text-left"
                            >
                                <LogOut size={16} />
                                Одјави се
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}

export default Header;
