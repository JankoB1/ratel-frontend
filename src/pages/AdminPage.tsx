import { useEffect, useState, useCallback, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
    LayoutDashboard, FolderOpen, Users, Bell, Search,
    ChevronDown, Plus, MoreHorizontal, FileText, Loader2, Trash2,
    PenLine, Eye, TrendingUp, Clock, AlertCircle, X, Check,
    ShieldCheck, FileStack, ChevronUp, KeyRound, Tag, Activity
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import axiosClient from "../axios-client";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/logo.svg";
import InboxBadge from "../components/InboxBadge";

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
    category_id: number | null;
    category: { id: number; name: string; slug: string; color: string; icon: string | null } | null;
    sections_count: number;
    updated_at: string;
    created_at: string;
}

interface Category {
    id: number;
    name: string;
    slug: string;
    color: string;
    icon: string | null;
    order: number;
    documents_count?: number;
}

interface ActivityData {
    by_month: { month: string; count: number }[];
    recent: { id: number; section_title: string; updated_at: string; document_id: number; document_title: string }[];
}

type UserRole = 'editor' | 'rukovodilac' | 'direktor' | 'kabinet' | null;

interface UserItem {
    id: number;
    name: string;
    email: string;
    is_admin: boolean;
    role: UserRole;
    created_at: string;
}

const ROLE_OPTIONS: { value: Exclude<UserRole, null>; label: string }[] = [
    { value: 'editor',      label: 'Уредник' },
    { value: 'rukovodilac', label: 'Руководилац' },
    { value: 'direktor',    label: 'Директор' },
    { value: 'kabinet',     label: 'Кабинет' },
];

const ROLE_LABEL_MAP: Record<string, string> = {
    editor: 'Уредник',
    rukovodilac: 'Руководилац',
    direktor: 'Директор',
    kabinet: 'Кабинет',
};

const roleLabel = (role: UserRole) => role ? (ROLE_LABEL_MAP[role] ?? role) : 'Без улоге';

const permissionLabelForRole = (role: UserRole, isAdmin: boolean): string => {
    if (isAdmin) return 'Администратор — приступ свим секцијама';
    if (role === 'editor') return 'Уредник — секције које сме да едитује';
    if (role === 'rukovodilac') return 'Руководилац — секције које сме да одобри';
    if (role === 'direktor')    return 'Директор — секције које сме да одобри';
    if (role === 'kabinet')     return 'Кабинет — секције које сме да одобри';
    return 'Корисник нема улогу — додели улогу да би могао нешто да ради са секцијама';
};

interface ApprovalStage {
    name: string;
    at: string;
}
interface SectionApprovalRow {
    id: number;
    title: string;
    order: number;
    is_disabled: boolean;
    status: string;
    submitted:   ApprovalStage | null;
    rukovodilac: ApprovalStage | null;
    direktor:    ApprovalStage | null;
    kabinet:     ApprovalStage | null;
    admin:       ApprovalStage | null;
    rejected:    (ApprovalStage & { reason: string | null }) | null;
}

const APPROVAL_STATUS_BADGE: Record<string, { label: string; color: string }> = {
    draft:                { label: 'У изради',              color: 'bg-slate-100 text-slate-600' },
    pending_rukovodilac:  { label: 'Чека руководиоца',      color: 'bg-purple-100 text-purple-700' },
    pending_direktor:     { label: 'Чека директора',        color: 'bg-amber-100 text-amber-700' },
    pending_kabinet:      { label: 'Чека кабинет',          color: 'bg-emerald-100 text-emerald-700' },
    pending_admin:        { label: 'Чека админа',           color: 'bg-blue-100 text-blue-700' },
    approved:             { label: 'Одобрено',              color: 'bg-green-100 text-green-700' },
    rejected:             { label: 'Одбијено',              color: 'bg-red-100 text-red-700' },
};

const fmtStageDate = (iso: string) => new Date(iso).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

