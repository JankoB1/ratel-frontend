import { useEffect, useState, useCallback } from "react";
import {
    Check, X, AlertCircle, Loader2, Clock, CheckCircle2, MessageSquare,
    Send, ShieldAlert
} from "lucide-react";
import axiosClient from "../axios-client";
import { useAuth } from "../contexts/AuthContext";

interface ApprovalStage {
    id: number;
    name: string;
    at: string;
}

interface ApprovalState {
    status: string;
    submitted_by:    ApprovalStage | null;
    rukovodilac:     ApprovalStage | null;
    direktor:        ApprovalStage | null;
    kabinet:         ApprovalStage | null;
    admin:           ApprovalStage | null;
    rejected_by:     ApprovalStage | null;
    rejected_reason: string | null;
}

interface ApprovalEvent {
    id: number;
    action: string;
    as_role: string | null;
    comment: string | null;
    created_at: string;
    user: { id: number; name: string } | null;
}

interface Props {
    sectionId: number;
    /** Called after submit/approve/reject succeeds, so parent can refresh section list. */
    onChanged?: (newStatus: string) => void;
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
    draft:                { label: 'У изради',              color: 'text-slate-600 bg-slate-100' },
    pending_rukovodilac:  { label: 'Чека руководиоца',      color: 'text-purple-700 bg-purple-100' },
    pending_direktor:     { label: 'Чека директора',        color: 'text-amber-700 bg-amber-100' },
    pending_kabinet:      { label: 'Чека кабинет',          color: 'text-emerald-700 bg-emerald-100' },
    pending_admin:        { label: 'Чека админа',           color: 'text-blue-700 bg-blue-100' },
    approved:             { label: 'Одобрено',              color: 'text-green-700 bg-green-100' },
    rejected:             { label: 'Одбијено',              color: 'text-red-700 bg-red-100' },
};

const ROLE_LABEL: Record<string, string> = {
    editor: 'Уредник', rukovodilac: 'Руководилац', direktor: 'Директор', kabinet: 'Кабинет', admin: 'Администратор',
};

const ACTION_INFO: Record<string, { label: string; color: string; icon: any }> = {
    submitted: { label: 'послао на преглед', color: 'text-slate-600', icon: Clock },
    approved:  { label: 'одобрио',            color: 'text-green-700', icon: CheckCircle2 },
    rejected:  { label: 'одбио',              color: 'text-red-700',   icon: X },
    reset:     { label: 'ресетовао',          color: 'text-slate-500', icon: AlertCircle },
};

