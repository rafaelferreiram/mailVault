import clsx from 'clsx';
import { usePrefsStore } from '@/stores/prefsStore';
import type {
  DateFormatMode,
  EmailHeaderDisplay,
  EmailListDensity,
  LineSpacingMode,
  MarkAsReadMode,
  ReadingPanePosition,
  RemoteImagesMode,
  SenderDisplayMode,
  UnreadStyleMode,
} from '@shared/types';
import { ControlBlock, IosToggle, RadioPills, ReadingPaneIcon } from './controls';
import { LivePreviewPanel } from './email-preview/LivePreviewPanel';

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="appearance-section-header">
      <div className="label-mono">{title}</div>
      <p>{subtitle}</p>
    </header>
  );
}

export function EmailViewSection() {
  const ev = usePrefsStore((s) => s.prefs.emailView);
  const patch = usePrefsStore((s) => s.patchEmailView);
  const paneOn = ev.readingPane !== 'off';
  const comfortable = ev.listDensity === 'comfortable';

  return (
    <div>
      <SectionHeader
        title="Email view"
        subtitle="Configure how your email list and reading pane appear. All changes preview live on the right."
      />
      <div className="email-view-section">
        <div className="email-view-controls">
          <ControlBlock label="Reading pane">
            <div className="flex gap-2">
              {(
                [
                  { id: 'off' as const, label: 'Off', sub: 'No preview pane' },
                  { id: 'right' as const, label: 'Right', sub: 'Side by side' },
                  { id: 'bottom' as const, label: 'Bottom', sub: 'List then detail' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={clsx(
                    'icon-option-card flex-1',
                    ev.readingPane === opt.id && 'icon-option-card--selected'
                  )}
                  onClick={() => patch({ readingPane: opt.id as ReadingPanePosition })}
                >
                  <ReadingPaneIcon mode={opt.id} />
                  <div className="text-[11px] font-medium mt-2">{opt.label}</div>
                  <div className="text-[9px] text-fg-subtle">{opt.sub}</div>
                </button>
              ))}
            </div>
          </ControlBlock>

          <ControlBlock label="Email list">
            <div className="space-y-2">
              {(
                [
                  { id: 'comfortable' as EmailListDensity, label: 'Comfortable' },
                  { id: 'compact' as EmailListDensity, label: 'Compact' },
                  { id: 'condensed' as EmailListDensity, label: 'Condensed' },
                ] as const
              ).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={clsx(
                    'density-illustration w-full text-left',
                    ev.listDensity === d.id && 'density-illustration--selected'
                  )}
                  onClick={() => patch({ listDensity: d.id })}
                >
                  <span className="text-[11px] font-medium">{d.label}</span>
                  <div className="mt-2 space-y-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="bg-bg-hover rounded"
                        style={{
                          height: d.id === 'comfortable' ? 14 : d.id === 'compact' ? 8 : 5,
                        }}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </ControlBlock>

          <ControlBlock label="Preview text" disabled={!comfortable}>
            <RadioPills<'1' | '2' | '3'>
              options={[
                { id: '1', label: '1 line' },
                { id: '2', label: '2 lines' },
                { id: '3', label: '3 lines' },
              ]}
              value={String(ev.previewLines) as '1' | '2' | '3'}
              onChange={(v) => patch({ previewLines: Number(v) as 1 | 2 | 3 })}
              disabled={!comfortable}
            />
          </ControlBlock>

          <ControlBlock label="Show sender as">
            <RadioPills<SenderDisplayMode>
              options={[
                { id: 'name', label: 'Name' },
                { id: 'email', label: 'Email address' },
                { id: 'both', label: 'Name + Email' },
              ]}
              value={ev.senderDisplay}
              onChange={(v) => patch({ senderDisplay: v })}
            />
          </ControlBlock>

          <ControlBlock label="Date format">
            <RadioPills<DateFormatMode>
              options={[
                { id: 'smart', label: 'Smart' },
                { id: 'relative', label: 'Relative' },
                { id: 'absolute', label: 'Absolute' },
              ]}
              value={ev.dateFormat}
              onChange={(v) => patch({ dateFormat: v })}
            />
          </ControlBlock>

          <IosToggle
            label="Sender avatars"
            checked={ev.showAvatars}
            onChange={(v) => patch({ showAvatars: v })}
          />

          <ControlBlock label="Unread emails">
            <RadioPills<UnreadStyleMode>
              options={[
                { id: 'bold-dot', label: 'Bold + dot' },
                { id: 'bold-only', label: 'Bold only' },
                { id: 'row-bg', label: 'Row highlight' },
                { id: 'none', label: 'None' },
              ]}
              value={ev.unreadStyle}
              onChange={(v) => patch({ unreadStyle: v })}
            />
          </ControlBlock>

          <ControlBlock label="Reading pane options" disabled={!paneOn}>
            <ControlBlock label="Email header">
              <RadioPills<EmailHeaderDisplay>
                options={[
                  { id: 'full', label: 'Full' },
                  { id: 'compact', label: 'Compact' },
                  { id: 'minimal', label: 'Minimal' },
                ]}
                value={ev.headerDisplay}
                onChange={(v) => patch({ headerDisplay: v })}
                disabled={!paneOn}
              />
            </ControlBlock>
            <div className="mt-3">
              <div className="control-block__label mb-1">Reading font size</div>
              <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={[13, 14, 16, 18].indexOf(ev.fontSize)}
                onChange={(e) => {
                  const sizes = [13, 14, 16, 18] as const;
                  patch({ fontSize: sizes[Number(e.target.value)] ?? 14 });
                }}
                className="w-full accent-accent"
                disabled={!paneOn}
              />
              <div className="flex justify-between text-[10px] text-fg-subtle mt-1">
                <span>Small</span>
                <span>Medium</span>
                <span>Large</span>
                <span>X-Large</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="control-block__label mb-1">Line spacing</div>
              <RadioPills<LineSpacingMode>
                options={[
                  { id: 'tight', label: 'Tight' },
                  { id: 'normal', label: 'Normal' },
                  { id: 'relaxed', label: 'Relaxed' },
                ]}
                value={ev.lineSpacing}
                onChange={(v) => patch({ lineSpacing: v })}
                disabled={!paneOn}
              />
            </div>
            <div className="mt-3">
              <div className="control-block__label mb-1">Remote images</div>
              <RadioPills<RemoteImagesMode>
                options={[
                  { id: 'ask', label: 'Ask' },
                  { id: 'always', label: 'Always' },
                  { id: 'never', label: 'Never' },
                ]}
                value={ev.showImages}
                onChange={(v) => patch({ showImages: v })}
                disabled={!paneOn}
              />
            </div>
            <div className="mt-3">
              <div className="control-block__label mb-1">Mark as read</div>
              <RadioPills<MarkAsReadMode>
                options={[
                  { id: 'on-open', label: 'On open' },
                  { id: '2s', label: 'After 2s' },
                  { id: '5s', label: 'After 5s' },
                  { id: 'manual', label: 'Manual' },
                ]}
                value={ev.markAsRead}
                onChange={(v) => patch({ markAsRead: v })}
                disabled={!paneOn}
              />
            </div>
          </ControlBlock>

          <ControlBlock label="Conversation grouping">
            <IosToggle
              label="Group by thread"
              checked={ev.groupByThread}
              onChange={(v) => patch({ groupByThread: v })}
            />
            <p className="text-[10px] text-fg-subtle">
              Collapse thread messages into one row with a count badge.
            </p>
          </ControlBlock>

          <ControlBlock label="List toolbar">
            <IosToggle
              label="Show sort bar"
              checked={ev.showSortBar}
              onChange={(v) => patch({ showSortBar: v })}
            />
            <IosToggle
              label="Show email count"
              checked={ev.showEmailCount}
              onChange={(v) => patch({ showEmailCount: v })}
            />
            <IosToggle
              label="Show category badge"
              checked={ev.showCategoryBadge}
              onChange={(v) => patch({ showCategoryBadge: v })}
            />
          </ControlBlock>
        </div>
        <LivePreviewPanel />
      </div>
    </div>
  );
}