const ApprovalCell = ({ stage }: { stage: ApprovalStage | null }) => {
    if (!stage) return <span className="text-slate-300 text-xs">—</span>;
    return (
        <span title={`${stage.name} • ${fmtStageDate(stage.at)}`} className="inline-flex items-center gap-1 text-xs">
            <Check size={12} className="text-green-600 shrink-0" />
            <span className="font-bold text-slate-700 truncate max-w-[100px]">{stage.name}</span>
        </span>
    );
};

interface UserPermissionDoc {
    id: number;
    title: string;
    type: string;
    sections: { id: number; title: string; order: number; can_edit: boolean }[];
}

type TabKey = "dashboard" | "documents" | "approvals" | "users";

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
    categories: Category[];
    onClose: () => void;
    onCreate: (title: string, categoryId: number) => Promise<void>;
}

const CreateModal = ({ categories, onClose, onCreate }: CreateModalProps) => {
    const [title, setTitle] = useState("");
    const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !categoryId) return;
        setSaving(true);
        await onCreate(title.trim(), categoryId);
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
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Категорија</label>
                        {categories.length === 0 ? (
                            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                Нема категорија. Прво направите категорију кроз управљачку секцију.
                            </div>
                        ) : (
                            <select
                                value={categoryId ?? ''}
                                onChange={e => setCategoryId(Number(e.target.value))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition bg-white"
                            >
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div className="flex gap-3 mt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition">
                            Otkaži
                        </button>
                        <button type="submit" disabled={!title.trim() || !categoryId || saving}
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
    onCreate: (name: string, email: string, password: string, isAdmin: boolean, role: UserRole) => Promise<string | null>;
}

const CreateUserModal = ({ onClose, onCreate }: CreateUserModalProps) => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
    const [role, setRole] = useState<UserRole>('editor');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password !== passwordConfirmation) { setError("Lozinke se ne podudaraju."); return; }
        setSaving(true);
        const err = await onCreate(name.trim(), email.trim(), password, isAdmin, isAdmin ? null : role);
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
                    {!isAdmin && (
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Улога</label>
                            <select value={role ?? ''} onChange={e => setRole(e.target.value as UserRole)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition bg-white">
                                <option value="">— без улоге —</option>
                                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    )}
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
    onSave: (id: number, payload: { name?: string; email?: string; password?: string; is_admin?: boolean; role?: UserRole }) => Promise<string | null>;
}

const EditUserModal = ({ user, onClose, onSave }: EditUserModalProps) => {
    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [isAdmin, setIsAdmin] = useState(user.is_admin);
    const [role, setRole] = useState<UserRole>(user.role ?? null);
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
        const newRole = isAdmin ? null : role; // admin nema dodatnu rolu
        if (newRole !== (user.role ?? null)) payload.role = newRole;
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
                    {!isAdmin && (
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Улога</label>
                            <select value={role ?? ''} onChange={e => setRole(e.target.value === '' ? null : (e.target.value as UserRole))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition bg-white">
                                <option value="">— без улоге —</option>
                                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
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
    const [sections, setSections] = useState<SectionApprovalRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTitle, setNewTitle] = useState("");
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosClient.get(`/api/admin/documents/${doc.id}/approvals`);
            setSections(data.sections || []);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-6xl max-h-[90vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
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

                <div className="flex-1 overflow-auto mt-5 -mx-2 px-2">
                    {loading ? (
                        <div className="flex justify-center py-12 text-slate-300"><Loader2 className="animate-spin" /></div>
                    ) : sections.length === 0 ? (
                        <div className="text-center py-12 text-slate-300 text-sm font-semibold">Нема секција</div>
                    ) : (
                        <table className="w-full text-sm border-separate border-spacing-0">
                            <thead>
                                <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    <th className="px-2 py-2 w-8"></th>
                                    <th className="px-2 py-2">Секција</th>
                                    <th className="px-2 py-2">Статус</th>
                                    <th className="px-2 py-2">Уредник</th>
                                    <th className="px-2 py-2">Руководилац</th>
                                    <th className="px-2 py-2">Директор</th>
                                    <th className="px-2 py-2">Кабинет</th>
                                    <th className="px-2 py-2">Админ</th>
                                    <th className="px-2 py-2 w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {sections.map((s, idx) => {
                                    const badge = APPROVAL_STATUS_BADGE[s.status] ?? APPROVAL_STATUS_BADGE.draft;
                                    return (
                                        <ApprovalSectionRow
                                            key={s.id} section={s} idx={idx} total={sections.length} badge={badge}
                                            onRename={(t: string) => handleRename(s.id, t)}
                                            onDelete={() => handleDelete(s.id)}
                                            onMoveUp={() => handleMove(s.id, 'up')}
                                            onMoveDown={() => handleMove(s.id, 'down')}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

const ApprovalSectionRow = ({ section, idx, total, badge, onRename, onDelete, onMoveUp, onMoveDown }: any) => {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(section.title);
    const handleSave = async () => {
        if (title.trim() && title.trim() !== section.title) await onRename(title.trim());
        setEditing(false);
    };
    return (
        <tr className="hover:bg-slate-50 transition group">
            <td className="px-2 py-3 align-top">
                <div className="flex flex-col gap-0.5">
                    <button onClick={onMoveUp} disabled={idx === 0} className="p-0.5 text-slate-300 hover:text-[#0056B3] disabled:opacity-30 disabled:cursor-not-allowed"><ChevronUp size={12} /></button>
                    <button onClick={onMoveDown} disabled={idx === total - 1} className="p-0.5 text-slate-300 hover:text-[#0056B3] disabled:opacity-30 disabled:cursor-not-allowed"><ChevronDown size={12} /></button>
                </div>
            </td>
            <td className="px-2 py-3 align-top">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-300 w-4">{section.order}.</span>
                    {editing ? (
                        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} onBlur={handleSave}
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                            className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm outline-none" />
                    ) : (
                        <span onClick={() => setEditing(true)} className="text-sm font-bold text-dark-blue cursor-text truncate max-w-[200px]" title={section.title}>{section.title}</span>
                    )}
                </div>
            </td>
            <td className="px-2 py-3 align-top">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${badge.color}`}
                    title={section.rejected ? `Одбио: ${section.rejected.name}\nРазлог: ${section.rejected.reason}` : ''}>
                    {badge.label}
                </span>
            </td>
            <td className="px-2 py-3 align-top"><ApprovalCell stage={section.submitted} /></td>
            <td className="px-2 py-3 align-top"><ApprovalCell stage={section.rukovodilac} /></td>
            <td className="px-2 py-3 align-top"><ApprovalCell stage={section.direktor} /></td>
            <td className="px-2 py-3 align-top"><ApprovalCell stage={section.kabinet} /></td>
            <td className="px-2 py-3 align-top"><ApprovalCell stage={section.admin} /></td>
            <td className="px-2 py-3 align-top text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-[#0056B3] hover:bg-blue-50"><PenLine size={13} /></button>
                    <button onClick={onDelete} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                </div>
            </td>
        </tr>
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
                        <h2 className="font-extrabold text-lg text-dark-blue flex items-center gap-2"><KeyRound size={20} className="text-[#0056B3]" /> {user.is_admin ? 'Привилегије' : `Додели секције — ${roleLabel(user.role)}`}</h2>
                        <p className="text-sm text-slate-400 mt-0.5">{user.name} — {user.email}</p>
                        {!user.is_admin && (
                            <p className="text-xs text-slate-500 mt-1.5 italic">{permissionLabelForRole(user.role, false)}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                {user.is_admin && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 font-semibold mb-4 flex items-center gap-2">
                        <ShieldCheck size={14} /> Овај корисник је администратор — има пуни приступ свим секцијама и одобрава последњи у току прегледа.
                    </div>
                )}

                {!user.is_admin && !user.role && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 font-semibold mb-4 flex items-center gap-2">
                        <AlertCircle size={14} /> Овом кориснику још увек није додељена улога. Додели улогу у „Уреди корисника" пре него што му додаш секције.
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

// ── Dashboard View ───────────────────────────────────────────────────────────

const MONTH_LABELS_SR = ['Јан', 'Феб', 'Мар', 'Апр', 'Мај', 'Јун', 'Јул', 'Авг', 'Сеп', 'Окт', 'Нов', 'Дец'];

const DashboardView = ({ activity, categories }: { activity: ActivityData | null; categories: Category[] }) => {
    const chartData = (activity?.by_month ?? []).map(m => {
        const [y, mm] = m.month.split('-');
        return { name: MONTH_LABELS_SR[Number(mm) - 1] + ' ' + y.slice(-2), count: m.count };
    });

    return (
        <div className="grid grid-cols-3 gap-6">
            {/* Activity chart (2 cols) */}
            <div className="col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Activity size={18} className="text-[#0056B3]" />
                    <h3 className="font-bold text-sm text-dark-blue">Активност — креирани документи по месецима</h3>
                </div>
                <div style={{ width: '100%', height: 280 }}>
                    {activity ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }} />
                                <Line type="monotone" dataKey="count" stroke="#0056B3" strokeWidth={3} dot={{ r: 4, fill: '#0056B3' }} activeDot={{ r: 6 }} isAnimationActive={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-300"><Loader2 className="animate-spin" /></div>
                    )}
                </div>
            </div>

            {/* Categories overview */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Tag size={18} className="text-[#0056B3]" />
                    <h3 className="font-bold text-sm text-dark-blue">Категорије</h3>
                </div>
                <div className="flex flex-col gap-2">
                    {categories.length === 0 ? (
                        <div className="text-xs text-slate-300 text-center py-6">Нема категорија</div>
                    ) : categories.map(c => (
                        <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                            <span className="text-xs font-semibold text-dark-blue flex-1 truncate">{c.name}</span>
                            <span className="text-xs font-bold text-slate-400">{c.documents_count ?? 0}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent activity timeline (3 cols) */}
            <div className="col-span-3 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Clock size={18} className="text-[#0056B3]" />
                    <h3 className="font-bold text-sm text-dark-blue">Последње измене (секције)</h3>
                </div>
                {!activity ? (
                    <div className="flex justify-center py-8 text-slate-300"><Loader2 className="animate-spin" /></div>
                ) : activity.recent.length === 0 ? (
                    <div className="text-center py-8 text-slate-300 text-sm">Нема скоријих измена</div>
                ) : (
                    <div className="flex flex-col">
                        {activity.recent.map((r, i) => (
                            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                    <FileStack size={14} className="text-[#0056B3]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-dark-blue truncate">{r.section_title || 'Без наслова'}</p>
                                    <p className="text-xs text-slate-400 truncate">у {r.document_title}</p>
                                </div>
                                <span className="text-xs text-slate-400 whitespace-nowrap">{timeAgo(r.updated_at)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Categories Manager ───────────────────────────────────────────────────────

interface CategoriesManagerProps {
    onClose: () => void;
    onChange: () => void;
}

const CategoriesManager = ({ onClose, onChange }: CategoriesManagerProps) => {
    const [cats, setCats] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState("#0056B3");
    const [adding, setAdding] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosClient.get("/api/admin/categories");
            setCats(data.data);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setAdding(true);
        try {
            await axiosClient.post("/api/admin/categories", { name: newName.trim(), color: newColor });
            setNewName(""); setNewColor("#0056B3");
            await load();
            onChange();
        } finally {
            setAdding(false);
        }
    };

    const handleUpdate = async (id: number, payload: any) => {
        await axiosClient.put(`/api/admin/categories/${id}`, payload);
        await load();
        onChange();
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Obrisati kategoriju? Ne mogu se obrisati kategorije sa dokumentima.")) return;
        try {
            await axiosClient.delete(`/api/admin/categories/${id}`);
            await load();
            onChange();
        } catch (err: any) {
            alert(err?.response?.data?.message ?? "Грешка при брисању.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                    <h2 className="font-extrabold text-lg text-dark-blue flex items-center gap-2"><Tag size={20} className="text-[#0056B3]" /> Категорије пројеката</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                <form onSubmit={handleAdd} className="flex gap-2 mt-5">
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Назив нове категорије..."
                        className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                        className="w-12 h-10 border border-slate-200 rounded-xl cursor-pointer" title="Боја" />
                    <button type="submit" disabled={!newName.trim() || adding}
                        className="px-5 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center gap-2">
                        {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Додај
                    </button>
                </form>

                <div className="flex-1 overflow-y-auto mt-5 -mx-2 px-2">
                    {loading ? (
                        <div className="flex justify-center py-12 text-slate-300"><Loader2 className="animate-spin" /></div>
                    ) : cats.length === 0 ? (
                        <div className="text-center py-12 text-slate-300 text-sm font-semibold">Нема категорија</div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {cats.map(c => (
                                <CategoryRow key={c.id} cat={c} onUpdate={(payload) => handleUpdate(c.id, payload)} onDelete={() => handleDelete(c.id)} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CategoryRow = ({ cat, onUpdate, onDelete }: { cat: Category; onUpdate: (p: any) => void; onDelete: () => void }) => {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(cat.name);
    const [color, setColor] = useState(cat.color);

    const save = () => {
        const changes: any = {};
        if (name.trim() && name.trim() !== cat.name) changes.name = name.trim();
        if (color !== cat.color) changes.color = color;
        if (Object.keys(changes).length > 0) onUpdate(changes);
        setEditing(false);
    };

    return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition group">
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
            {editing ? (
                <>
                    <input value={name} onChange={e => setName(e.target.value)}
                        className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-sm outline-none" />
                    <input type="color" value={color} onChange={e => setColor(e.target.value)}
                        className="w-10 h-8 border border-slate-200 rounded cursor-pointer" />
                    <button onClick={save} className="p-1.5 rounded-lg text-green-500 hover:bg-green-50"><Check size={14} /></button>
                    <button onClick={() => { setEditing(false); setName(cat.name); setColor(cat.color); }} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={14} /></button>
                </>
            ) : (
                <>
                    <span className="flex-1 text-sm font-bold text-dark-blue">{cat.name}</span>
                    <span className="text-xs text-slate-400">{cat.documents_count ?? 0} док.</span>
                    <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-[#0056B3] hover:bg-blue-50 transition-all"><PenLine size={14} /></button>
                    <button onClick={onDelete} disabled={(cat.documents_count ?? 0) > 0} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed" title={(cat.documents_count ?? 0) > 0 ? 'Има везаних докумената' : 'Обриши'}><Trash2 size={14} /></button>
                </>
            )}
        </div>
    );
};

// ── Portal Dropdown (rendruje meni kroz body, ne biva isečen overflow-om) ────

const PortalDropdown = ({ anchorRef, open, onClose, children }: { anchorRef: React.RefObject<HTMLElement | null>; open: boolean; onClose: () => void; children: React.ReactNode }) => {
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const menuRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        if (!open || !anchorRef.current) return;
        const r = anchorRef.current.getBoundingClientRect();
        const menuWidth = 192; // w-48
        const left = Math.max(8, Math.min(r.right - menuWidth, window.innerWidth - menuWidth - 8));
        const top = r.bottom + 4;
        setPos({ top, left });
    }, [open, anchorRef]);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => {
            const t = e.target as Node;
            if (anchorRef.current?.contains(t)) return;
            if (menuRef.current?.contains(t)) return;
            onClose();
        };
        const timer = setTimeout(() => document.addEventListener('mousedown', close), 0);
        return () => { clearTimeout(timer); document.removeEventListener('mousedown', close); };
    }, [open, onClose, anchorRef]);

    if (!open) return null;
    return createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 2147483647 }} className="w-48 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden">
            {children}
        </div>,
        document.body
    );
};

// ── Doc card kebab menu (...) ────────────────────────────────────────────────

interface DocCardMenuProps {
    onEdit: () => void;
    onView: () => void;
    onSections: () => void;
    onDelete: () => void;
    sectionsCount: number;
}

const DocCardMenu = ({ onEdit, onView, onSections, onDelete, sectionsCount }: DocCardMenuProps) => {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);

    const close = () => setOpen(false);

    return (
        <div className="shrink-0">
            <button
                ref={btnRef}
                onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition"
            >
                <MoreHorizontal size={16} className="text-slate-400" />
            </button>
            <PortalDropdown anchorRef={btnRef} open={open} onClose={close}>
                <button onClick={() => { close(); onEdit(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition">
                    <PenLine size={14} className="text-blue-500" /> Уреди
                </button>
                <button onClick={() => { close(); onView(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition">
                    <Eye size={14} className="text-slate-500" /> Преглед
                </button>
                <button onClick={() => { close(); onSections(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition">
                    <FileStack size={14} className="text-blue-500" /> Секције ({sectionsCount})
                </button>
                <button onClick={() => { close(); onDelete(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition">
                    <Trash2 size={14} /> Обриши
                </button>
            </PortalDropdown>
        </div>
    );
};

// ── Approvals Overview ─────────────────────────────────────────────────────────

interface ApprovalsOverviewProps {
    documents: DocItem[];
}

const ApprovalsOverview = ({ documents }: ApprovalsOverviewProps) => {
    const [selectedDocId, setSelectedDocId] = useState<number | null>(documents[0]?.id ?? null);
    const [sections, setSections] = useState<SectionApprovalRow[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedDocId) { setSections([]); return; }
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const { data } = await axiosClient.get(`/api/admin/documents/${selectedDocId}/approvals`);
                if (!cancelled) setSections(data.sections || []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [selectedDocId]);

    if (documents.length === 0) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 px-10 py-16 text-center text-sm text-slate-400">
                Нема докумената. Креирај прво документ у „Пројекти".
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Document selector */}
            <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center gap-4">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Документ:</label>
                <select value={selectedDocId ?? ''} onChange={e => setSelectedDocId(e.target.value ? Number(e.target.value) : null)}
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] bg-white">
                    {documents.map(d => (
                        <option key={d.id} value={d.id}>{d.title} ({d.sections_count} секција)</option>
                    ))}
                </select>
            </div>

            {/* Matrix */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16 text-slate-300"><Loader2 className="animate-spin" size={28} /></div>
                ) : sections.length === 0 ? (
                    <div className="text-center py-16 text-sm text-slate-400">Овај документ нема секција.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    <th className="px-5 py-4">Секција</th>
                                    <th className="px-3 py-4">Статус</th>
                                    <th className="px-3 py-4">Уредник</th>
                                    <th className="px-3 py-4">Руководилац</th>
                                    <th className="px-3 py-4">Директор</th>
                                    <th className="px-3 py-4">Кабинет</th>
                                    <th className="px-3 py-4">Админ</th>
                                    <th className="px-3 py-4 w-24"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {sections.map(s => {
                                    const badge = APPROVAL_STATUS_BADGE[s.status] ?? APPROVAL_STATUS_BADGE.draft;
                                    return (
                                        <tr key={s.id} className="hover:bg-slate-50 transition">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-300 w-5">{s.order}.</span>
                                                    <span className="font-bold text-dark-blue text-sm truncate max-w-[260px]" title={s.title}>{s.title}</span>
                                                </div>
                                                {s.rejected && (
                                                    <div className="text-[11px] text-red-600 mt-1 italic max-w-[300px] truncate" title={s.rejected.reason ?? ''}>
                                                        Одбио {s.rejected.name}: „{s.rejected.reason}"
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-4">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${badge.color}`}>
                                                    {badge.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4"><ApprovalCell stage={s.submitted} /></td>
                                            <td className="px-3 py-4"><ApprovalCell stage={s.rukovodilac} /></td>
                                            <td className="px-3 py-4"><ApprovalCell stage={s.direktor} /></td>
                                            <td className="px-3 py-4"><ApprovalCell stage={s.kabinet} /></td>
                                            <td className="px-3 py-4"><ApprovalCell stage={s.admin} /></td>
                                            <td className="px-3 py-4 text-right">
                                                <a href={`/panel/${selectedDocId}?section=${s.id}`}
                                                    className="text-xs font-bold text-[#0056B3] hover:underline whitespace-nowrap">
                                                    Отвори →
                                                </a>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
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

    const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryFilter, setCategoryFilter] = useState<number | "all">("all");
    const [activity, setActivity] = useState<ActivityData | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [showCategoriesManager, setShowCategoriesManager] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [sectionsDoc, setSectionsDoc] = useState<DocItem | null>(null);
    const [editingUser, setEditingUser] = useState<UserItem | null>(null);
    const [permissionsUser, setPermissionsUser] = useState<UserItem | null>(null);

    const loadStats = useCallback(async () => {
        const { data } = await axiosClient.get("/api/admin/stats");
        setStats(data);
    }, []);

    const loadActivity = useCallback(async () => {
        const { data } = await axiosClient.get("/api/admin/stats/activity");
        setActivity(data);
    }, []);

    const loadDocuments = useCallback(async (cat: number | "all") => {
        const params = cat !== "all" ? `?category_id=${cat}` : "";
        const { data } = await axiosClient.get(`/api/admin/documents${params}`);
        setDocuments(data.data);
    }, []);

    const loadUsers = useCallback(async () => {
        const { data } = await axiosClient.get("/api/admin/users");
        setUsers(data.data);
    }, []);

    const loadCategories = useCallback(async () => {
        const { data } = await axiosClient.get("/api/admin/categories");
        setCategories(data.data);
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
                await Promise.all([loadStats(), loadDocuments("all"), loadUsers(), loadCategories(), loadActivity()]);
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [loadStats, loadDocuments, loadUsers, loadCategories, loadActivity]);

    const handleCategoryFilter = async (cat: number | "all") => {
        setCategoryFilter(cat);
        await loadDocuments(cat);
    };

    const handleCreateDocument = async (title: string, categoryId: number) => {
        await axiosClient.post("/api/admin/documents", { title, category_id: categoryId });
        setShowCreateModal(false);
        await Promise.all([loadStats(), loadDocuments(categoryFilter), loadCategories()]);
    };

    const handleDeleteDocument = async (id: number) => {
        if (!confirm("Da li ste sigurni da želite da obrišete ovaj dokument?")) return;
        await axiosClient.delete(`/api/admin/documents/${id}`);
        await Promise.all([loadStats(), loadDocuments(categoryFilter), loadCategories()]);
    };

    const handleCreateUser = async (name: string, email: string, password: string, isAdmin: boolean, role: UserRole): Promise<string | null> => {
        try {
            await axiosClient.post("/api/admin/users", { name, email, password, password_confirmation: password, is_admin: isAdmin, role });
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
                        { key: "dashboard" as TabKey, label: "Преглед", icon: LayoutDashboard },
                        { key: "documents" as TabKey, label: "Пројекти", icon: FolderOpen },
                        { key: "approvals" as TabKey, label: "Одобравања", icon: ShieldCheck },
                        { key: "users" as TabKey, label: "Корисници", icon: Users },
                    ].map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                activeTab === key
                                    ? "bg-[#EBF2FB] text-[#0056B3]"
                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            }`}
                        >
                            <Icon size={18} />
                            {label}
                        </button>
                    ))}

                    <button
                        onClick={() => setShowCategoriesManager(true)}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-[#0056B3] hover:bg-slate-50 transition-all mt-1"
                    >
                        <Tag size={18} />
                        Категорије
                    </button>
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
                        <div className="bg-white rounded-[50px] py-[5px] px-[10px] border border-slate-100 shadow-sm">
                            <InboxBadge />
                        </div>

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
                            <h1 className="font-extrabold text-xl text-dark-blue">
                                {activeTab === "dashboard" ? "Преглед" :
                                 activeTab === "users"     ? "Корисници" :
                                 activeTab === "approvals" ? "Одобравања по документу" :
                                                             "Пројекти"}
                            </h1>
                            <p className="text-sm text-slate-400 mt-0.5">
                                {new Date().toLocaleDateString("sr-RS", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                            </p>
                        </div>
                        {activeTab === "users" && (
                            <button
                                onClick={() => setShowCreateUserModal(true)}
                                className="flex items-center gap-2 bg-[#0056B3] text-white rounded-[50px] py-[10px] px-[20px] text-sm font-bold shadow-sm hover:bg-blue-700 transition"
                            >
                                <Plus size={16} /> Нови корисник
                            </button>
                        )}
                        {activeTab === "documents" && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 bg-[#0056B3] text-white rounded-[50px] py-[10px] px-[20px] text-sm font-bold shadow-sm hover:bg-blue-700 transition"
                            >
                                <Plus size={16} /> Нови документ
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

                    {/* ── Dashboard tab ── */}
                    {activeTab === "dashboard" && (
                        <DashboardView activity={activity} categories={categories} />
                    )}

                    {/* ── Documents tab ── */}
                    {activeTab === "documents" && (
                        <>
                            {/* Category filter */}
                            <div className="flex items-center gap-1 bg-white rounded-[50px] px-2 py-1.5 border border-slate-100 shadow-sm w-fit mb-5 flex-wrap">
                                <button
                                    onClick={() => handleCategoryFilter("all")}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                                        categoryFilter === "all" ? "bg-[#EBF2FB] text-[#0056B3]" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                    }`}
                                >
                                    Све
                                </button>
                                {categories.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleCategoryFilter(c.id)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap inline-flex items-center gap-1.5 ${
                                            categoryFilter === c.id ? "bg-[#EBF2FB] text-[#0056B3]" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                        }`}
                                    >
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                                        {c.name}
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
                                                            {doc.category ? (
                                                                <p className="text-xs mt-0.5 inline-flex items-center gap-1.5 font-semibold" style={{ color: doc.category.color }}>
                                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: doc.category.color }} />
                                                                    {doc.category.name}
                                                                </p>
                                                            ) : (
                                                                <p className="text-xs text-slate-400 mt-0.5">Без категорије</p>
                                                            )}
                                                        </div>
                                                        <DocCardMenu
                                                            sectionsCount={doc.sections_count}
                                                            onEdit={() => handleOpenEditor(doc.id)}
                                                            onView={() => handleOpenView(doc.id)}
                                                            onSections={() => setSectionsDoc(doc)}
                                                            onDelete={() => handleDeleteDocument(doc.id)}
                                                        />
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

                    {/* ── Approvals tab ── */}
                    {activeTab === "approvals" && (
                        <ApprovalsOverview documents={documents} />
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
                                                ) : u.role ? (
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                                        u.role === 'editor'      ? 'bg-slate-50 text-slate-600' :
                                                        u.role === 'rukovodilac' ? 'bg-purple-50 text-purple-600' :
                                                        u.role === 'direktor'    ? 'bg-amber-50 text-amber-600' :
                                                        u.role === 'kabinet'     ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'
                                                    }`}>
                                                        {ROLE_LABEL_MAP[u.role] ?? u.role}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-slate-400 text-[10px] font-bold uppercase tracking-wide">
                                                        Без улоге
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
                <CreateModal categories={categories} onClose={() => setShowCreateModal(false)} onCreate={handleCreateDocument} />
            )}

            {/* ── Categories manager modal ── */}
            {showCategoriesManager && (
                <CategoriesManager onClose={() => setShowCategoriesManager(false)} onChange={() => { loadCategories(); loadDocuments(categoryFilter); }} />
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
                <SectionsModal doc={sectionsDoc} onClose={() => { setSectionsDoc(null); loadDocuments(categoryFilter); }} />
            )}

            {/* ── Permissions modal ── */}
            {permissionsUser && (
                <PermissionsModal user={permissionsUser} onClose={() => setPermissionsUser(null)} />
            )}

            {/* ── Close menus on outside click ── */}
            {showNotifications && (
                <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
            )}
        </div>
    );
};

export default AdminPage;
