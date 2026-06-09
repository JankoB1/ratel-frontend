import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Inbox, Loader2, Clock, ChevronRight, FileText, LogOut, ShieldCheck } from "lucide-react";
import axiosClient from "../axios-client";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/logo.svg";

interface InboxItem {
    section_id: number;
    section_title: string;
    document_id: number;
    document_title: string;
    status: string;
    submitted_at: string | null;
    submitted_by: string | null;
}

const STATUS_LABEL_MAP: Record<string, string> = {
    pending_rukovodilac: 'Čeka vas kao rukovodioca',
    pending_direktor:    'Čeka vas kao direktora',
    pending_kabinet:     'Čeka vas kao kabinet',
    pending_admin:       'Čeka vas kao administratora (finalno)',
};

const ROLE_LABEL_MAP: Record<string, string> = {
    editor: 'Urednik',
    rukovodilac: 'Rukovodilac',
    direktor: 'Direktor',
    kabinet: 'Kabinet',
};

const fmtWhen = (iso: string | null) => {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'malopre';
    if (diff < 3600) return `pre ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `pre ${Math.floor(diff / 3600)} č`;
    return `pre ${Math.floor(diff / 86400)} dana`;
};

interface InboxDiagnostic {
    role: string | null;
    is_admin: boolean;
    waiting_status: string | null;
    assigned_section_count: number | null;
}

export default function InboxPage() {
    const { user, loading: authLoading, logout } = useAuth();
    const navigate = useNavigate();
    const [items, setItems] = useState<InboxItem[]>([]);
    const [diag, setDiag] = useState<InboxDiagnostic | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;                       // čekaj da AuthProvider završi getUser
        if (!user) { navigate('/login'); return; }
        const load = async () => {
            try {
                const { data } = await axiosClient.get('/api/approval-inbox');
                setItems(data.data || []);
                setDiag({
                    role: data.role ?? null,
                    is_admin: !!data.is_admin,
                    waiting_status: data.waiting_status ?? null,
                    assigned_section_count: data.assigned_section_count ?? null,
                });
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user, authLoading, navigate]);

    const handleLogout = async () => { await logout(); navigate('/login'); };

    if (authLoading) return (
        <div className="min-h-screen flex items-center justify-center text-slate-300">
            <Loader2 className="animate-spin" size={28} />
        </div>
    );
    if (!user) return null;

    const roleLabel = user.is_admin ? 'Administrator' : (user.role ? ROLE_LABEL_MAP[user.role] : 'Bez uloge');
    const hasNoRole = !user.is_admin && !user.role;

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <img src={logo} alt="Ratel" className="h-8" />
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                        <Inbox size={18} className="text-[#0056B3]" />
                        <span>Pregled poglavlja</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm font-bold text-dark-blue">{user.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                            {user.is_admin && <ShieldCheck size={11} />} {roleLabel}
                        </div>
                    </div>
                    {user.is_admin && (
                        <Link to="/admin" className="text-xs font-bold text-[#0056B3] border border-[#0056B3] px-3 py-1.5 rounded-lg hover:bg-blue-50">
                            Admin panel
                        </Link>
                    )}
                    <button onClick={handleLogout} title="Odjavi se"
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-4xl mx-auto px-8 py-10">
                <div className="mb-6">
                    <h1 className="text-2xl font-extrabold text-dark-blue mb-1">Poglavlja za pregled</h1>
                    <p className="text-sm text-slate-500">
                        Ovde se pojavljuju sva poglavlja koja čekaju vaš nivo odobrenja. Klikni na stavku da otvoriš i odobriš ili odbiješ.
                    </p>
                </div>

                {hasNoRole && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 font-semibold flex items-center gap-2 mb-6">
                        <Clock size={16} /> Još uvek nemate dodeljenu ulogu. Kontaktirajte administratora.
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center py-20 text-slate-300"><Loader2 className="animate-spin" size={28} /></div>
                ) : items.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl px-10 py-16 text-center">
                        <Inbox size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-base font-bold text-slate-500 mb-1">Inbox je prazan</p>
                        <p className="text-sm text-slate-400 mb-6">Trenutno nema poglavlja koja čekaju vaš pregled.</p>
                        {diag && (
                            <div className="inline-block text-left bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 text-xs text-slate-500 space-y-1">
                                <div className="font-bold text-slate-600 mb-2">Dijagnostika:</div>
                                <div>• Uloga: <strong>{diag.is_admin ? 'Administrator' : (diag.role || '— bez uloge —')}</strong></div>
                                <div>• Čeka se status: <strong>{diag.waiting_status || '— nijedan (nema odgovarajuće uloge) —'}</strong></div>
                                <div>• Dodeljena poglavlja: <strong>{diag.is_admin ? 'sva (admin)' : (diag.assigned_section_count ?? 0)}</strong></div>
                                {!diag.is_admin && (diag.assigned_section_count ?? 0) === 0 && (
                                    <div className="text-amber-700 mt-2">⚠ Nemate nijedno dodeljeno poglavlje. Zamoli admina da ti dodeli.</div>
                                )}
                                {!diag.is_admin && !diag.role && (
                                    <div className="text-amber-700 mt-2">⚠ Nema uloge — admin mora da ti je dodeli.</div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                        {items.map(it => (
                            <Link key={it.section_id} to={`/panel/${it.document_id}?section=${it.section_id}`}
                                className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition group">
                                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-[#0056B3] shrink-0">
                                    <FileText size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-dark-blue text-sm truncate">{it.section_title}</div>
                                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                                        {it.document_title} • {it.submitted_by ? `Poslao ${it.submitted_by}` : 'Poslato'} {fmtWhen(it.submitted_at)}
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-[#0056B3] bg-blue-50 px-3 py-1 rounded-full whitespace-nowrap hidden md:inline">
                                    {STATUS_LABEL_MAP[it.status] ?? it.status}
                                </span>
                                <ChevronRight size={18} className="text-slate-300 group-hover:text-[#0056B3]" />
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
