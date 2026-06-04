import { useEffect, useState } from 'react';
import {
  Activity,
  Brush,
  Check,
  ChevronRight,
  ExternalLink,
  Globe,
  Lock,
  Mail,
  Search,
  Trash2,
  Sparkles,
  ShieldOff,
  Filter,
} from 'lucide-react';
import clsx from 'clsx';
import { BrandLockupHorizontal, BrandMarkCompact } from '../Brand';

// ─── 1. Analyze → Organize → Clean (hero animation) ────────────────

export function HeroFlow() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => (n + 1) % 3), 1100);
    return () => clearInterval(t);
  }, []);

  const steps = [
    { icon: Search, label: 'Analyze', tone: 'text-accent border-accent' },
    { icon: Filter, label: 'Organize', tone: 'text-info border-info' },
    { icon: Trash2, label: 'Clean', tone: 'text-ok border-ok' },
  ];

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <BrandLockupHorizontal className="h-7 w-auto text-fg" />
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => {
          const active = tick === i;
          const Icon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className={clsx(
                  'w-16 h-16 border flex flex-col items-center justify-center gap-1 transition-all',
                  active
                    ? `${s.tone} bg-bg-inset shadow-[0_0_0_4px_rgba(0,212,255,0.10)]`
                    : 'border-border text-fg-subtle'
                )}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.5} />
                <span className="text-[10px] font-mono uppercase tracking-widest">
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight
                  className={clsx(
                    'w-4 h-4 transition-colors',
                    tick > i ? 'text-accent' : 'text-fg-subtle'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 3. OAuth flow ─────────────────────────────────────────────────

export function OAuthFlow() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => (n + 1) % 4), 950);
    return () => clearInterval(t);
  }, []);

  const beats = [
    { label: 'MailVault', icon: BrandMarkCompact },
    { label: 'Browser', icon: Globe },
    { label: 'Provider', icon: Lock },
    { label: 'Back to app', icon: Check },
  ];

  return (
    <div className="flex items-center justify-between gap-1">
      {beats.map((b, i) => {
        const active = tick === i;
        const passed = tick > i;
        const Icon = b.icon;
        return (
          <div key={b.label} className="flex items-center gap-1 flex-1 min-w-0">
            <div
              className={clsx(
                'w-full px-2 py-1.5 border flex items-center gap-1.5 transition-colors',
                active
                  ? 'border-accent text-accent bg-accent/5'
                  : passed
                  ? 'border-ok/40 text-ok'
                  : 'border-border text-fg-muted'
              )}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span className="text-[10px] font-mono uppercase tracking-wider truncate">
                {b.label}
              </span>
            </div>
            {i < beats.length - 1 && (
              <ChevronRight
                className={clsx(
                  'w-3 h-3 shrink-0 transition-colors',
                  passed ? 'text-accent' : 'text-fg-subtle'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 4. Time range bar (mini visual mirroring the real selector) ──

export function TimeRangeMock() {
  const ranges = [
    { label: '7d', count: '~250' },
    { label: '30d', count: '~1.2k' },
    { label: '1y', count: '~14k' },
    { label: 'All', count: '~120k' },
  ];
  const [active, setActive] = useState(2); // 1y
  return (
    <div className="space-y-2">
      <div className="flex gap-px">
        {ranges.map((r, i) => {
          const a = active === i;
          return (
            <button
              key={r.label}
              onClick={() => setActive(i)}
              className={clsx(
                'flex-1 h-7 border text-[11px] font-mono uppercase tracking-wider transition-colors',
                a
                  ? 'border-accent text-accent bg-accent/10'
                  : 'border-border text-fg-muted hover:text-fg'
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="label-mono">Estimated emails</span>
        <span className="font-mono text-[18px] tabular-nums text-accent animate-count-pulse">
          {ranges[active].count}
        </span>
      </div>
    </div>
  );
}

// ─── 5. Sync drawer mock (animated log + stage bar) ───────────────

export function SyncDrawerMock() {
  const [stage, setStage] = useState(0);
  const [logCount, setLogCount] = useState(1);

  useEffect(() => {
    const stages = setInterval(() => setStage((s) => (s + 1) % 5), 800);
    const logs = setInterval(
      () => setLogCount((n) => (n >= 5 ? 1 : n + 1)),
      350
    );
    return () => {
      clearInterval(stages);
      clearInterval(logs);
    };
  }, []);

  const stageLabels = ['fetch', 'group', 'storage', 'detect', 'suggest'];
  const logLines = [
    { kind: 'info', text: '[fetch]   page 1/14   500 messages' },
    { kind: 'discover', text: '[group]   312 unique senders so far' },
    { kind: 'info', text: '[storage] 48 MB attributed' },
    { kind: 'discover', text: '[detect]  newsletter from medium.com' },
    { kind: 'ok', text: '[done]    14,231 messages analyzed' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Activity className="w-3 h-3 text-accent" />
        <span className="label-mono-strong">Sync engine</span>
        <span className="ml-auto label-mono text-fg-subtle tabular-nums">00:14.6</span>
      </div>
      <div className="stage-bar">
        {stageLabels.map((_, i) => (
          <div
            key={i}
            className={clsx(
              'stage-seg',
              i < stage ? 'done' : i === stage ? 'active' : ''
            )}
            style={i === stage ? ({ ['--seg-fill' as string]: 0.6 } as React.CSSProperties) : undefined}
          />
        ))}
      </div>
      <div className="bg-bg-inset border border-border-subtle p-2 space-y-px h-[68px] overflow-hidden font-term text-[10.5px] leading-[14px]">
        {logLines.slice(0, logCount).map((l, i) => (
          <div
            key={i}
            className={clsx(
              'animate-log-in',
              l.kind === 'discover' && 'text-accent',
              l.kind === 'ok' && 'text-ok',
              l.kind === 'info' && 'text-fg'
            )}
          >
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 6. Sender row anatomy (annotated row) ────────────────────────

export function SenderRowMock() {
  return (
    <div className="space-y-3">
      <div className="grid grid-row grid-cols-[24px_24px_1fr_70px_60px_90px] items-center gap-2 px-2 bg-bg border border-border">
        <input type="checkbox" className="accent-accent" defaultChecked={false} />
        <div className="w-5 h-5 bg-info/30 border border-info/50 flex items-center justify-center text-[9px] font-mono">
          M
        </div>
        <div className="min-w-0">
          <div className="text-[12px] truncate">Medium Daily Digest</div>
          <div className="text-[10px] font-mono text-fg-subtle truncate">
            noreply@medium.com
          </div>
        </div>
        <div className="font-mono text-[11px] tabular-nums text-fg text-right">
          312
        </div>
        <div className="font-mono text-[11px] tabular-nums text-fg-muted text-right">
          48 MB
        </div>
        <div className="font-mono text-[10px] text-fg-subtle text-right">
          Jan 21 → now
        </div>
      </div>
      <div className="grid grid-cols-[24px_24px_1fr_70px_60px_90px] gap-2 px-2 text-[9px] font-mono uppercase tracking-widest text-accent">
        <span>select</span>
        <span>icon</span>
        <span>sender</span>
        <span>count</span>
        <span>size</span>
        <span>range</span>
      </div>
    </div>
  );
}

// ─── 7. Select-and-act animation ──────────────────────────────────

export function SelectAnimateMock() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => (n + 1) % 4), 800);
    return () => clearInterval(t);
  }, []);
  // 0: row idle  → 1: checkbox checked → 2: row highlighted → 3: action bar pulse
  return (
    <div className="space-y-3">
      <div
        className={clsx(
          'grid grid-row grid-cols-[24px_1fr_70px] items-center gap-2 px-2 border transition-colors',
          tick >= 2 ? 'border-accent bg-accent/5' : 'border-border bg-bg'
        )}
      >
        <div
          className={clsx(
            'w-3.5 h-3.5 border flex items-center justify-center transition-colors',
            tick >= 1 ? 'bg-accent border-accent' : 'border-border'
          )}
        >
          {tick >= 1 && <Check className="w-3 h-3 text-bg" strokeWidth={3} />}
        </div>
        <div className="min-w-0">
          <div className="text-[12px] truncate">Substack subscriptions</div>
          <div className="text-[10px] font-mono text-fg-subtle truncate">
            no-reply@substack.com
          </div>
        </div>
        <div className="font-mono text-[11px] text-fg-muted text-right">
          412 emails
        </div>
      </div>

      <div
        className={clsx(
          'border h-9 flex items-center justify-between px-3 transition-all',
          tick >= 3
            ? 'border-danger bg-danger/10 shadow-[0_0_0_3px_rgba(255,61,87,0.16)]'
            : tick >= 2
            ? 'border-border bg-bg-inset'
            : 'border-border-subtle bg-bg-inset opacity-60'
        )}
      >
        <span className="label-mono-strong">
          {tick >= 2 ? '1 sender · 412 emails' : 'Action bar'}
        </span>
        <span
          className={clsx(
            'btn text-[11px]',
            tick >= 3
              ? 'btn-danger animate-pulse-soft'
              : 'border-border text-fg-subtle'
          )}
        >
          <Trash2 className="w-3 h-3" /> Review &amp; Delete
        </span>
      </div>
    </div>
  );
}

// ─── 8. Confirmation panel mock ───────────────────────────────────

export function ConfirmPanelMock() {
  const senders = [
    {
      email: 'newsletter@medium.com',
      count: 142,
      size: '12 MB',
      subjects: ['Top stories from Jan 14', 'Weekly digest', 'New from your authors'],
      approved: true,
    },
    {
      email: 'sales@expedia.com',
      count: 88,
      size: '6 MB',
      subjects: ['Last-minute deals', 'Your trip is coming up'],
      approved: false,
    },
  ];

  return (
    <div className="space-y-2">
      {senders.map((s) => (
        <div
          key={s.email}
          className={clsx(
            'border bg-bg-inset/50 p-2',
            s.approved ? 'border-danger/40' : 'border-border-subtle'
          )}
        >
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] truncate flex-1">{s.email}</span>
            <span className="font-mono text-[10px] text-fg-subtle tabular-nums">
              {s.count} · {s.size}
            </span>
            <button
              className={clsx(
                'h-5 px-1.5 border text-[10px] font-mono uppercase tracking-widest',
                s.approved
                  ? 'border-danger/60 text-danger bg-danger/10'
                  : 'border-border text-fg-subtle'
              )}
            >
              {s.approved ? '✓ Delete' : 'Skip'}
            </button>
          </div>
          <ul className="mt-1.5 ml-3 space-y-px">
            {s.subjects.map((sub, i) => (
              <li
                key={i}
                className="text-[10.5px] text-fg-muted leading-tight truncate"
              >
                – {sub}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex justify-end pt-1">
        <span className="btn btn-danger text-[11px]">
          <Trash2 className="w-3 h-3" /> Confirm 1 sender · 142 emails
        </span>
      </div>
    </div>
  );
}

// ─── 10. Rules / Blocked dual-tab visual ──────────────────────────

export function RulesBlockingMock() {
  const [tab, setTab] = useState<'rules' | 'blocked'>('rules');
  return (
    <div className="space-y-2">
      <div className="flex border-b border-border-subtle">
        {[
          { id: 'rules' as const, label: 'Rules' },
          { id: 'blocked' as const, label: 'Blocked' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx(
              'px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider border-b -mb-px',
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-fg-muted hover:text-fg'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'rules' ? (
        <div className="space-y-1">
          <RuleRow
            icon={<Filter className="w-3 h-3 text-info" />}
            text="if subject contains 'invoice'"
            action="→ move to Receipts"
          />
          <RuleRow
            icon={<Filter className="w-3 h-3 text-info" />}
            text="if from @newsletters.com"
            action="→ label as Newsletter"
          />
          <RuleRow
            icon={<Filter className="w-3 h-3 text-info" />}
            text="if older than 1 year"
            action="→ archive"
          />
        </div>
      ) : (
        <div className="space-y-1">
          <BlockedRow email="spam@promos.com" reason="Auto-deletes future" />
          <BlockedRow email="alerts@oldjob.com" reason="History purged" />
          <BlockedRow email="noreply@gym.com" reason="Auto-deletes future" />
        </div>
      )}
    </div>
  );
}

function RuleRow({
  icon,
  text,
  action,
}: {
  icon: React.ReactNode;
  text: string;
  action: string;
}) {
  return (
    <div className="grid grid-cols-[18px_1fr_auto] items-center gap-2 px-2 h-7 border border-border-subtle bg-bg-inset/50">
      {icon}
      <span className="font-mono text-[10.5px] truncate text-fg">{text}</span>
      <span className="font-mono text-[10.5px] text-fg-muted">{action}</span>
    </div>
  );
}

function BlockedRow({ email, reason }: { email: string; reason: string }) {
  return (
    <div className="grid grid-cols-[18px_1fr_auto] items-center gap-2 px-2 h-7 border border-border-subtle bg-bg-inset/50">
      <ShieldOff className="w-3 h-3 text-danger" />
      <span className="font-mono text-[10.5px] truncate">{email}</span>
      <span className="text-[10px] text-danger/80 uppercase font-mono tracking-widest">
        {reason}
      </span>
    </div>
  );
}

// ─── 11. Cheat sheet (printable card) ─────────────────────────────

export function CheatSheet() {
  const rows = [
    { keys: ['?'], text: 'Show all keyboard shortcuts' },
    { keys: ['⌘', '⇧', '?'], text: 'Restart this tour anytime' },
    { keys: ['1', '–', '7'], text: 'Switch view (Dashboard … Settings)' },
    { keys: ['⌘', '1', '–', '4'], text: 'Switch active email account' },
    { keys: ['⌘', 'J'], text: 'Toggle the sync drawer' },
    { keys: ['⌘', 'D'], text: 'Toggle compact density' },
    { keys: ['S'], text: 'Start sync (on Analyze screen)' },
    { keys: ['⌘', 'Z'], text: 'Undo last deletion (30s window)' },
  ];

  return (
    <div className="border border-border bg-bg-inset/60 divide-y divide-border-subtle">
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2 items-center"
        >
          <div className="flex gap-1 flex-wrap">
            {r.keys.map((k, j) => (
              <kbd
                key={j}
                className={clsx(
                  k === '–'
                    ? 'px-0 text-fg-subtle font-mono text-[11px]'
                    : 'kbd'
                )}
              >
                {k}
              </kbd>
            ))}
          </div>
          <span className="text-[12px] text-fg-muted">{r.text}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Step 9: how-to mini steps ────────────────────────────────────

export function FoldersHowTo() {
  return (
    <ol className="space-y-1.5 text-[12px] text-fg-muted">
      <HowToStep n={1} text='Click "+" next to Folders to create a new folder.' />
      <HowToStep n={2} text="Select a sender group in the main view." />
      <HowToStep n={3} text="Right-click → Move, or use the action bar." />
      <HowToStep n={4} text="Pick your folder from the quick picker." />
    </ol>
  );
}

function HowToStep({ n, text }: { n: number; text: string }) {
  return (
    <li className="flex gap-2.5">
      <span className="kbd shrink-0">{n}</span>
      <span>{text}</span>
    </li>
  );
}

// ─── (re-exports for convenience) ─────────────────────────────────

export const _icons = { Mail, ExternalLink, Brush, Sparkles };
