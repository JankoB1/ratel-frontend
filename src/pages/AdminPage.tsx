import { useEffect, useState, useCallback, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
    LayoutDashboard, FolderOpen, Users, Bell, Search,
    ChevronDown, Plus, MoreHorizontal, FileText, Loader2, Trash2,
    PenLine, Eye, TrendingUp, Clock, AlertCircle, X, Check,
    ShieldCheck, FileStack, ChevronUp, KeyRound, Tag, Activity, LayoutTemplate,
    Upload, Link2, ListChecks, FileDown
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import axiosClient from "../axios-client";
import { formatLastModified } from "../components/SectionListSidebar";
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
    cover_title?: string | null;
    cover_big?: string | null;
    cover_subtitle?: string | null;
    intro_text?: string | null;
    disclaimer_text?: string | null;
    status: string;
    type: string;
    category_id: number | null;
    category: { id: number; name: string; slug: string; color: string; icon: string | null } | null;
    is_quarterly?: boolean;
    q_category?: 'electronic_communications' | 'postal_services' | null;
    q_subtype?: 'overview' | 'mobile' | 'porting' | null;
    q_year?: number | null;
    q_quarter?: number | null;
    sections_count: number;
    updated_at: string;
    created_at: string;
    pdf_generated_at?: string | null;
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
    { value: 'editor',      label: 'Urednik' },
    { value: 'rukovodilac', label: 'Rukovodilac' },
    { value: 'direktor',    label: 'Direktor' },
    { value: 'kabinet',     label: 'Kabinet' },
];

const ROLE_LABEL_MAP: Record<string, string> = {
    editor: 'Urednik',
    rukovodilac: 'Rukovodilac',
    direktor: 'Direktor',
    kabinet: 'Kabinet',
};

const roleLabel = (role: UserRole) => role ? (ROLE_LABEL_MAP[role] ?? role) : 'Bez uloge';

const permissionLabelForRole = (role: UserRole, isAdmin: boolean): string => {
    if (isAdmin) return 'Administrator — pristup svim poglavljima';
    if (role === 'editor') return 'Urednik — poglavlja koje sme da edituje';
    if (role === 'rukovodilac') return 'Rukovodilac — poglavlja koje sme da odobri';
    if (role === 'direktor')    return 'Direktor — poglavlja koje sme da odobri';
    if (role === 'kabinet')     return 'Kabinet — poglavlja koje sme da odobri';
    return 'Korisnik nema ulogu — dodeli ulogu da bi mogao nešto da radi sa poglavljima';
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
    draft:                { label: 'U izradi',              color: 'bg-slate-100 text-slate-600' },
    pending_rukovodilac:  { label: 'Čeka rukovodioca',      color: 'bg-purple-100 text-purple-700' },
    pending_direktor:     { label: 'Čeka direktora',        color: 'bg-amber-100 text-amber-700' },
    pending_kabinet:      { label: 'Čeka kabinet',          color: 'bg-emerald-100 text-emerald-700' },
    pending_admin:        { label: 'Čeka admina',           color: 'bg-blue-100 text-blue-700' },
    approved:             { label: 'Odobreno',              color: 'bg-green-100 text-green-700' },
    rejected:             { label: 'Odbijeno',              color: 'bg-red-100 text-red-700' },
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

type TabKey = "dashboard" | "documents" | "approvals" | "landing" | "users";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: "U izradi", color: "text-orange-500 bg-orange-50" },
    published: { label: "Objavljeno", color: "text-green-600 bg-green-50" },
    archived: { label: "Arhivirano", color: "text-slate-400 bg-slate-100" },
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

interface QuarterlyPayload {
    is_quarterly: true;
    q_category: 'electronic_communications' | 'postal_services';
    q_subtype: 'overview' | 'mobile' | 'porting' | null;
    q_year: number;
    q_quarter: number;
}
type CreateDocPayload =
    | { is_quarterly: false; category_id: number }
    | QuarterlyPayload;

interface CreateModalProps {
    categories: Category[];
    onClose: () => void;
    onCreate: (title: string, payload: CreateDocPayload) => Promise<void>;
}

const Q_SUBTYPES_EC = [
    { value: 'overview', label: 'Pregled tržišta elektronskih komunikacija u Republici Srbiji' },
    { value: 'mobile',   label: 'Prikaz mobilnih mreža operatora' },
    { value: 'porting',  label: 'Pregled prenosa brojeva po operatorima fiksne i mobilne telefonije' },
] as const;

