import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";
import axiosClient from "../axios-client";

interface Props {
    /** Style variant — light for dark backgrounds, dark for light. Default: dark. */
    variant?: 'light' | 'dark';
}

/**
 * Floating link to /inbox sa brojem stavki koje čekaju trenutnog korisnika.
 * Tih ako je count = 0 (samo Inbox ikona). Highlight ako count > 0.
 */
export default function InboxBadge({ variant = 'dark' }: Props) {
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const { data } = await axiosClient.get('/api/approval-inbox/count');
                if (!cancelled) setCount(data?.count ?? 0);
            } catch {
                if (!cancelled) setCount(0);
            }
        };
        load();
        // Refresh on tab focus
        const onFocus = () => load();
        window.addEventListener('focus', onFocus);
        return () => { cancelled = true; window.removeEventListener('focus', onFocus); };
    }, []);

    const hasPending = (count ?? 0) > 0;
    const baseClass = variant === 'light'
        ? 'text-white/80 hover:text-white'
        : 'text-slate-500 hover:text-[#0056B3]';

    return (
        <Link to="/inbox" title="Inbox — poglavlja za pregled"
            className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${baseClass} ${hasPending ? 'font-bold' : ''}`}>
            <Inbox size={16} />
            <span className="text-xs">Inbox</span>
            {hasPending && (
                <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-extrabold flex items-center justify-center">
                    {count! > 99 ? '99+' : count}
                </span>
            )}
        </Link>
    );
}
