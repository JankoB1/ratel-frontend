import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    LayoutDashboard, FolderOpen, Users, UserCircle, Bell, Search,
    ChevronDown, Plus, MoreHorizontal, FileText, Loader2, Trash2,
    PenLine, Eye, TrendingUp, Clock, AlertCircle, X, Check
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
    created_at: string;
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
    onCreate: (name: string, email: string, password: string) => Promise<string | null>;
}

const CreateUserModal = ({ onClose, onCreate }: CreateUserModalProps) => {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirmation, setPasswordConfirmation] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (password !== passwordConfirmation) { setError("Lozinke se ne podudaraju."); return; }
        setSaving(true);
        const err = await onCreate(name.trim(), email.trim(), password);
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

    useEffect(() => {
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

    const handleCreateUser = async (name: string, email: string, password: string): Promise<string | null> => {
        try {
            await axiosClient.post("/api/admin/users", { name, email, password, password_confirmation: password });
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
                                                                <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                                                                    <button onClick={() => { handleOpenEditor(doc.id); setOpenMenuId(null); }}
                                                                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition">
                                                                        <PenLine size={14} className="text-blue-500" /> Уреди
                                                                    </button>
                                                                    <button onClick={() => { handleOpenView(doc.id); setOpenMenuId(null); }}
                                                                        className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm hover:bg-slate-50 transition">
                                                                        <Eye size={14} className="text-slate-500" /> Преглед
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
                                        <th className="text-left px-6 py-4 font-bold text-xs uppercase tracking-wide text-slate-400">Регистрован</th>
                                        <th className="px-6 py-4" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="text-center py-12 text-slate-300 text-sm font-semibold">
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
                                            <td className="px-6 py-4 text-slate-400">{fmtDate(u.created_at)}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteUser(u.id)}
                                                    title="Обриши корисника"
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
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

            {/* ── Close menus on outside click ── */}
            {(openMenuId !== null || showNotifications) && (
                <div className="fixed inset-0 z-10" onClick={() => { setOpenMenuId(null); setShowNotifications(false); }} />
            )}
        </div>
    );
};

export default AdminPage;
