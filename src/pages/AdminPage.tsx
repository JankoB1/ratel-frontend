import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    LayoutDashboard, FolderOpen, Users, UserCircle, Bell, Search,
    ChevronDown, Plus, MoreHorizontal, FileText, Loader2, Trash2,
    PenLine, Eye, TrendingUp, Clock, AlertCircle, X, Check,
    ShieldCheck, FileStack, ChevronUp, KeyRound
} from "lucide-react";
import axiosClient from "../axios-client";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/logo.svg";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
    total_documents: number;
    total_users: number;
    in_progress: number;
    last_activity: string | null;
}

interface DocItem {
    id: number;
    title: string;
    status: string;
    type: string;
    sections_count: number;
    updated_at: string;
    created_at: string;
}

interface UserItem {
    id: number;
    name: string;
    email: string;
    is_admin: boolean;
    created_at: string;
}

interface SectionItem {
    id: number;
    title: string;
    order: number;
    is_disabled: boolean;
    updated_at: string;
}

interface UserPermissionDoc {
    id: number;
    title: string;
    type: string;
    sections: { id: number; title: string; order: number; can_edit: boolean }[];
}

type TabKey = "documents" | "users";
type DocType = "all" | "annual_report" | "financial_report" | "financial_plan";

const TYPE_LABELS: Record<DocType, string> = {
    all: "Сви пројекти",
    annual_report: "Годишњи извештаји",
    financial_report: "Финансијски извештаји",
    financial_plan: "Финансијски план",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: "У изради", color: "text-orange-500 bg-orange-50" },
    published: { label: "Објављено", color: "text-green-600 bg-green-50" },
    archived: { label: "Архивирано", color: "text-slate-400 bg-slate-100" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("sr-RS", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function timeAgo(iso: string | null) {
    if (!iso) return "—";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "malopre";
    if (diff < 3600) return `pre ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `pre ${Math.floor(diff / 3600)} h`;
    return `pre ${Math.floor(diff / 86400)} dana`;
}

// ── Modal za kreiranje dokumenta ──────────────────────────────────────────────

interface CreateModalProps {
    onClose: () => void;
    onCreate: (title: string, type: DocType) => Promise<void>;
}

const CreateModal = ({ onClose, onCreate }: CreateModalProps) => {
    const [title, setTitle] = useState("");
    const [type, setType] = useState<DocType>("annual_report");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        await onCreate(title.trim(), type);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-extrabold text-lg text-dark-blue">Novi dokument</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Naziv</label>
                        <input
                            autoFocus
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="npr. Godišnji izveštaj 2026"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Vrsta</label>
                        <select
                            value={type}
                            onChange={e => setType(e.target.value as DocType)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition bg-white"
                        >
                            <option value="annual_report">Godišnji izveštaj</option>
                            <option value="financial_report">Finansijski izveštaj</option>
                            <option value="financial_plan">Finansijski plan</option>
                        </select>
                    </div>
                    <div className="flex gap-3 mt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition">
                            Otkaži
                        </button>
                        <button type="submit" disabled={!title.trim() || saving}
                            className="flex-1 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Kreiraj
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Modal za kreiranje korisnika ──────────────────────────────────────────────

interface CreateUserModalProps {
    onClose: () => void;
    onCreate: (name: string, email: string, password: string, isAdmin: boolean) => Promise<string | null>;
}

const CreateUserModal = ({ onClose, onCreate }: CreateUserModalProps) => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password !== passwordConfirmation) { setError("Lozinke se ne podudaraju."); return; }
        setSaving(true);
        const err = await onCreate(name.trim(), email.trim(), password, isAdmin);
        setSaving(false);
        if (err) setError(err);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-extrabold text-lg text-dark-blue">Novi korisnik</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600 font-semibold">
                            <AlertCircle size={15} className="shrink-0" /> {error}
                        </div>
                    )}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Ime i prezime</label>
                        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="npr. Marko Marković"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">E-pošta</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ime@ratel.rs"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Lozinka</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 karaktera"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Potvrdite lozinku</label>
                        <input type="password" value={passwordConfirmation} onChange={e => setPasswordConfirmation(e.target.value)} placeholder="Ponovite lozinku"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                        <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-4 h-4 accent-[#0056B3]" />
                        <ShieldCheck size={16} className={isAdmin ? "text-[#0056B3]" : "text-slate-300"} />
                        <span className="text-sm font-bold text-slate-700">Администратор</span>
                        <span className="text-xs text-slate-400 ml-auto">{isAdmin ? "пун приступ" : "стандардни"}</span>
                    </label>
                    <div className="flex gap-3 mt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition">
                            Otkaži
                        </button>
                        <button type="submit" disabled={!name.trim() || !email.trim() || !password || saving}
                            className="flex-1 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Kreiraj
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Edit User Modal ───────────────────────────────────────────────────────────

interface EditUserModalProps {
    user: UserItem;
    onClose: () => void;
    onSave: (id: number, payload: { name?: string; email?: string; password?: string; is_admin?: boolean }) => Promise<string | null>;
}

const EditUserModal = ({ user, onClose, onSave }: EditUserModalProps) => {
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [isAdmin, setIsAdmin] = useState(user.is_admin);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password && password !== passwordConfirmation) { setError("Lozinke se ne podudaraju."); return; }
        const payload: any = {};
        if (name.trim() !== user.name) payload.name = name.trim();
        if (email.trim() !== user.email) payload.email = email.trim();
        if (password) { payload.password = password; payload.password_confirmation = passwordConfirmation; }
        if (isAdmin !== user.is_admin) payload.is_admin = isAdmin;
        if (Object.keys(payload).length === 0) { onClose(); return; }
        setSaving(true);
        const err = await onSave(user.id, payload);
        setSaving(false);
        if (err) setError(err);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-extrabold text-lg text-dark-blue">Уреди корисника</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {error && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600 font-semibold">
                            <AlertCircle size={15} className="shrink-0" /> {error}
                        </div>
                    )}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Име и презиме</label>
                        <input value={name} onChange={e => setName(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Е-пошта</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Нова лозинка (опционо)</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Оставите празно за исту лозинку"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    </div>
                    {password && (
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Потврди лозинку</label>
                            <input type="password" value={passwordConfirmation} onChange={e => setPasswordConfirmation(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                        </div>
                    )}
                    <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                        <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-4 h-4 accent-[#0056B3]" />
                        <ShieldCheck size={16} className={isAdmin ? "text-[#0056B3]" : "text-slate-300"} />
                        <span className="text-sm font-bold text-slate-700">Администратор</span>
                    </label>
                    <div className="flex gap-3 mt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition">Отказ</button>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Сачувај
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Sections Manager Modal ───────────────────────────────────────────────────

interface SectionsModalProps {
    doc: DocItem;
    onClose: () => void;
}

const SectionsModal = ({ doc, onClose }: SectionsModalProps) => {
    const [sections, setSections] = useState<SectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTitle, setNewTitle] = useState("");
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosClient.get(`/api/admin/documents/${doc.id}/sections`);
            setSections(data.data);
        } finally {
            setLoading(false);
        }
    }, [doc.id]);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        setAdding(true);
        try {
            await axiosClient.post(`/api/admin/documents/${doc.id}/sections`, { title: newTitle.trim() });
            setNewTitle("");
            await load();
        } finally {
            setAdding(false);
        }
    };

    const handleRename = async (sectionId: number, newTitle: string) => {
        if (!newTitle.trim()) return;
        await axiosClient.put(`/api/admin/sections/${sectionId}`, { title: newTitle.trim() });
        await load();
    };

    const handleDelete = async (sectionId: number) => {
        if (!confirm("Da li ste sigurni da želite da obrišete ovu sekciju?")) return;
        await axiosClient.delete(`/api/admin/sections/${sectionId}`);
        await load();
    };

    const handleMove = async (sectionId: number, direction: 'up' | 'down') => {
        const idx = sections.findIndex(s => s.id === sectionId);
        if (idx < 0) return;
        const swapWith = direction === 'up' ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= sections.length) return;
        const reordered = [...sections];
        [reordered[idx], reordered[swapWith]] = [reordered[swapWith], reordered[idx]];
        setSections(reordered);
        await axiosClient.put(`/api/admin/documents/${doc.id}/sections/reorder`, {
            order: reordered.map(s => s.id),
        });
        await load();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h2 className="font-extrabold text-lg text-dark-blue flex items-center gap-2"><FileStack size={20} className="text-[#0056B3]" /> Секције документа</h2>
                        <p className="text-sm text-slate-400 mt-0.5">{doc.title}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                <form onSubmit={handleAdd} className="flex gap-2 mt-5">
                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Назив нове секције..."
                        className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    <button type="submit" disabled={!newTitle.trim() || adding}
                        className="px-5 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center gap-2">
                        {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Додај
                    </button>
                </form>

                <div className="flex-1 overflow-y-auto mt-5 -mx-2 px-2">
                    {loading ? (
                        <div className="flex justify-center py-12 text-slate-300"><Loader2 className="animate-spin" /></div>
                    ) : sections.length === 0 ? (
                        <div className="text-center py-12 text-slate-300 text-sm font-semibold">Нема секција</div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {sections.map((s, idx) => (
                                <SectionRow key={s.id} section={s} canMoveUp={idx > 0} canMoveDown={idx < sections.length - 1}
                                    onRename={(t) => handleRename(s.id, t)} onDelete={() => handleDelete(s.id)}
                                    onMoveUp={() => handleMove(s.id, 'up')} onMoveDown={() => handleMove(s.id, 'down')} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SectionRow = ({ section, canMoveUp, canMoveDown, onRename, onDelete, onMoveUp, onMoveDown }: any) => {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(section.title);

    const handleSave = async () => {
        if (title.trim() && title.trim() !== section.title) await onRename(title.trim());
        setEditing(false);
    };

    return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition group">
            <div className="flex flex-col gap-0.5">
                <button onClick={onMoveUp} disabled={!canMoveUp} className="p-0.5 text-slate-300 hover:text-[#0056B3] disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={14} /></button>
                <button onClick={onMoveDown} disabled={!canMoveDown} className="p-0.5 text-slate-300 hover:text-[#0056B3] disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={14} /></button>
            </div>
            <span className="text-xs font-bold text-slate-300 w-6">{section.order}.</span>
            {editing ? (
                <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onBlur={handleSave}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm outline-none" />
            ) : (
                <span onClick={() => setEditing(true)} className="flex-1 text-sm font-bold text-dark-blue cursor-text">{section.title}</span>
            )}
            <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-[#0056B3] hover:bg-blue-50 transition-all"><PenLine size={14} /></button>
            <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 size={14} /></button>
        </div>
    );
};

// ── Permissions Modal ────────────────────────────────────────────────────────

interface PermissionsModalProps {
    user: UserItem;
    onClose: () => void;
}

const PermissionsModal = ({ user, onClose }: PermissionsModalProps) => {
    const [docs, setDocs] = useState<UserPermissionDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});

    useEffect(() => {
        (async () => {
            try {
                const { data } = await axiosClient.get(`/api/admin/users/${user.id}/permissions`);
                setDocs(data.documents);
                const init: Record<number, boolean> = {};
                data.documents.forEach((d: UserPermissionDoc) => init[d.id] = true);
                setExpanded(init);
            } finally {
                setLoading(false);
            }
        })();
    }, [user.id]);

    const toggleSection = (docId: number, sectionId: number) => {
        setDocs(prev => prev.map(d => d.id === docId
            ? { ...d, sections: d.sections.map(s => s.id === sectionId ? { ...s, can_edit: !s.can_edit } : s) }
            : d
        ));
    };

    const toggleDocAll = (docId: number, newVal: boolean) => {
        setDocs(prev => prev.map(d => d.id === docId
            ? { ...d, sections: d.sections.map(s => ({ ...s, can_edit: newVal })) }
            : d
        ));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const permissions = docs.flatMap(d => d.sections.map(s => ({ section_id: s.id, can_edit: s.can_edit })));
            await axiosClient.put(`/api/admin/users/${user.id}/permissions`, { permissions });
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="font-extrabold text-lg text-dark-blue flex items-center gap-2"><KeyRound size={20} className="text-[#0056B3]" /> Привилегије по секцијама</h2>
                        <p className="text-sm text-slate-400 mt-0.5">{user.name} — {user.email}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                {user.is_admin && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 font-semibold mb-4 flex items-center gap-2">
                        <ShieldCheck size={14} /> Овај корисник је администратор и већ има пуни приступ свим секцијама.
                    </div>
                )}

                <div className="flex-1 overflow-y-auto -mx-2 px-2">
                    {loading ? (
                        <div className="flex justify-center py-12 text-slate-300"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {docs.map(d => {
                                const allChecked = d.sections.length > 0 && d.sections.every(s => s.can_edit);
                                const someChecked = d.sections.some(s => s.can_edit);
                                return (
                                    <div key={d.id} className="border border-slate-100 rounded-xl overflow-hidden">
                                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
                                            <button onClick={() => setExpanded(p => ({ ...p, [d.id]: !p[d.id] }))} className="text-slate-400">
                                                {expanded[d.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            </button>
                                            <span className="font-bold text-sm text-dark-blue flex-1">{d.title}</span>
                                            <span className="text-xs text-slate-400">{d.sections.filter(s => s.can_edit).length}/{d.sections.length}</span>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={allChecked}
                                                    ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                                                    onChange={() => toggleDocAll(d.id, !allChecked)}
                                                    className="w-4 h-4 accent-[#0056B3]" />
                                                <span className="text-xs font-bold text-slate-600">Све</span>
                                            </label>
                                        </div>
                                        {expanded[d.id] && (
                                            <div className="divide-y divide-slate-50">
                                                {d.sections.length === 0 ? (
                                                    <div className="text-xs text-slate-300 text-center py-3">Нема секција</div>
                                                ) : d.sections.map(s => (
                                                    <label key={s.id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-slate-50 cursor-pointer">
                                                        <input type="checkbox" checked={s.can_edit} onChange={() => toggleSection(d.id, s.id)} className="w-4 h-4 accent-[#0056B3]" />
                                                        <span className="text-xs font-bold text-slate-300 w-6">{s.order}.</span>
                                                        <span className="text-sm text-slate-700">{s.title}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-5 pt-5 border-t border-slate-100">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition">Откажи</button>
                    <button onClick={handleSave} disabled={saving || user.is_admin}
                        className="flex-1 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Сачувај привилегије
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main AdminPage ─────────────────────────────────────────────────────────────

const AdminPage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [stats, setStats] = useState<Stats | null>(null);
    const [documents, setDocuments] = useState<DocItem[]>([]);
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<TabKey>("documents");
    const [docType, setDocType] = useState<DocType>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [showNotifications, setShowNotifications] = useState(false);
    const [sectionsDoc, setSectionsDoc] = useState<DocItem | null>(null);
    const [editingUser, setEditingUser] = useState<UserItem | null>(null);
    const [permissionsUser, setPermissionsUser] = useState<UserItem | null>(null);

    const loadStats = useCallback(async () => {
        const { data } = await axiosClient.get("/api/admin/stats");
        setStats(data);
    }, []);

    const loadDocuments = useCallback(async (type: DocType) => {
        const params = type !== "all" ? `?type=${type}` : "";
        const { data } = await axiosClient.get(`/api/admin/documents${params}`);
        setDocuments(data.data);
    }, []);

    const loadUsers = useCallback(async () => {
        const { data } = await axiosClient.get("/api/admin/users");
        setUsers(data.data);
    }, []);

    // Ako trenutni korisnik nije admin, vrati ga na /panel
    useEffect(() => {
        if (user && !user.is_admin) {
            navigate('/panel');
        }
    }, [user, navigate]);

    useEffect(() => {
        if (user && !user.is_admin) { setLoading(false); return; }
        const init = async () => {
            try {
                await Promise.all([loadStats(), loadDocuments("all"), loadUsers()]);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [loadStats, loadDocuments, loadUsers]);

    const handleDocTypeChange = async (type: DocType) => {
        setDocType(type);
        await loadDocuments(type);
    };

    const handleCreateDocument = async (title: string, type: DocType) => {
        await axiosClient.post("/api/admin/documents", { title, type });
        setShowCreateModal(false);
        await Promise.all([loadStats(), loadDocuments(docType)]);
    };

    const handleDeleteDocument = async (id: number) => {
        if (!confirm("Da li ste sigurni da želite da obrišete ovaj dokument?")) return;
        await axiosClient.delete(`/api/admin/documents/${id}`);
        setOpenMenuId(null);
        await Promise.all([loadStats(), loadDocuments(docType)]);
    };

    const handleCreateUser = async (name: string, email: string, password: string, isAdmin: boolean): Promise<string | null> => {
        try {
            await axiosClient.post("/api/admin/users", { name, email, password, password_confirmation: password, is_admin: isAdmin });
            setShowCreateUserModal(false);
            await Promise.all([loadStats(), loadUsers()]);
            return null;
        } catch (err: any) {
            const errs = (err?.response?.data?.errors ?? {}) as Record<string, string[]>;
            const firstFieldErrors = Object.values(errs)[0];
            const msg = err?.response?.data?.message
                ?? firstFieldErrors?.[0]
                ?? "Greška pri kreiranju korisnika.";
            return msg as string;
        }
    };

    const handleUpdateUser = async (id: number, payload: any): Promise<string | null> => {
        try {
            await axiosClient.put(`/api/admin/users/${id}`, payload);
            setEditingUser(null);
            await loadUsers();
            return null;
        } catch (err: any) {
            const errs = (err?.response?.data?.errors ?? {}) as Record<string, string[]>;
            const firstFieldErrors = Object.values(errs)[0];
            return (err?.response?.data?.message ?? firstFieldErrors?.[0] ?? "Грешка при чувању.") as string;
        }
    };

    const handleDeleteUser = async (id: number) => {
        if (!confirm("Da li ste sigurni da želite da obrišete ovog korisnika?")) return;
        try {
            await axiosClient.delete(`/api/admin/users/${id}`);
            await Promise.all([loadStats(), loadUsers()]);
        } catch (err: any) {
            alert(err?.response?.data?.message ?? "Greška pri brisanju korisnika.");
        }
    };

    const handleOpenEditor = (_id: number) => {
        navigate("/panel");
    };

    const handleOpenView = (id: number) => {
        window.open(`/document/${id}/view`, "_blank");
    };

    const filteredDocuments = documents.filter(d =>
        d.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background-grey gap-4 text-slate-400">
                <Loader2 className="animate-spin text-blue-500" size={40} />
                <span className="font-semibold tracking-wider uppercase text-sm">Učitavanje...</span>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-background-grey font-sans text-dark-blue overflow-hidden">

            {/* ── Left sidebar ── */}
            <aside className="w-[220px] shrink-0 flex flex-col bg-white border-r border-slate-100 py-8 px-5">
                {/* Logo */}
                <div className="flex items-center gap-2 mb-10 px-1">
                    <img src={logo} alt="RATEL" className="h-7" />
                    <span className="font-extrabold text-[15px] uppercase tracking-wide text-dark-blue">RATEL</span>
                </div>

                {/* Nav */}
                <nav className="flex flex-col gap-1 flex-1">
                    {[
                        { key: "dashboard", label: "Преглед", icon: LayoutDashboard },
                        { key: "projects", label: "Пројекти", icon: FolderOpen },
                        { key: "users", label: "Корисници", icon: Users },
                        { key: "profile", label: "Профил", icon: UserCircle },
                    ].map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => {
                                if (key === "users") { setActiveTab("users"); }
                                else if (key === "projects") { setActiveTab("documents"); }
                            }}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                (key === "dashboard" && activeTab === "documents") ||
                                (key === "projects" && activeTab === "documents") ||
                                (key === "users" && activeTab === "users")
                                    ? "bg-[#EBF2FB] text-[#0056B3]"
                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            }`}
                        >
                            <Icon size={18} />
                            {label}
                        </button>
                    ))}
                </nav>

                {/* Logout */}
                <button
                    onClick={async () => { await logout(); navigate("/login"); }}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                    <X size={18} />
                    Одјава
                </button>
            </aside>

            {/* ── Main ── */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* ── Top bar ── */}
                <header className="h-20 shrink-0 flex items-center justify-between px-8 bg-background-grey">
                    {/* Search */}
                    <div className="flex items-center gap-3 bg-white rounded-[50px] py-[10px] px-[20px] border border-slate-100 shadow-sm w-72">
                        <Search size={16} className="text-slate-400 shrink-0" />
                        <input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Претрага..."
                            className="bg-transparent text-sm outline-none w-full placeholder:text-slate-300"
                        />
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-3">
                        {/* Notifications bell */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(v => !v)}
                                className="flex items-center gap-2 bg-white rounded-[50px] py-[10px] px-[20px] border border-slate-100 shadow-sm text-sm font-bold"
                            >
                                <Bell size={16} className="text-slate-600" />
                                <span className="text-slate-500">Данас</span>
                                <ChevronDown size={14} className="text-slate-400" />
                            </button>
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                                        <span className="font-extrabold text-sm">Нотификације</span>
                                        <button onClick={() => setShowNotifications(false)}>
                                            <X size={16} className="text-slate-400" />
                                        </button>
                                    </div>
                                    <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                                        {documents.slice(0, 4).map(doc => (
                                            <div key={doc.id} className="px-5 py-3.5 flex gap-3 items-start hover:bg-slate-50 transition">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                                                    <FileText size={14} className="text-blue-500" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-dark-blue leading-snug">{doc.title}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">{timeAgo(doc.updated_at)}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {documents.length === 0 && (
                                            <div className="px-5 py-6 text-center text-sm text-slate-400">Нема нотификација</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* User chip */}
                        <div className="flex items-center gap-3 bg-white rounded-[50px] py-[10px] px-[20px] border border-slate-100 shadow-sm">
                            <div className="w-7 h-7 rounded-full bg-[#0056B3] flex items-center justify-center text-white text-xs font-extrabold">
                                {user?.name?.[0]?.toUpperCase() ?? "A"}
                            </div>
                            <span className="font-extrabold text-[13px] uppercase tracking-wide">{user?.name ?? "АДМИН"}</span>
                        </div>
                    </div>
                </header>

                {/* ── Content ── */}
                <main className="flex-1 overflow-y-auto px-8 pb-8">

                    {/* Page title + date */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="font-extrabold text-xl text-dark-blue">Данашњи преглед</h1>
                            <p className="text-sm text-slate-400 mt-0.5">
                                {new Date().toLocaleDateString("sr-RS", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                            </p>
                        </div>
                        {activeTab === "users" ? (
                            <button
                                onClick={() => setShowCreateUserModal(true)}
                                className="flex items-center gap-2 bg-[#0056B3] text-white rounded-[50px] py-[10px] px-[20px] text-sm font-bold shadow-sm hover:bg-blue-700 transition"
                            >
                                <Plus size={16} />
                                Нови корисник
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 bg-[#0056B3] text-white rounded-[50px] py-[10px] px-[20px] text-sm font-bold shadow-sm hover:bg-blue-700 transition"
                            >
                                <Plus size={16} />
                                Нови документ
                            </button>
                        )}
                    </div>

                    {/* ── Metric cards ── */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        {[
                            {
                                label: "Број пројеката",
                                value: stats?.total_documents ?? 0,
                                icon: FolderOpen,
                                color: "text-blue-500",
                                bg: "bg-blue-50",
                            },
                            {
                                label: "Активни корисници",
                                value: stats?.total_users ?? 0,
                                icon: Users,
                                color: "text-green-500",
                                bg: "bg-green-50",
                            },
                            {
                                label: "Пројекти у изради",
                                value: stats?.in_progress ?? 0,
                                icon: TrendingUp,
                                color: "text-orange-500",
                                bg: "bg-orange-50",
                            },
                            {
                                label: "Последња активност",
                                value: timeAgo(stats?.last_activity ?? null),
                                icon: Clock,
                                color: "text-purple-500",
                                bg: "bg-purple-50",
                                isText: true,
                            },
                        ].map(({ label, value, icon: Icon, color, bg, isText }) => (
                            <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center shrink-0`}>
                                    <Icon size={22} className={color} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</p>
                                    <p className={`font-extrabold mt-0.5 ${isText ? "text-base" : "text-2xl"} text-dark-blue`}>{value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Tabs: Документи / Корисници ── */}
                    <div className="flex items-center gap-1 bg-white rounded-[50px] px-2 py-1.5 border border-slate-100 shadow-sm w-fit mb-5">
                        {(["documents", "users"] as TabKey[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
                                    activeTab === tab
                                        ? "bg-[#0056B3] text-white shadow-sm"
                                        : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                                {tab === "documents" ? "Пројекти" : "Корисници"}
                            </button>
                        ))}
                    </div>

                    {/* ── Documents tab ── */}
                    {activeTab === "documents" && (
                        <>
                            {/* Sub-tabs */}
                            <div className="flex items-center gap-1 bg-white rounded-[50px] px-2 py-1.5 border border-slate-100 shadow-sm w-fit mb-5">
                                {(Object.keys(TYPE_LABELS) as DocType[]).map(t => (
                                    <button
                                        key={t}
                                        onClick={() => handleDocTypeChange(t)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                                            docType === t
                                                ? "bg-[#EBF2FB] text-[#0056B3]"
                                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                        }`}
                                    >
                                        {TYPE_LABELS[t]}
                                    </button>
                                ))}
                            </div>

                            {/* Document grid */}
                            {filteredDocuments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-300 gap-3">
                                    <AlertCircle size={40} />
                                    <span className="text-sm font-semibold">Нема пројеката</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-4">
                                    {filteredDocuments.map(doc => {
                                        const statusInfo = STATUS_LABELS[doc.status] ?? STATUS_LABELS.draft;
                                        return (
                                            <div key={doc.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                                                {/* Thumbnail area */}
                                                <div
                                                    className="h-36 bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center cursor-pointer relative"
                                                    onClick={() => handleOpenView(doc.id)}
                                                >
                                                    <div className="w-16 h-20 bg-white rounded shadow-md flex items-center justify-center border border-slate-100">
                                                        <FileText size={28} className="text-blue-200" />
                                                    </div>
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <div className="bg-white rounded-full px-3 py-1.5 text-xs font-bold text-dark-blue shadow flex items-center gap-1.5">
                                                            <Eye size={12} />
                                                            Преглед
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card body */}
                                                <div className="p-4">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-extrabold text-sm text-dark-blue truncate">{doc.title}</h3>
                                                            <p className="text-xs text-slate-400 mt-0.5">{TYPE_LABELS[doc.type as DocType] ?? doc.type}</p>
                                                        </div>
                                                        <div className="relative shrink-0">
                                                            <button
                                                                onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                                                                className="p-1.5 rounded-lg hover:bg-slate-100 transition"
                                                            >
                                                                <MoreHorizontal size={16} className="text-slate-400" />
                                                            </button>
                                                            {openMenuId === doc.id && (
                                                                <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                                                                    <button onClick={() => { handleOpenEditor(doc.id); setOpenMenuId(null); }}
                                                                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition">
                                                                        <PenLine size={14} className="text-blue-500" /> Уреди
                                                                    </button>
                                                                    <button onClick={() => { handleOpenView(doc.id); setOpenMenuId(null); }}
                                                                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition">
                                                                        <Eye size={14} className="text-slate-500" /> Преглед
                                                                    </button>
                                                                    <button onClick={() => { setSectionsDoc(doc); setOpenMenuId(null); }}
                                                                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition">
                                                                        <FileStack size={14} className="text-blue-500" /> Секције ({doc.sections_count})
                                                                    </button>
                                                                    <button onClick={() => handleDeleteDocument(doc.id)}
                                                                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition">
                                                                        <Trash2 size={14} /> Обриши
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-3">
                                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                                                            {statusInfo.label}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400">{fmtDate(doc.updated_at)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* ── Users tab ── */}
                    {activeTab === "users" && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="text-left px-6 py-4 font-bold text-xs uppercase tracking-wide text-slate-400">Корисник</th>
                                        <th className="text-left px-6 py-4 font-bold text-xs uppercase tracking-wide text-slate-400">Е-пошта</th>
                                        <th className="text-left px-6 py-4 font-bold text-xs uppercase tracking-wide text-slate-400">Улога</th>
                                        <th className="text-left px-6 py-4 font-bold text-xs uppercase tracking-wide text-slate-400">Регистрован</th>
                                        <th className="px-6 py-4" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12 text-slate-300 text-sm font-semibold">
                                                Нема корисника
                                            </td>
                                        </tr>
                                    ) : filteredUsers.map(u => (
                                        <tr key={u.id} className="hover:bg-slate-50 transition group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[#0056B3] flex items-center justify-center text-white text-xs font-extrabold shrink-0">
                                                        {u.name[0]?.toUpperCase()}
                                                    </div>
                                                    <span className="font-bold text-dark-blue">{u.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500">{u.email}</td>
                                            <td className="px-6 py-4">
                                                {u.is_admin ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-[#0056B3] text-[10px] font-bold uppercase tracking-wide">
                                                        <ShieldCheck size={12} /> Админ
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wide">
                                                        Уредник
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400">{fmtDate(u.created_at)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => setPermissionsUser(u)} title="Привилегије"
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-[#0056B3] hover:bg-blue-50 transition-all">
                                                        <KeyRound size={15} />
                                                    </button>
                                                    <button onClick={() => setEditingUser(u)} title="Уреди"
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-[#0056B3] hover:bg-blue-50 transition-all">
                                                        <PenLine size={15} />
                                                    </button>
                                                    <button onClick={() => handleDeleteUser(u.id)} title="Обриши"
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </main>
            </div>

            {/* ── Create document modal ── */}
            {showCreateModal && (
                <CreateModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateDocument} />
            )}

            {/* ── Create user modal ── */}
            {showCreateUserModal && (
                <CreateUserModal onClose={() => setShowCreateUserModal(false)} onCreate={handleCreateUser} />
            )}

            {/* ── Edit user modal ── */}
            {editingUser && (
                <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleUpdateUser} />
            )}

            {/* ── Sections modal ── */}
            {sectionsDoc && (
                <SectionsModal doc={sectionsDoc} onClose={() => { setSectionsDoc(null); loadDocuments(docType); }} />
            )}

            {/* ── Permissions modal ── */}
            {permissionsUser && (
                <PermissionsModal user={permissionsUser} onClose={() => setPermissionsUser(null)} />
            )}

            {/* ── Close menus on outside click ── */}
            {(openMenuId !== null || showNotifications) && (
                <div className="fixed inset-0 z-10" onClick={() => { setOpenMenuId(null); setShowNotifications(false); }} />
            )}
        </div>
    );
};

export default AdminPage;