const fmtDateTime = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('sr-RS', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '—';

export default function ApprovalPanel({ sectionId, onChanged }: Props) {
    const { user } = useAuth();
    const [loading, setLoading]   = useState(true);
    const [approval, setApproval] = useState<ApprovalState | null>(null);
    const [events, setEvents]     = useState<ApprovalEvent[]>([]);
    const [acting, setActing]     = useState(false);
    const [comment, setComment]   = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectInput, setShowRejectInput] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axiosClient.get(`/api/sections/${sectionId}/approval-history`);
            setApproval(data.approval);
            setEvents(data.events || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [sectionId]);

    useEffect(() => { load(); }, [load]);

    const status = approval?.status ?? 'draft';
    const info = STATUS_INFO[status] ?? STATUS_INFO.draft;

    // Can current user submit (initial editor flow) or act on review (approver)?
    const isEditorOrAssigned = !!user && (user.is_admin || user.role === 'editor' || (user.role === null /* legacy */));
    const canSubmit  = (status === 'draft' || status === 'rejected') && isEditorOrAssigned;
    const canActNow  = (() => {
        if (!user || !approval) return false;
        if (status === 'pending_admin') return !!user.is_admin;
        const map: Record<string,string> = {
            pending_rukovodilac: 'rukovodilac',
            pending_direktor:    'direktor',
            pending_kabinet:     'kabinet',
        };
        return !!map[status] && user.role === map[status];
    })();

    const handleSubmit = async () => {
        if (!confirm("Послаћеш ову секцију на преглед. Након слања, сваки наредни корисник у ланцу може да направи измене и да одобри/одбије. Настављамо?")) return;
        setActing(true);
        try {
            const { data } = await axiosClient.post(`/api/sections/${sectionId}/submit`);
            onChanged?.(data?.approval?.status || 'pending_rukovodilac');
            await load();
        } catch (e: any) {
            alert("❌ " + (e?.response?.data?.message || 'Грешка при слању.'));
        } finally { setActing(false); }
    };

    const handleApprove = async () => {
        setActing(true);
        try {
            const { data } = await axiosClient.post(`/api/sections/${sectionId}/approve`, { comment: comment.trim() || null });
            setComment('');
            onChanged?.(data?.approval?.status || status);
            await load();
        } catch (e: any) {
            alert("❌ " + (e?.response?.data?.message || 'Грешка при одобравању.'));
        } finally { setActing(false); }
    };

    const handleReject = async () => {
        if (rejectReason.trim().length < 3) { alert('Унесите разлог (минимум 3 карактера).'); return; }
        if (!confirm('Одбијање ресетује сва дотадашња одобрења и враћа сецкију на ниво уредника. Настављамо?')) return;
        setActing(true);
        try {
            const { data } = await axiosClient.post(`/api/sections/${sectionId}/reject`, { reason: rejectReason.trim() });
            setRejectReason('');
            setShowRejectInput(false);
            onChanged?.(data?.approval?.status || 'rejected');
            await load();
        } catch (e: any) {
            alert("❌ " + (e?.response?.data?.message || 'Грешка при одбијању.'));
        } finally { setActing(false); }
    };

    if (loading) {
        return <div className="flex justify-center py-10 text-slate-300"><Loader2 className="animate-spin" size={22} /></div>;
    }

    const timeline = [
        { key: 'editor',      label: 'Уредник',      user: approval?.submitted_by },
        { key: 'rukovodilac', label: 'Руководилац',  user: approval?.rukovodilac },
        { key: 'direktor',    label: 'Директор',     user: approval?.direktor },
        { key: 'kabinet',     label: 'Кабинет',      user: approval?.kabinet },
        { key: 'admin',       label: 'Администратор', user: approval?.admin },
    ];

    // Hint: edit upozorenje (sadržaj je već prošao niže nivoe odobravanja)
    const hasDownstreamApprovals = !!(approval?.rukovodilac || approval?.direktor || approval?.kabinet);
    const isEditingApproved = status === 'approved' || (status.startsWith('pending_') && hasDownstreamApprovals);

    return (
        <div className="flex flex-col gap-4">
            {/* Status header */}
            <div className={`rounded-xl px-3 py-2.5 text-xs font-bold ${info.color}`}>
                {info.label.toUpperCase()}
            </div>

            {/* Edit warning */}
            {isEditingApproved && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-[11px] text-amber-700">
                    <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                    <span>Сваки чувани измена утиче на сву даљу проверу. Претходни нивои који су већ одобрили <strong>неће</strong> бити аутоматски ресетовани.</span>
                </div>
            )}

            {/* Action buttons */}
            {canSubmit && (
                <button onClick={handleSubmit} disabled={acting}
                    className="w-full py-2.5 rounded-xl bg-[#0056B3] text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
                    {acting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Пошаљи на преглед
                </button>
            )}

            {canActNow && !showRejectInput && (
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Коментар (опционо)</label>
                    <textarea value={comment} onChange={e => setComment(e.target.value)}
                        placeholder="Опционо уз одобрење"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#0056B3] resize-none"
                        rows={2} />
                    <button onClick={handleApprove} disabled={acting}
                        className="w-full py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
                        {acting ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Одобри
                    </button>
                    <button onClick={() => setShowRejectInput(true)} disabled={acting}
                        className="w-full py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 disabled:opacity-40 transition flex items-center justify-center gap-2">
                        <X size={13} /> Одбиј
                    </button>
                </div>
            )}

            {canActNow && showRejectInput && (
                <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-red-500">Разлог одбијања *</label>
                    <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder="Објасни шта није у реду..."
                        className="w-full border border-red-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-red-500 resize-none"
                        rows={3} autoFocus />
                    <button onClick={handleReject} disabled={acting || rejectReason.trim().length < 3}
                        className="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-40 transition flex items-center justify-center gap-2">
                        {acting ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Потврди одбијање
                    </button>
                    <button onClick={() => { setShowRejectInput(false); setRejectReason(''); }} disabled={acting}
                        className="w-full py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-700">
                        Откажи
                    </button>
                </div>
            )}

            {!canSubmit && !canActNow && (
                <div className="text-[11px] text-slate-500 px-3 py-2.5 bg-slate-50 rounded-xl">
                    {status === 'approved'
                        ? 'Финално одобрено — без додатних акција.'
                        : status === 'rejected'
                            ? 'Одбијено — само уредник може да пошаље поново.'
                            : status === 'draft'
                                ? 'Чека уредника да пошаље на преглед.'
                                : 'Овај ниво прегледа није твој.'}
                </div>
            )}

            {/* Status pipeline */}
            <div className="bg-white border border-slate-100 rounded-xl p-3">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Ток одобравања</div>
                <div className="flex flex-col gap-2">
                    {timeline.map(stage => (
                        <div key={stage.key} className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${stage.user ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-300'}`}>
                                {stage.user ? <Check size={10} /> : <Clock size={9} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-slate-600">{stage.label}</div>
                                <div className="text-[10px] text-slate-400 truncate">
                                    {stage.user ? `${stage.user.name} • ${fmtDateTime(stage.user.at)}` : '—'}
                                </div>
                            </div>
                        </div>
                    ))}
                    {approval?.rejected_by && (
                        <div className="flex items-start gap-2 pt-2 mt-1 border-t border-slate-100">
                            <div className="w-5 h-5 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                                <X size={10} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-red-700">Одбијено</div>
                                <div className="text-[10px] text-slate-400">{approval.rejected_by.name} • {fmtDateTime(approval.rejected_by.at)}</div>
                                {approval.rejected_reason && (
                                    <div className="text-[11px] text-slate-600 mt-1 italic">„{approval.rejected_reason}"</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Audit timeline */}
            {events.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-xl p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5">
                        <MessageSquare size={11} /> Историјат
                    </div>
                    <div className="flex flex-col gap-2.5">
                        {events.map(ev => {
                            const ainfo = ACTION_INFO[ev.action] || { label: ev.action, color: 'text-slate-600', icon: Clock };
                            const Icon = ainfo.icon;
                            return (
                                <div key={ev.id} className="flex items-start gap-1.5 text-[11px]">
                                    <Icon size={11} className={`${ainfo.color} shrink-0 mt-0.5`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-slate-700 leading-tight">
                                            <strong>{ev.user?.name ?? '—'}</strong>{' '}
                                            <span className={ainfo.color}>{ainfo.label}</span>
                                            {ev.as_role && <span className="text-slate-400"> ({ROLE_LABEL[ev.as_role] ?? ev.as_role})</span>}
                                        </div>
                                        {ev.comment && <div className="text-slate-500 italic mt-0.5">„{ev.comment}"</div>}
                                        <div className="text-[10px] text-slate-300 mt-0.5">{fmtDateTime(ev.created_at)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