const CreateModal = ({ categories, onClose, onCreate }: CreateModalProps) => {
    const [title, setTitle] = useState("");
    const [isQuarterly, setIsQuarterly] = useState(false);
    const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null);
    const [qCategory, setQCategory] = useState<'electronic_communications' | 'postal_services'>('electronic_communications');
    const [qSubtype, setQSubtype] = useState<'overview' | 'mobile' | 'porting'>('overview');
    const currentYear = new Date().getFullYear();
    const [qYear, setQYear] = useState<number>(currentYear);
    const [qQuarter, setQQuarter] = useState<1 | 2 | 3 | 4>(1);
    const [saving, setSaving] = useState(false);

    const canSubmit = (() => {
        if (!title.trim()) return false;
        if (isQuarterly) return !!qCategory && !!qYear && !!qQuarter;
        return !!categoryId;
    })();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;
        setSaving(true);
        try {
            if (isQuarterly) {
                await onCreate(title.trim(), {
                    is_quarterly: true,
                    q_category: qCategory,
                    q_subtype: qCategory === 'electronic_communications' ? qSubtype : null,
                    q_year: qYear,
                    q_quarter: qQuarter,
                });
            } else {
                await onCreate(title.trim(), { is_quarterly: false, category_id: categoryId! });
            }
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-extrabold text-lg text-dark-blue">Novi dokument</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Naziv</label>
                        <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="npr. Pregled tržišta Q1 2026"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    </div>

                    {/* Quarterly toggle */}
                    <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                        <input type="checkbox" checked={isQuarterly} onChange={e => setIsQuarterly(e.target.checked)} className="w-4 h-4 accent-[#0056B3]" />
                        <Activity size={16} className={isQuarterly ? "text-[#0056B3]" : "text-slate-300"} />
                        <span className="text-sm font-bold text-slate-700">Kvartalni izveštaj</span>
                    </label>

                    {/* Conditional fields */}
                    {!isQuarterly ? (
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Kategorija</label>
                            {categories.length === 0 ? (
                                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                                    Nema kategorija. Prvo napravite kategoriju.
                                </div>
                            ) : (
                                <select value={categoryId ?? ''} onChange={e => setCategoryId(Number(e.target.value))}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] bg-white">
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 block">Kategorija kvartala</label>
                                <div className="flex gap-2">
                                    {([
                                        { value: 'electronic_communications', label: 'Elektronske komunikacije' },
                                        { value: 'postal_services',           label: 'Poštanske usluge' },
                                    ] as const).map(opt => (
                                        <button key={opt.value} type="button" onClick={() => setQCategory(opt.value)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition ${qCategory===opt.value ? 'bg-[#0056B3] text-white border-[#0056B3]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {qCategory === 'electronic_communications' && (
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Podkategorija</label>
                                    <select value={qSubtype} onChange={e => setQSubtype(e.target.value as any)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] bg-white">
                                        {Q_SUBTYPES_EC.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Godina</label>
                                    <select value={qYear} onChange={e => setQYear(Number(e.target.value))}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] bg-white">
                                        {Array.from({ length: 6 }, (_, i) => currentYear + 1 - i).map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Kvartal</label>
                                    <div className="flex gap-1">
                                        {[1,2,3,4].map(q => (
                                            <button key={q} type="button" onClick={() => setQQuarter(q as any)}
                                                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${qQuarter===q ? 'bg-[#0056B3] text-white border-[#0056B3]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                                Q{q}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="flex gap-3 mt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition">
                            Otkaži
                        </button>
                        <button type="submit" disabled={!canSubmit || saving}
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

// ── Rename Document Modal ─────────────────────────────────────────────────────

interface DocEditFields {
    title: string;
    cover_title: string;
    cover_big: string;
    cover_subtitle: string;
    intro_text: string;
    disclaimer_text: string;
}

interface RenameDocModalProps {
    doc: DocItem;
    onClose: () => void;
    onSave: (id: number, fields: DocEditFields) => Promise<void>;
}

const RenameDocModal = ({ doc, onClose, onSave }: RenameDocModalProps) => {
    const [title, setTitle] = useState(doc.title);
    const [coverTitle, setCoverTitle] = useState(doc.cover_title ?? "");
    const [coverBig, setCoverBig] = useState(doc.cover_big ?? "");
    const [coverSubtitle, setCoverSubtitle] = useState(doc.cover_subtitle ?? "");
    const [introText, setIntroText] = useState(doc.intro_text ?? "");
    const [disclaimerText, setDisclaimerText] = useState(doc.disclaimer_text ?? "");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        try {
            await onSave(doc.id, {
                title: title.trim(),
                cover_title: coverTitle.trim(),
                cover_big: coverBig.trim(),
                cover_subtitle: coverSubtitle.trim(),
                intro_text: introText.trim(),
                disclaimer_text: disclaimerText.trim(),
            });
            onClose();
        } finally { setSaving(false); }
    };

    const labelCls = "text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block";
    const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-extrabold text-lg text-dark-blue flex items-center gap-2"><Tag size={18} className="text-[#0056B3]" /> Izmeni dokument</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className={labelCls}>Naziv dokumenta (interni)</label>
                        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                        <p className="text-[13px] font-bold text-dark-blue mb-1">Korica (1. strana PDF-a)</p>
                        <p className="text-[11px] text-slate-400 mb-3">Ako je „Naslov korice" prazan, koristi se naziv dokumenta. Naslov može u više redova (Enter).</p>
                    </div>
                    <div>
                        <label className={labelCls}>Naslov korice</label>
                        <textarea value={coverTitle} onChange={e => setCoverTitle(e.target.value)} rows={2}
                            placeholder="npr. ГОДИШЊИ ИЗВЕШТАЈ ЗА" className={`${inputCls} resize-y`} />
                    </div>
                    <div>
                        <label className={labelCls}>Veliki tekst (npr. godina)</label>
                        <input value={coverBig} onChange={e => setCoverBig(e.target.value)}
                            placeholder="npr. 2025" className={inputCls} />
                    </div>
                    <div>
                        <label className={labelCls}>Podnaslov korice</label>
                        <input value={coverSubtitle} onChange={e => setCoverSubtitle(e.target.value)}
                            placeholder="npr. БЕОГРАД, ЈУН 2026. ГОДИНЕ" className={inputCls} />
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                        <p className="text-[13px] font-bold text-dark-blue mb-1">2. strana PDF-a</p>
                        <p className="text-[11px] text-slate-400 mb-3">Tekst ispod RATEL logoa. Ako je prazno, prikazuje se samo logo (centriran).</p>
                    </div>
                    <div>
                        <label className={labelCls}>Uvodni tekst (2. strana)</label>
                        <textarea value={introText} onChange={e => setIntroText(e.target.value)} rows={4}
                            placeholder="Uvodni tekst koji se prikazuje ispod logoa na 2. strani…" className={`${inputCls} resize-y`} />
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                        <p className="text-[13px] font-bold text-dark-blue mb-1">3. strana PDF-a (napomena)</p>
                        <p className="text-[11px] text-slate-400 mb-3">Svaki red je jedan pasus. Ako je prazno, koristi se podrazumevani tekst napomene.</p>
                    </div>
                    <div>
                        <label className={labelCls}>Tekst napomene (3. strana)</label>
                        <textarea value={disclaimerText} onChange={e => setDisclaimerText(e.target.value)} rows={5}
                            placeholder="Napomena o izvoru i odgovornosti za podatke…" className={`${inputCls} resize-y`} />
                    </div>

                    <div className="flex gap-3 mt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition">Otkaži</button>
                        <button type="submit" disabled={!title.trim() || saving}
                            className="flex-1 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Sačuvaj
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

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
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Uloga</label>
                            <select value={role ?? ''} onChange={e => setRole(e.target.value as UserRole)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition bg-white">
                                <option value="">— bez uloge —</option>
                                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    )}
                    <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                        <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-4 h-4 accent-[#0056B3]" />
                        <ShieldCheck size={16} className={isAdmin ? "text-[#0056B3]" : "text-slate-300"} />
                        <span className="text-sm font-bold text-slate-700">Administrator</span>
                        <span className="text-xs text-slate-400 ml-auto">{isAdmin ? "pun pristup" : "standardni"}</span>
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
                    <h2 className="font-extrabold text-lg text-dark-blue">Uredi korisnika</h2>
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
                        <input value={name} onChange={e => setName(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">E-pošta</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Nova lozinka (opciono)</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Ostavite prazno za istu lozinku"
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    </div>
                    {password && (
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Potvrdi lozinku</label>
                            <input type="password" value={passwordConfirmation} onChange={e => setPasswordConfirmation(e.target.value)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                        </div>
                    )}
                    {!isAdmin && (
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Uloga</label>
                            <select value={role ?? ''} onChange={e => setRole(e.target.value === '' ? null : (e.target.value as UserRole))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition bg-white">
                                <option value="">— bez uloge —</option>
                                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>
                    )}
                    <label className="flex items-center gap-3 cursor-pointer bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                        <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} className="w-4 h-4 accent-[#0056B3]" />
                        <ShieldCheck size={16} className={isAdmin ? "text-[#0056B3]" : "text-slate-300"} />
                        <span className="text-sm font-bold text-slate-700">Administrator</span>
                    </label>
                    <div className="flex gap-3 mt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition">Otkaz</button>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Sačuvaj
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
        if (!confirm("Da li ste sigurni da želite da obrišete ovo poglavlje?")) return;
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
                        <h2 className="font-extrabold text-lg text-dark-blue flex items-center gap-2"><FileStack size={20} className="text-[#0056B3]" /> Poglavlja dokumenta</h2>
                        <p className="text-sm text-slate-400 mt-0.5">{doc.title}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                <form onSubmit={handleAdd} className="flex gap-2 mt-5">
                    <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Naziv novog poglavlja..."
                        className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    <button type="submit" disabled={!newTitle.trim() || adding}
                        className="px-5 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center gap-2">
                        {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Dodaj
                    </button>
                </form>

                <div className="flex-1 overflow-auto mt-5 -mx-2 px-2">
                    {loading ? (
                        <div className="flex justify-center py-12 text-slate-300"><Loader2 className="animate-spin" /></div>
                    ) : sections.length === 0 ? (
                        <div className="text-center py-12 text-slate-300 text-sm font-semibold">Nema poglavlja</div>
                    ) : (
                        <table className="w-full text-sm border-separate border-spacing-0">
                            <thead>
                                <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    <th className="px-2 py-2 w-8"></th>
                                    <th className="px-2 py-2">Poglavlje</th>
                                    <th className="px-2 py-2">Status</th>
                                    <th className="px-2 py-2">Urednik</th>
                                    <th className="px-2 py-2">Rukovodilac</th>
                                    <th className="px-2 py-2">Direktor</th>
                                    <th className="px-2 py-2">Kabinet</th>
                                    <th className="px-2 py-2">Admin</th>
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
                    title={section.rejected ? `Odbio: ${section.rejected.name}\nRazlog: ${section.rejected.reason}` : ''}>
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
                        <h2 className="font-extrabold text-lg text-dark-blue flex items-center gap-2"><KeyRound size={20} className="text-[#0056B3]" /> {user.is_admin ? 'Privilegije' : `Dodeli poglavlja — ${roleLabel(user.role)}`}</h2>
                        <p className="text-sm text-slate-400 mt-0.5">{user.name} — {user.email}</p>
                        {!user.is_admin && (
                            <p className="text-xs text-slate-500 mt-1.5 italic">{permissionLabelForRole(user.role, false)}</p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                {user.is_admin && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 font-semibold mb-4 flex items-center gap-2">
                        <ShieldCheck size={14} /> Ovaj korisnik je administrator — ima puni pristup svim poglavljima i odobrava poslednji u toku pregleda.
                    </div>
                )}

                {!user.is_admin && !user.role && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 font-semibold mb-4 flex items-center gap-2">
                        <AlertCircle size={14} /> Ovom korisniku još uvek nije dodeljena uloga. Dodeli ulogu u „Uredi korisnika" pre nego što mu dodaš poglavlja.
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
                                                <span className="text-xs font-bold text-slate-600">Sve</span>
                                            </label>
                                        </div>
                                        {expanded[d.id] && (
                                            <div className="divide-y divide-slate-50">
                                                {d.sections.length === 0 ? (
                                                    <div className="text-xs text-slate-300 text-center py-3">Nema poglavlja</div>
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
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition">Otkaži</button>
                    <button onClick={handleSave} disabled={saving || user.is_admin}
                        className="flex-1 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Sačuvaj privilegije
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Dashboard View ───────────────────────────────────────────────────────────

const MONTH_LABELS_SR = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Avg', 'Sep', 'Okt', 'Nov', 'Dec'];

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
                    <h3 className="font-bold text-sm text-dark-blue">Aktivnost — kreirani dokumenti po mesecima</h3>
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
                    <h3 className="font-bold text-sm text-dark-blue">Kategorije</h3>
                </div>
                <div className="flex flex-col gap-2">
                    {categories.length === 0 ? (
                        <div className="text-xs text-slate-300 text-center py-6">Nema kategorija</div>
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
                    <h3 className="font-bold text-sm text-dark-blue">Poslednje izmene (poglavlja)</h3>
                </div>
                {!activity ? (
                    <div className="flex justify-center py-8 text-slate-300"><Loader2 className="animate-spin" /></div>
                ) : activity.recent.length === 0 ? (
                    <div className="text-center py-8 text-slate-300 text-sm">Nema skorijih izmena</div>
                ) : (
                    <div className="flex flex-col">
                        {activity.recent.map((r, i) => (
                            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                    <FileStack size={14} className="text-[#0056B3]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-dark-blue truncate">{r.section_title || 'Bez naslova'}</p>
                                    <p className="text-xs text-slate-400 truncate">u {r.document_title}</p>
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
            alert(err?.response?.data?.message ?? "Greška pri brisanju.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-2">
                    <h2 className="font-extrabold text-lg text-dark-blue flex items-center gap-2"><Tag size={20} className="text-[#0056B3]" /> Kategorije projekata</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                <form onSubmit={handleAdd} className="flex gap-2 mt-5">
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Naziv nove kategorije..."
                        className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] transition" />
                    <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                        className="w-12 h-10 border border-slate-200 rounded-xl cursor-pointer" title="Boja" />
                    <button type="submit" disabled={!newName.trim() || adding}
                        className="px-5 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center gap-2">
                        {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Dodaj
                    </button>
                </form>

                <div className="flex-1 overflow-y-auto mt-5 -mx-2 px-2">
                    {loading ? (
                        <div className="flex justify-center py-12 text-slate-300"><Loader2 className="animate-spin" /></div>
                    ) : cats.length === 0 ? (
                        <div className="text-center py-12 text-slate-300 text-sm font-semibold">Nema kategorija</div>
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
                    <span className="text-xs text-slate-400">{cat.documents_count ?? 0} dok.</span>
                    <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-[#0056B3] hover:bg-blue-50 transition-all"><PenLine size={14} /></button>
                    <button onClick={onDelete} disabled={(cat.documents_count ?? 0) > 0} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all disabled:opacity-30 disabled:cursor-not-allowed" title={(cat.documents_count ?? 0) > 0 ? 'Ima vezanih dokumenata' : 'Obriši'}><Trash2 size={14} /></button>
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
    onRename: () => void;
    onView: () => void;
    onSections: () => void;
    onDelete: () => void;
    onGeneratePdf: () => void;
    pdfGeneratedAt?: string | null;
    sectionsCount: number;
}

const DocCardMenu = ({ onEdit, onRename, onView, onSections, onDelete, onGeneratePdf, pdfGeneratedAt, sectionsCount }: DocCardMenuProps) => {
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
                    <PenLine size={14} className="text-blue-500" /> Uredi
                </button>
                <button onClick={() => { close(); onRename(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition">
                    <Tag size={14} className="text-blue-500" /> Preimenuj
                </button>
                <button onClick={() => { close(); onView(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition">
                    <Eye size={14} className="text-slate-500" /> Pregled
                </button>
                <button onClick={() => { close(); onSections(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition">
                    <FileStack size={14} className="text-blue-500" /> Poglavlja ({sectionsCount})
                </button>
                <button onClick={() => { close(); onGeneratePdf(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition border-t border-slate-100">
                    <FileDown size={14} className="text-emerald-600" />
                    <span className="flex-1 text-left leading-tight">
                        Generiši PDF
                        <span className="block text-[10px] text-slate-400 font-normal">
                            {pdfGeneratedAt ? `Generisan: ${formatLastModified(pdfGeneratedAt)}` : 'Nije još generisan'}
                        </span>
                    </span>
                </button>
                <button onClick={() => { close(); onDelete(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition">
                    <Trash2 size={14} /> Obriši
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
                Nema dokumenata. Kreiraj prvo dokument u „Projekti".
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Document selector */}
            <div className="bg-white border border-slate-100 rounded-2xl px-5 py-4 flex items-center gap-4">
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">Dokument:</label>
                <select value={selectedDocId ?? ''} onChange={e => setSelectedDocId(e.target.value ? Number(e.target.value) : null)}
                    className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] bg-white">
                    {documents.map(d => (
                        <option key={d.id} value={d.id}>{d.title} ({d.sections_count} poglavlja)</option>
                    ))}
                </select>
            </div>

            {/* Matrix */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16 text-slate-300"><Loader2 className="animate-spin" size={28} /></div>
                ) : sections.length === 0 ? (
                    <div className="text-center py-16 text-sm text-slate-400">Ovaj dokument nema poglavlja.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                    <th className="px-5 py-4">Poglavlje</th>
                                    <th className="px-3 py-4">Status</th>
                                    <th className="px-3 py-4">Urednik</th>
                                    <th className="px-3 py-4">Rukovodilac</th>
                                    <th className="px-3 py-4">Direktor</th>
                                    <th className="px-3 py-4">Kabinet</th>
                                    <th className="px-3 py-4">Admin</th>
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
                                                        Odbio {s.rejected.name}: „{s.rejected.reason}"
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
                                                    Otvori →
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

// ── Landing Boxes + Collections (Početna tab) ──────────────────────────────────

interface LandingBox {
    id: number;
    position: number;
    title: string | null;
    subtitle: string | null;
    image_path: string | null;
    link_type: 'none' | 'document' | 'collection' | 'quarterly';
    link_document_id: number | null;
    link_collection_id: number | null;
}

interface CollectionItem {
    id: number;
    name: string;
    document_id: number;
    document: { id: number; title: string } | null;
    section_ids: number[];
    updated_at: string;
    pdf_generated_at?: string | null;
}

const BOX_DEFAULTS: Record<number, { title: string; style: string }> = {
    0: { title: 'Pogledajte kompletan\npregled tržišta 2025', style: 'tall light' },
    1: { title: 'Pregled tržišta elektronskih komunikacija 2025', style: 'dark' },
    2: { title: 'Kvartalni podaci', style: 'tall dark' },
    3: { title: 'Pregled tržišta\ninformaciona\nbezbednost 2025', style: 'light' },
    4: { title: 'Pregled tržišta\npoštanskih\nusluga 2025', style: 'light' },
    5: { title: 'Pogledajte prethodne\npreglede tržišta', style: 'light' },
};

const LandingBoxesTab = ({ documents }: { documents: DocItem[] }) => {
    const [boxes, setBoxes] = useState<LandingBox[]>([]);
    const [collections, setCollections] = useState<CollectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingBox, setEditingBox] = useState<LandingBox | null>(null);
    const [showCollectionsManager, setShowCollectionsManager] = useState(false);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [boxesRes, colsRes] = await Promise.all([
                axiosClient.get('/api/admin/landing-boxes'),
                axiosClient.get('/api/admin/collections'),
            ]);
            setBoxes(boxesRes.data.data || []);
            setCollections(colsRes.data.data || []);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    return (
        <div className="flex flex-col gap-5">
            {/* Boxovi grid preview */}
            <div className="bg-white border border-slate-100 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-extrabold text-sm text-dark-blue">Hero boksovi (6 pozicija)</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Klikni na boks da izmeniš naslov, sliku i link</p>
                    </div>
                    <button onClick={() => setShowCollectionsManager(true)}
                        className="text-xs font-bold text-[#0056B3] border border-[#0056B3] px-3 py-1.5 rounded-lg hover:bg-blue-50 flex items-center gap-1.5">
                        <ListChecks size={13} /> Kolekcije ({collections.length})
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12 text-slate-300"><Loader2 className="animate-spin" /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[0,1,2,3,4,5].map(pos => {
                            const b = boxes.find(x => x.position === pos);
                            const def = BOX_DEFAULTS[pos];
                            const linkInfo = b?.link_type === 'document'
                                ? documents.find(d => d.id === b.link_document_id)?.title
                                : b?.link_type === 'collection'
                                    ? collections.find(c => c.id === b.link_collection_id)?.name
                                    : null;
                            return (
                                <button key={pos} onClick={() => setEditingBox(b || { id: 0, position: pos, title: null, subtitle: null, image_path: null, link_type: 'none', link_document_id: null, link_collection_id: null })}
                                    className="flex flex-col gap-2 p-3 border border-slate-200 rounded-xl hover:border-[#0056B3] hover:bg-slate-50 transition text-left">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-white bg-[#0056B3] px-2 py-0.5 rounded">Pos {pos}</span>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">{def.style}</span>
                                    </div>
                                    {b?.image_path && (
                                        <img src={b.image_path} alt="" className="w-full h-20 object-cover rounded-lg border border-slate-100" />
                                    )}
                                    {!b?.image_path && (
                                        <div className="w-full h-20 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] text-slate-400">podrazumevana slika</div>
                                    )}
                                    <div className="text-xs font-bold text-dark-blue whitespace-pre-line line-clamp-3">
                                        {b?.title || def.title}
                                    </div>
                                    {linkInfo ? (
                                        <div className="text-[11px] text-[#0056B3] font-semibold flex items-center gap-1 truncate">
                                            <Link2 size={11} /> {linkInfo}
                                        </div>
                                    ) : (
                                        <div className="text-[11px] text-slate-400">Bez linka</div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {editingBox && (
                <LandingBoxEditModal
                    box={editingBox}
                    documents={documents}
                    collections={collections}
                    onClose={() => setEditingBox(null)}
                    onSaved={() => { setEditingBox(null); loadAll(); }}
                />
            )}

            {showCollectionsManager && (
                <CollectionsManagerModal
                    documents={documents}
                    onClose={() => setShowCollectionsManager(false)}
                    onChange={loadAll}
                />
            )}
        </div>
    );
};

const LandingBoxEditModal = ({ box, documents, collections, onClose, onSaved }: {
    box: LandingBox; documents: DocItem[]; collections: CollectionItem[];
    onClose: () => void; onSaved: () => void;
}) => {
    const [title, setTitle] = useState(box.title ?? '');
    const [linkType, setLinkType] = useState<'none'|'document'|'collection'|'quarterly'>(box.link_type);
    const [linkDocId, setLinkDocId] = useState<number | null>(box.link_document_id);
    const [linkCollId, setLinkCollId] = useState<number | null>(box.link_collection_id);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(box.image_path);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setImageFile(f);
        setImagePreview(URL.createObjectURL(f));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Upload image first if a new file was selected
            if (imageFile) {
                const fd = new FormData();
                fd.append('image', imageFile);
                await axiosClient.post(`/api/admin/landing-boxes/${box.position}/image`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            }
            // 2. Save other fields
            await axiosClient.put(`/api/admin/landing-boxes/${box.position}`, {
                title: title.trim() || null,
                link_type: linkType,
                link_document_id: linkType === 'document' ? linkDocId : null,
                link_collection_id: linkType === 'collection' ? linkCollId : null,
            });
            onSaved();
        } catch (e: any) {
            alert('Greška: ' + (e?.response?.data?.message || e.message));
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-extrabold text-lg text-dark-blue flex items-center gap-2">
                        <LayoutTemplate size={18} className="text-[#0056B3]" /> Uredi boks — pozicija {box.position}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                <div className="flex flex-col gap-4">
                    {/* Title */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Naslov (prazno = podrazumevano)</label>
                        <textarea value={title} onChange={e => setTitle(e.target.value)}
                            placeholder={BOX_DEFAULTS[box.position].title}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] resize-none"
                            rows={3} />
                    </div>

                    {/* Image */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Slika pozadine</label>
                        {imagePreview && (
                            <img src={imagePreview} alt="" className="w-full h-32 object-cover rounded-lg border border-slate-200 mb-2" />
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 font-bold hover:border-[#0056B3] hover:bg-blue-50 transition flex items-center justify-center gap-2">
                            <Upload size={13} /> {imagePreview ? 'Zameni sliku' : 'Izaberi sliku'}
                        </button>
                    </div>

                    {/* Link type */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2 block">Link</label>
                        <div className="flex gap-2">
                            {(['none','document','collection','quarterly'] as const).map(t => (
                                <button key={t} type="button" onClick={() => setLinkType(t)}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold border transition ${linkType===t ? 'bg-[#0056B3] text-white border-[#0056B3]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                    {t==='none' ? 'Bez' : t==='document' ? 'Dokument' : t==='collection' ? 'Kolekcija' : 'Kvartalni'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Document picker */}
                    {linkType === 'document' && (
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Izaberi dokument</label>
                            <select value={linkDocId ?? ''} onChange={e => setLinkDocId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] bg-white">
                                <option value="">— izaberi —</option>
                                {documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                            </select>
                        </div>
                    )}

                    {/* Collection picker */}
                    {linkType === 'collection' && (
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Izaberi kolekciju</label>
                            <select value={linkCollId ?? ''} onChange={e => setLinkCollId(e.target.value ? Number(e.target.value) : null)}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] bg-white">
                                <option value="">— izaberi —</option>
                                {collections.map(c => <option key={c.id} value={c.id}>{c.name} ({c.document?.title})</option>)}
                            </select>
                            {collections.length === 0 && (
                                <p className="text-[11px] text-amber-600 mt-1">Prvo napravi kolekciju u „Kolekcije" dugmetu.</p>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 mt-2">
                        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">Otkaži</button>
                        <button onClick={handleSave} disabled={saving}
                            className="flex-1 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Sačuvaj
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── Collections Manager Modal ─────────────────────────────────────────────────

const CollectionsManagerModal = ({ documents, onClose, onChange }: {
    documents: DocItem[]; onClose: () => void; onChange: () => void;
}) => {
    const [collections, setCollections] = useState<CollectionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<CollectionItem | 'new' | null>(null);
    const [pdfGenLabel, setPdfGenLabel] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosClient.get('/api/admin/collections');
            setCollections(data.data || []);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id: number) => {
        if (!confirm('Obriši ovu kolekciju?')) return;
        await axiosClient.delete(`/api/admin/collections/${id}`);
        await load();
        onChange();
    };

    // Sinhrono generiše keširani PDF kolekcije (admin sačeka uz overlay). Prepisuje postojeći.
    const handleGeneratePdf = async (c: CollectionItem) => {
        setPdfGenLabel(c.name);
        try {
            await axiosClient.post(`/api/admin/collections/${c.id}/generate-pdf`);
            await load();
            alert(`✅ PDF za kolekciju „${c.name}" je generisan.`);
        } catch {
            alert("❌ Greška pri generisanju PDF-a. Pokušajte ponovo.");
        } finally {
            setPdfGenLabel(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="font-extrabold text-lg text-dark-blue flex items-center gap-2"><ListChecks size={20} className="text-[#0056B3]" /> Kolekcije</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Imenovan podskup poglavlja jednog dokumenta</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                <button onClick={() => setEditing('new')}
                    className="self-start mb-4 px-4 py-2 rounded-xl bg-[#0056B3] text-white text-xs font-bold hover:bg-blue-700 flex items-center gap-2">
                    <Plus size={13} /> Nova kolekcija
                </button>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-12 text-slate-300"><Loader2 className="animate-spin" /></div>
                    ) : collections.length === 0 ? (
                        <div className="text-center py-12 text-slate-300 text-sm">Još uvek nema nijedne kolekcije</div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {collections.map(c => (
                                <div key={c.id} className="flex items-center gap-3 p-3 border border-slate-100 rounded-xl hover:bg-slate-50 group">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm text-dark-blue truncate">{c.name}</div>
                                        <div className="text-[11px] text-slate-400 truncate">
                                            {c.document?.title} • {c.section_ids?.length || 0} poglavlja
                                            {c.pdf_generated_at ? ` • PDF: ${formatLastModified(c.pdf_generated_at)}` : ' • PDF: nije generisan'}
                                        </div>
                                    </div>
                                    <button onClick={() => handleGeneratePdf(c)} title="Generiši PDF za preuzimanje na javnom prikazu"
                                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition">
                                        <FileDown size={13} /> {c.pdf_generated_at ? 'Regeneriši PDF' : 'Generiši PDF'}
                                    </button>
                                    <button onClick={() => setEditing(c)} title="Izmeni" className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-[#0056B3] hover:bg-blue-50"><PenLine size={13} /></button>
                                    <button onClick={() => handleDelete(c.id)} title="Obriši" className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {editing && (
                    <CollectionEditModal
                        collection={editing === 'new' ? null : editing}
                        documents={documents}
                        onClose={() => setEditing(null)}
                        onSaved={() => { setEditing(null); load(); onChange(); }}
                    />
                )}

                {pdfGenLabel !== null && (
                    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 max-w-[360px] text-center">
                            <Loader2 className="animate-spin text-blue-600" size={44} />
                            <span className="text-base font-bold text-slate-700">Generisanje PDF-a…</span>
                            <span className="text-sm text-slate-400 font-medium leading-snug">
                                „{pdfGenLabel}" — može potrajati do minut. Molimo sačekajte.
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const CollectionEditModal = ({ collection, documents, onClose, onSaved }: {
    collection: CollectionItem | null; documents: DocItem[];
    onClose: () => void; onSaved: () => void;
}) => {
    const [name, setName] = useState(collection?.name ?? '');
    const [docId, setDocId] = useState<number | null>(collection?.document_id ?? null);
    const [sectionIds, setSectionIds] = useState<number[]>(collection?.section_ids ?? []);
    const [docSections, setDocSections] = useState<{id:number; title:string; order:number}[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!docId) { setDocSections([]); return; }
        let cancelled = false;
        axiosClient.get(`/api/admin/documents/${docId}/sections`).then(({ data }) => {
            if (!cancelled) setDocSections(data.data || []);
        });
        return () => { cancelled = true; };
    }, [docId]);

    const toggleSection = (id: number) => {
        setSectionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleSave = async () => {
        if (!name.trim() || !docId || sectionIds.length === 0) {
            alert('Unesi ime, izaberi dokument i bar jedno poglavlje.');
            return;
        }
        setSaving(true);
        try {
            const payload = { name: name.trim(), document_id: docId, section_ids: sectionIds };
            if (collection) await axiosClient.put(`/api/admin/collections/${collection.id}`, payload);
            else            await axiosClient.post('/api/admin/collections', payload);
            onSaved();
        } catch (e: any) {
            alert('Greška: ' + (e?.response?.data?.message || e.message));
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                    <h2 className="font-extrabold text-lg text-dark-blue">{collection ? 'Uredi kolekciju' : 'Nova kolekcija'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
                </div>

                <div className="flex flex-col gap-4 flex-1 overflow-y-auto">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Naziv kolekcije</label>
                        <input value={name} onChange={e => setName(e.target.value)} autoFocus
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3]" />
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">Dokument</label>
                        <select value={docId ?? ''} onChange={e => { const v = e.target.value ? Number(e.target.value) : null; setDocId(v); setSectionIds([]); }}
                            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#0056B3] bg-white">
                            <option value="">— izaberi —</option>
                            {documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                        </select>
                    </div>

                    {docId && (
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1 block">
                                Poglavlja ({sectionIds.length} izabrano)
                            </label>
                            {docSections.length === 0 ? (
                                <div className="text-xs text-slate-400 italic py-4 text-center">Učitavam...</div>
                            ) : (
                                <div className="border border-slate-100 rounded-xl divide-y divide-slate-50 max-h-64 overflow-y-auto">
                                    {docSections.map(s => (
                                        <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                                            <input type="checkbox" checked={sectionIds.includes(s.id)} onChange={() => toggleSection(s.id)}
                                                className="w-4 h-4 accent-[#0056B3]" />
                                            <span className="text-xs font-bold text-slate-300 w-6">{s.order}.</span>
                                            <span className="text-sm text-slate-700">{s.title}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex gap-3 mt-5 pt-5 border-t border-slate-100">
                    <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50">Otkaži</button>
                    <button onClick={handleSave} disabled={saving || !name.trim() || !docId || sectionIds.length === 0}
                        className="flex-1 py-2.5 rounded-xl bg-[#0056B3] text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-40 flex items-center justify-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Sačuvaj
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
    const [renameDoc, setRenameDoc] = useState<DocItem | null>(null);
    const [pdfGenLabel, setPdfGenLabel] = useState<string | null>(null); // naziv dok se PDF generiše (null = ne generiše se)
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

    const handleCreateDocument = async (title: string, payload: CreateDocPayload) => {
        await axiosClient.post("/api/admin/documents", { title, ...payload });
        setShowCreateModal(false);
        await Promise.all([loadStats(), loadDocuments(categoryFilter), loadCategories()]);
    };

    const handleDeleteDocument = async (id: number) => {
        if (!confirm("Da li ste sigurni da želite da obrišete ovaj dokument?")) return;
        await axiosClient.delete(`/api/admin/documents/${id}`);
        await Promise.all([loadStats(), loadDocuments(categoryFilter), loadCategories()]);
    };

    const handleRenameDocument = async (id: number, fields: DocEditFields) => {
        await axiosClient.put(`/api/admin/documents/${id}`, fields);
        await loadDocuments(categoryFilter);
    };

    // Sinhrono generiše keširani PDF dokumenta (admin sačeka uz overlay). Prepisuje postojeći.
    const handleGenerateDocumentPdf = async (doc: DocItem) => {
        setPdfGenLabel(doc.title);
        try {
            await axiosClient.post(`/api/admin/documents/${doc.id}/generate-pdf`);
            await loadDocuments(categoryFilter);
            alert(`✅ PDF za „${doc.title}" je generisan. Korisnici ga sada mogu preuzeti odmah.`);
        } catch {
            alert("❌ Greška pri generisanju PDF-a. Pokušajte ponovo.");
        } finally {
            setPdfGenLabel(null);
        }
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
            return (err?.response?.data?.message ?? firstFieldErrors?.[0] ?? "Greška pri čuvanju.") as string;
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
                        { key: "dashboard" as TabKey, label: "Pregled", icon: LayoutDashboard },
                        { key: "documents" as TabKey, label: "Projekti", icon: FolderOpen },
                        { key: "approvals" as TabKey, label: "Odobravanja", icon: ShieldCheck },
                        { key: "landing" as TabKey,  label: "Početna",     icon: LayoutTemplate },
                        { key: "users" as TabKey, label: "Korisnici", icon: Users },
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
                        Kategorije
                    </button>
                </nav>

                {/* Logout */}
                <button
                    onClick={async () => { await logout(); navigate("/login"); }}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                >
                    <X size={18} />
                    Odjava
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
                            placeholder="Pretraga..."
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
                                <span className="text-slate-500">Danas</span>
                                <ChevronDown size={14} className="text-slate-400" />
                            </button>
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden">
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                                        <span className="font-extrabold text-sm">Notifikacije</span>
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
                                            <div className="px-5 py-6 text-center text-sm text-slate-400">Nema notifikacija</div>
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
                            <span className="font-extrabold text-[13px] uppercase tracking-wide">{user?.name ?? "ADMIN"}</span>
                        </div>
                    </div>
                </header>

                {/* ── Content ── */}
                <main className="flex-1 overflow-y-auto px-8 pb-8">

                    {/* Page title + date */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="font-extrabold text-xl text-dark-blue">
                                {activeTab === "dashboard" ? "Pregled" :
                                 activeTab === "users"     ? "Korisnici" :
                                 activeTab === "approvals" ? "Odobravanja po dokumentu" :
                                 activeTab === "landing"   ? "Početna strana" :
                                                             "Projekti"}
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
                                <Plus size={16} /> Novi korisnik
                            </button>
                        )}
                        {activeTab === "documents" && (
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 bg-[#0056B3] text-white rounded-[50px] py-[10px] px-[20px] text-sm font-bold shadow-sm hover:bg-blue-700 transition"
                            >
                                <Plus size={16} /> Novi dokument
                            </button>
                        )}
                    </div>

                    {/* ── Metric cards ── */}
                    <div className="grid grid-cols-4 gap-4 mb-8">
                        {[
                            {
                                label: "Broj projekata",
                                value: stats?.total_documents ?? 0,
                                icon: FolderOpen,
                                color: "text-blue-500",
                                bg: "bg-blue-50",
                            },
                            {
                                label: "Aktivni korisnici",
                                value: stats?.total_users ?? 0,
                                icon: Users,
                                color: "text-green-500",
                                bg: "bg-green-50",
                            },
                            {
                                label: "Projekti u izradi",
                                value: stats?.in_progress ?? 0,
                                icon: TrendingUp,
                                color: "text-orange-500",
                                bg: "bg-orange-50",
                            },
                            {
                                label: "Poslednja aktivnost",
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
                                    Sve
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
                                    <span className="text-sm font-semibold">Nema projekata</span>
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
                                                            Pregled
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Card body */}
                                                <div className="p-4">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-extrabold text-sm text-dark-blue truncate">{doc.title}</h3>
                                                            {doc.is_quarterly ? (
                                                                <p className="text-xs mt-0.5 inline-flex items-center gap-1.5 font-semibold text-amber-700">
                                                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-[10px] font-bold">Q{doc.q_quarter} {doc.q_year}</span>
                                                                    {doc.q_category === 'electronic_communications' ? 'Elektronske komunikacije' : 'Poštanske usluge'}
                                                                </p>
                                                            ) : doc.category ? (
                                                                <p className="text-xs mt-0.5 inline-flex items-center gap-1.5 font-semibold" style={{ color: doc.category.color }}>
                                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: doc.category.color }} />
                                                                    {doc.category.name}
                                                                </p>
                                                            ) : (
                                                                <p className="text-xs text-slate-400 mt-0.5">Bez kategorije</p>
                                                            )}
                                                        </div>
                                                        <DocCardMenu
                                                            sectionsCount={doc.sections_count}
                                                            pdfGeneratedAt={doc.pdf_generated_at}
                                                            onEdit={() => handleOpenEditor(doc.id)}
                                                            onRename={() => setRenameDoc(doc)}
                                                            onView={() => handleOpenView(doc.id)}
                                                            onSections={() => setSectionsDoc(doc)}
                                                            onGeneratePdf={() => handleGenerateDocumentPdf(doc)}
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

                    {/* ── Landing (Početna) tab ── */}
                    {activeTab === "landing" && (
                        <LandingBoxesTab documents={documents} />
                    )}

                    {/* ── Users tab ── */}
                    {activeTab === "users" && (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-100">
                                        <th className="text-left px-6 py-4 font-bold text-xs uppercase tracking-wide text-slate-400">Korisnik</th>
                                        <th className="text-left px-6 py-4 font-bold text-xs uppercase tracking-wide text-slate-400">E-pošta</th>
                                        <th className="text-left px-6 py-4 font-bold text-xs uppercase tracking-wide text-slate-400">Uloga</th>
                                        <th className="text-left px-6 py-4 font-bold text-xs uppercase tracking-wide text-slate-400">Registrovan</th>
                                        <th className="px-6 py-4" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center py-12 text-slate-300 text-sm font-semibold">
                                                Nema korisnika
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
                                                        <ShieldCheck size={12} /> Admin
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
                                                        Bez uloge
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400">{fmtDate(u.created_at)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button onClick={() => setPermissionsUser(u)} title="Privilegije"
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-[#0056B3] hover:bg-blue-50 transition-all">
                                                        <KeyRound size={15} />
                                                    </button>
                                                    <button onClick={() => setEditingUser(u)} title="Uredi"
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-[#0056B3] hover:bg-blue-50 transition-all">
                                                        <PenLine size={15} />
                                                    </button>
                                                    <button onClick={() => handleDeleteUser(u.id)} title="Obriši"
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

            {/* ── Rename document modal ── */}
            {renameDoc && (
                <RenameDocModal doc={renameDoc} onClose={() => setRenameDoc(null)} onSave={handleRenameDocument} />
            )}

            {/* ── Permissions modal ── */}
            {permissionsUser && (
                <PermissionsModal user={permissionsUser} onClose={() => setPermissionsUser(null)} />
            )}

            {/* ── Close menus on outside click ── */}
            {showNotifications && (
                <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
            )}

            {/* ── PDF generisanje (sinhrono) overlay ── */}
            {pdfGenLabel !== null && (
                <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 max-w-[360px] text-center">
                        <Loader2 className="animate-spin text-blue-600" size={44} />
                        <span className="text-base font-bold text-slate-700">Generisanje PDF-a…</span>
                        <span className="text-sm text-slate-400 font-medium leading-snug">
                            „{pdfGenLabel}" — može potrajati do minut. Molimo sačekajte.
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
