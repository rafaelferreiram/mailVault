import type { LayoutTemplate } from '@shared/types';

const SB = 'fill-[rgb(var(--color-bg-elevated))] stroke-[rgb(var(--color-border-subtle))] stroke-[0.5]';
const CT = 'fill-[rgb(var(--color-bg))] stroke-[rgb(var(--color-border-subtle))] stroke-[0.5]';
const LS = 'fill-[rgb(var(--color-bg-hover))] stroke-[rgb(var(--color-border-subtle))] stroke-[0.5]';
const PV = 'fill-[rgb(var(--color-bg-surface))] stroke-[rgb(var(--color-border-subtle))] stroke-[0.5]';
const ST = 'fill-[rgb(var(--color-accent)/0.15)] stroke-none';

function R({
  x,
  y,
  w,
  h,
  cls,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  cls: string;
}) {
  return <rect x={x} y={y} width={w} height={h} rx={2} className={cls} />;
}

export function LayoutDiagram({ id }: { id: LayoutTemplate }) {
  const vb = '0 0 196 88';
  switch (id) {
    case 'classic':
      return (
        <svg viewBox={vb} className="w-full h-full" aria-hidden>
          <R x={4} y={4} w={28} h={80} cls={SB} />
          <R x={36} y={4} w={156} h={80} cls={CT} />
        </svg>
      );
    case 'master-detail':
      return (
        <svg viewBox={vb} className="w-full h-full" aria-hidden>
          <R x={4} y={4} w={24} h={80} cls={SB} />
          <R x={32} y={4} w={52} h={80} cls={LS} />
          <R x={88} y={4} w={104} h={80} cls={PV} />
        </svg>
      );
    case 'focused':
      return (
        <svg viewBox={vb} className="w-full h-full" aria-hidden>
          <R x={4} y={4} w={14} h={80} cls={SB} />
          <R x={22} y={4} w={170} h={80} cls={CT} />
        </svg>
      );
    case 'dashboard-first':
      return (
        <svg viewBox={vb} className="w-full h-full" aria-hidden>
          <R x={4} y={4} w={24} h={80} cls={SB} />
          <R x={32} y={4} w={160} h={18} cls={ST} />
          <R x={32} y={26} w={160} h={58} cls={CT} />
        </svg>
      );
    case 'right-panel':
      return (
        <svg viewBox={vb} className="w-full h-full" aria-hidden>
          <R x={4} y={4} w={132} h={80} cls={CT} />
          <R x={140} y={4} w={52} h={80} cls={SB} />
        </svg>
      );
    case 'three-column':
      return (
        <svg viewBox={vb} className="w-full h-full" aria-hidden>
          <R x={4} y={4} w={22} h={80} cls={SB} />
          <R x={30} y={4} w={48} h={80} cls={LS} />
          <R x={82} y={4} w={110} h={80} cls={PV} />
        </svg>
      );
    default:
      return null;
  }
}

export const LAYOUT_OPTIONS: Array<{
  id: LayoutTemplate;
  name: string;
  description: string;
  bestFor: string;
}> = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Sidebar left, content full width. Clean and focused.',
    bestFor: 'Users who work on one thing at a time.',
  },
  {
    id: 'master-detail',
    name: 'Master — Detail',
    description: 'Sidebar, email list, and preview pane side by side.',
    bestFor: 'Power users who want list + preview together.',
  },
  {
    id: 'focused',
    name: 'Focused',
    description: 'Sidebar collapses to icon-only. Maximum content space.',
    bestFor: 'Users on smaller screens or who prefer fewer distractions.',
  },
  {
    id: 'dashboard-first',
    name: 'Dashboard First',
    description: 'Sidebar, mini stats strip on top, then content below.',
    bestFor: 'Users who want quick stats always visible.',
  },
  {
    id: 'right-panel',
    name: 'Right Panel',
    description: 'Main content left, sidebar and details on the right.',
    bestFor: 'Right-handed users or those coming from other tools.',
  },
  {
    id: 'three-column',
    name: 'Three Column',
    description: 'Sidebar, sender list, and detail panel all visible.',
    bestFor: 'Wide monitors. Maximum information density.',
  },
];
