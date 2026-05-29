import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    Loader2, LogOut, FileText, ChevronRight, ShieldCheck, Inbox,
    Clock, CheckCircle2, AlertCircle, FilePlus, Eye, EyeOff,
} from "lucide-react";
import axiosClient from "../axios-client";
import { useAuth } from "../contexts/AuthContext";
import logo from "../assets/logo.svg";

interface DashboardSection {
    id: number;
    title: string;
    order: number;
    is_disabled: boolean;
    approval_status: string;
    rejected_reason: string | null;
    updated_at: string;
}

interface DashboardDoc {
    id: number;
    title: string;
    type: string | null;
    sections: DashboardSection[];
}

const ROLE_LABEL_MAP: Record<string, string> = {
    editor: 'Уредник',
    rukovodilac: 'Руководилац',
    direktor: 'Директор',
    kabinet: 'Кабинет',
};

const TYPE_LABEL: Record<string, string> = {
    annual_report:    'Годишњи извештај',
    financial_report: 'Финансијски извештај',
    financial_plan:   'Финансијски план',
};

// Status badge boje + labela
const STATUS_INFO: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
    draft:                { label: 'У изради',          color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', icon: FilePlus },
    pending_rukovodilac:  { label: 'Чека руководиоца',   color: '#7c3aed', bg: '#f3e8ff', border: '#c4b5fd', icon: Clock },
    pending_direktor:     { label: 'Чека директора',     color: '#d97706', bg: '#fef3c7', border: '#fcd34d', icon: Clock },
    pending_kabinet:      { label: 'Чека кабинет',       color: '#059669', bg: '#d1fae5', border: '#6ee7b7', icon: Clock },
    pending_admin:        { label: 'Чека админа',        color: '#0056B3', bg: '#dbeafe', border: '#93c5fd', icon: Clock },
    approved:             { label: 'Одобрено',           color: '#15803d', bg: '#dcfce7', border: '#86efac', icon: CheckCircle2 },
    rejected:             { label: 'Одбијено',           color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', icon: AlertCircle },
};
const getStatusInfo = (s: string) => STATUS_INFO[s] || STATUS_INFO.draft;

const fmtWhen = (iso: string | null) => {
    if (!iso) return '—';
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return 'малопре';
    if (diff < 3600)  return `пре ${Math.floor(diff / 60)} мин`;
    if (diff < 86400) return `пре ${Math.floor(diff / 3600)} ч`;
    if (diff < 604800) return `пре ${Math.floor(diff / 86400)} дана`;
    return new Date(iso).toLocaleDateString('sr-RS', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function DashboardPage() {
    const { user, loading: authLoading, logout } = useAuth();
    const navigate = useNavigate();
    const [docs, setDocs] = useState<DashboardDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [inboxCount, setInboxCount] = useState(0);

    useEffect(() => {
        if (authLoading) return;
        if (!user) { navigate('/login'); return; }
        // Admin ide u svoj panel
        if (user.is_admin) { navigate('/admin'); return; }

        const load = async () => {
            try {
                const [my, inbox] = await Promise.all([
                    axiosClient.get('/api/my-sections'),
                    axiosClient.get('/api/approval-inbox/count').catch(() => ({ data: { count: 0 } })),
                ]);
                setDocs(my.data?.documents || []);
                setInboxCount(inbox.data?.count || 0);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [user, authLoading, navigate]);

    const handleLogout = async () => { await logout(); navigate('/login'); };

    const openSection = (docId: number, sectionId: number) => {
        navigate(`/panel/${docId}?section=${sectionId}`);
    };

    if (authLoading) return (
        <div className="min-h-screen flex items-center justify-center text-slate-300">
            <Loader2 className="animate-spin" size={28} />
        </div>
    );
    if (!user) return null;

    const roleLabel = user.role ? ROLE_LABEL_MAP[user.role] : 'Без улоге';
    const isReviewer = user.role && ['rukovodilac', 'direktor', 'kabinet'].includes(user.role);
    const totalSections = docs.reduce((sum, d) => sum + d.sections.length, 0);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <img src={logo} alt="Ratel" className="h-7 md:h-8" />
                    <div className="hidden sm:block">
                        <div className="text-xs text-slate-400 uppercase tracking-wide font-bold">Портал</div>
                        <div className="font-extrabold text-sm md:text-base text-dark-blue">Моја поглавља</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-dark-blue">{user.name}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                            {user.is_admin && <ShieldCheck size={11} />} {roleLabel}
                        </div>
                    </div>
                    {isReviewer && (
                        <Link to="/inbox" title="Inbox — поглавља за преглед"
                            className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-[#0056B3] hover:bg-slate-50 transition">
                            <Inbox size={16} />
                            <span className="text-xs font-bold hidden sm:inline">Inbox</span>
                            {inboxCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                                    {inboxCount}
                                </span>
                            )}
                        </Link>
                    )}
                    <button onClick={handleLogout} title="Одјави се"
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition">
                        <LogOut size={18} />
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-10">
                <div className="mb-6 md:mb-8">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-dark-blue mb-1">
                        Добродошли, {user.name.split(' ')[0]}
                    </h1>
                    <p className="text-sm text-slate-500">
                        {loading
                            ? 'Учитавање ваших додељених поглавља...'
                            : totalSections === 0
                                ? 'Тренутно вам није додељено ниједно поглавље.'
                                : `Имате приступ за уређивање ${totalSections} ${totalSections === 1 ? 'поглавља' : 'поглавља'} у ${docs.length} ${docs.length === 1 ? 'документу' : 'докумената'}.`}
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20 text-slate-300">
                        <Loader2 className="animate-spin" size={32} />
                    </div>
                ) : docs.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl px-10 py-16 text-center">
                        <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-base font-bold text-slate-500 mb-1">Нема додељених поглавља</p>
                        <p className="text-sm text-slate-400 mb-2">
                            Тренутно вам није додељено ниједно поглавље за уређивање.
                        </p>
                        <p className="text-xs text-slate-400">
                            Контактирајте администратора ако сматрате да је ово грешка.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {docs.map(doc => (
                            <section key={doc.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                {/* Document header */}
                                <div className="px-5 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 bg-[#0056B3]/10 rounded-lg flex items-center justify-center shrink-0">
                                            <FileText size={18} className="text-[#0056B3]" />
                                        </div>
                                        <div className="min-w-0">
                                            {doc.type && (
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-[#0056B3]/60">
                                                    {TYPE_LABEL[doc.type] || doc.type}
                                                </p>
                                            )}
                                            <h2 className="font-extrabold text-base md:text-lg text-dark-blue truncate">
                                                {doc.title}
                                            </h2>
                                        </div>
                                    </div>
                                    <span className="text-xs text-slate-400 font-bold whitespace-nowrap">
                                        {doc.sections.length} {doc.sections.length === 1 ? 'поглавље' : 'поглавља'}
                                    </span>
                                </div>

                                {/* Sections grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 md:p-5">
                                    {doc.sections.map(sec => {
                                        const info = getStatusInfo(sec.approval_status);
                                        const Icon = info.icon;
                                        return (
                                            <button
                                                key={sec.id}
                                                onClick={() => openSection(doc.id, sec.id)}
                                                className="flex flex-col text-left bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-[#0056B3] hover:shadow-md transition-all duration-150 group"
                                            >
                                                <div className="flex items-start gap-2 mb-2">
                                                    <span className="text-[10px] font-bold text-slate-300 w-5 shrink-0 mt-0.5">{sec.order}.</span>
                                                    <h3 className="text-sm font-bold text-dark-blue leading-tight flex-1 line-clamp-2 group-hover:text-[#0056B3] transition-colors">
                                                        {sec.title}
                                                    </h3>
                                                    <ChevronRight size={16} className="text-slate-300 group-hover:text-[#0056B3] transition-colors shrink-0 mt-0.5" />
                                                </div>
                                                <div className="flex items-center justify-between gap-2 mt-auto">
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                                                        style={{ color: info.color, backgroundColor: info.bg, borderColor: info.border }}
                                                    >
                                                        <Icon size={10} /> {info.label}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                                        {sec.is_disabled && (
                                                            <span title="Поглавље је деактивирано" className="text-slate-400">
                                                                <EyeOff size={10} />
                                                            </span>
                                                        )}
                                                        {!sec.is_disabled && (
                                                            <span title="Поглавље је активно" className="text-slate-300">
                                                                <Eye size={10} />
                                                            </span>
                                                        )}
                                                        <span>{fmtWhen(sec.updated_at)}</span>
                                                    </div>
                                                </div>
                                                {sec.approval_status === 'rejected' && sec.rejected_reason && (
                                                    <p className="text-[10px] text-red-600 mt-1.5 italic line-clamp-1" title={sec.rejected_reason}>
                                                        „{sec.rejected_reason}"
                                                    </p>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
