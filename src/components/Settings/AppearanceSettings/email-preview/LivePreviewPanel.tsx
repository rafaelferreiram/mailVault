import { useCallback, useRef, useState } from 'react';
import { usePrefsStore } from '@/stores/prefsStore';
import type { EmailViewPrefs, LayoutTemplate } from '@shared/types';
import { MOCK_EMAILS, type MockEmail } from './mockEmails';
import { MockEmailRow } from './MockEmailRow';
import { PreviewPane } from './PreviewPane';

const TEMPLATE_LABELS: Record<LayoutTemplate, string> = {
  classic: 'Classic',
  'master-detail': 'Master-Detail',
  focused: 'Focused',
  'dashboard-first': 'Dashboard First',
  'right-panel': 'Right Panel',
  'three-column': 'Three Column',
};

function summaryLabel(template: LayoutTemplate, ev: EmailViewPrefs): string {
  const density =
    ev.listDensity === 'comfortable'
      ? 'Comfortable'
      : ev.listDensity === 'compact'
        ? 'Compact'
        : 'Condensed';
  const preview =
    ev.listDensity === 'comfortable' ? `${ev.previewLines}-line preview` : 'no preview';
  const pane =
    ev.readingPane === 'off' ? 'Off pane' : ev.readingPane === 'right' ? 'Right pane' : 'Bottom pane';
  return `${TEMPLATE_LABELS[template]} · ${density} · ${preview} · ${pane}`;
}

export function LivePreviewPanel() {
  const template = usePrefsStore((s) => s.prefs.layout.template);
  const ev = usePrefsStore((s) => s.prefs.emailView);
  const setSplit = usePrefsStore((s) => s.setLayoutSplitPosition);
  const [selectedId, setSelectedId] = useState(MOCK_EMAILS[0].id);
  const [splitPct, setSplitPct] = useState(42);
  const dragRef = useRef<{ start: number; startPct: number; vertical: boolean } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const selected = MOCK_EMAILS.find((e) => e.id === selectedId) ?? null;
  const showPane = ev.readingPane !== 'off';

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!showPane) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        start: ev.readingPane === 'bottom' ? e.clientY : e.clientX,
        startPct: splitPct,
        vertical: ev.readingPane === 'bottom',
      };
    },
    [ev.readingPane, showPane, splitPct]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      const el = bodyRef.current;
      if (!d || !el) return;
      const rect = el.getBoundingClientRect();
      const delta = (d.vertical ? e.clientY : e.clientX) - d.start;
      const total = d.vertical ? rect.height : rect.width;
      let next = d.startPct + (delta / total) * 100;
      next = Math.max(28, Math.min(60, next));
      setSplitPct(next);
      const px = d.vertical
        ? Math.round((next / 100) * rect.height)
        : Math.round((next / 100) * rect.width);
      if (px >= 280) setSplit(px);
    },
    [setSplit]
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div className="email-view-preview-wrap">
      <div className="email-view-preview">
        <div className="email-view-preview__summary">{summaryLabel(template, ev)}</div>
        {ev.showSortBar && (
          <div className="px-3 py-1.5 border-b border-border-subtle flex gap-2 text-[10px] text-fg-muted font-mono">
            <span>Sort: Newest</span>
            <span>·</span>
            <span>Filter: All</span>
          </div>
        )}
        {ev.showEmailCount && (
          <div className="px-3 py-1 text-[10px] text-fg-subtle border-b border-border-subtle">
            1,240 emails
          </div>
        )}
        <div
          ref={bodyRef}
          className={`email-view-preview__body email-view-preview__body--${ev.readingPane === 'bottom' ? 'bottom' : 'right'}`}
          style={{ '--preview-split': `${splitPct}%` } as React.CSSProperties}
        >
          <div className="email-view-preview__list">
            {MOCK_EMAILS.map((email) => (
              <MockEmailRow
                key={email.id}
                sender={email.sender}
                subject={email.subject}
                preview={email.preview}
                date={email.date}
                categoryColor={email.categoryColor}
                isUnread={email.isUnread}
                hasAttachment={email.hasAttachment}
                density={ev.listDensity}
                previewLines={ev.previewLines}
                showAvatar={ev.showAvatars && ev.listDensity !== 'condensed'}
                showCategoryBadge={ev.showCategoryBadge}
                unreadStyle={ev.unreadStyle}
                selected={selectedId === email.id}
                onClick={() => setSelectedId(email.id)}
              />
            ))}
          </div>
          {showPane && (
            <>
              <div
                className="preview-split-handle"
                role="separator"
                aria-orientation={ev.readingPane === 'bottom' ? 'horizontal' : 'vertical'}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              />
              <PreviewPane
                email={selected}
                fontSize={ev.fontSize}
                lineSpacing={ev.lineSpacing}
                headerStyle={ev.headerDisplay}
                showImages={ev.showImages}
              />
            </>
          )}
        </div>
        {!showPane && selected && (
          <p className="text-[10px] text-fg-subtle p-3 border-t border-border-subtle">
            Reading pane off — opens full-screen modal in app
          </p>
        )}
      </div>
    </div>
  );
}
