import clsx from 'clsx';
import type { ReactNode } from 'react';
import {
  Mail,
  Database,
  Trash2,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import type { DashboardKpis } from '@shared/types';
import { formatBytes, formatNumber } from '@/lib/format';
import { useCountUp } from '@/hooks/useCountUp';
import { Icon as UiIcon } from '../ui/Icon';

type Props = {
  kpis: DashboardKpis;
  animate: boolean;
  onPendingClick?: () => void;
  showConfetti?: boolean;
};

export function KPIStrip({ kpis, animate, onPendingClick, showConfetti }: Props) {
  const total = useCountUp(kpis.totalEmails, { enabled: animate });
  const cleaned = useCountUp(kpis.cleanedCount, { enabled: animate });
  const newCount = useCountUp(kpis.newEmails, { enabled: animate });
  const pending = useCountUp(kpis.pendingActions, { enabled: animate });

  const weekGood = kpis.weekDelta <= 0;
  const storagePct = 0; // quota not available yet
  const barColor =
    storagePct > 80 ? 'bg-danger' : storagePct > 50 ? 'bg-warn' : 'bg-ok';

  return (
    <div className="dashboard-kpi-strip relative">
      {showConfetti && kpis.cleanedCount > 0 && <Confetti />}
      <KPITile
        icon={Mail}
        label="Total emails"
        value={formatNumber(total)}
        sub={
          kpis.weekDelta === 0
            ? 'no change this week'
            : `${kpis.weekDelta > 0 ? '+' : ''}${formatNumber(kpis.weekDelta)} this week`
        }
        subClass={weekGood ? 'text-ok' : 'text-danger'}
      />
      <KPITile
        icon={Database}
        label="Storage used"
        value={formatBytes(kpis.storageBytes)}
        sub="synced mailbox size"
        extra={
          <div className="mt-2 h-1 bg-bg-hover overflow-hidden">
            <div className={clsx('h-full transition-all', barColor)} style={{ width: '24%' }} />
          </div>
        }
      />
      <KPITile
        icon={Trash2}
        label="Cleaned this session"
        value={formatNumber(cleaned)}
        sub={kpis.cleanedBytes > 0 ? `freed ${formatBytes(kpis.cleanedBytes)}` : 'no deletions yet'}
        subClass="text-accent"
        accent
      />
      <KPITile
        icon={Inbox}
        label="New emails"
        value={formatNumber(newCount)}
        sub={kpis.newEmailsLabel}
        live={kpis.liveSyncActive}
      />
      <KPITile
        icon={AlertCircle}
        label="Pending actions"
        value={formatNumber(pending)}
        sub="need your review"
        alert={kpis.pendingActions > 0}
        danger={kpis.pendingActions > 5}
        onClick={onPendingClick}
      />
    </div>
  );
}

function KPITile({
  icon,
  label,
  value,
  sub,
  subClass,
  accent,
  live,
  alert,
  danger,
  extra,
  onClick,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  sub: string;
  subClass?: string;
  accent?: boolean;
  live?: boolean;
  alert?: boolean;
  danger?: boolean;
  extra?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={clsx(
        'dashboard-kpi-tile',
        alert && (danger ? 'dashboard-kpi-tile--danger' : 'dashboard-kpi-tile--alert'),
        onClick && 'cursor-pointer hover:bg-bg-hover transition-colors'
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="flex items-center gap-2 mb-1">
        <UiIcon icon={icon} size="sm" className={accent ? 'text-accent' : undefined} />
        <span className="label-mono text-[10px]">{label}</span>
        {live && (
          <span className="dashboard-live-dot w-1.5 h-1.5 rounded-full bg-ok ml-auto" title="Live sync on" />
        )}
      </div>
      <div
        className={clsx(
          'font-mono text-[22px] font-semibold tabular-nums leading-none',
          accent ? 'text-accent' : 'text-fg'
        )}
      >
        {value}
      </div>
      <div className={clsx('text-[10px] font-mono mt-1', subClass ?? 'text-fg-subtle')}>{sub}</div>
      {extra}
    </div>
  );
}

function Confetti() {
  const colors = ['#00d4ff', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6'];
  return (
    <div className="dashboard-confetti" aria-hidden>
      {colors.map((c, i) => (
        <span
          key={i}
          style={{
            background: c,
            left: `${12 + i * 16}%`,
            top: '8px',
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}
