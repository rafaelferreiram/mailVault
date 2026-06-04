import type { EmailHeaderDisplay, LineSpacingMode, RemoteImagesMode } from '@shared/types';
import type { MockEmail } from './mockEmails';

export interface PreviewPaneProps {
  email: MockEmail | null;
  fontSize: number;
  lineSpacing: LineSpacingMode;
  headerStyle: EmailHeaderDisplay;
  showImages: RemoteImagesMode;
}

const BODY =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.';

export function PreviewPane({
  email,
  fontSize,
  lineSpacing,
  headerStyle,
  showImages,
}: PreviewPaneProps) {
  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center text-[12px] text-fg-subtle p-6">
        Select an email to preview
      </div>
    );
  }

  const lh = lineSpacing === 'tight' ? 1.4 : lineSpacing === 'relaxed' ? 1.9 : 1.6;

  return (
    <div className="flex-1 overflow-auto p-4 min-h-0 relative">
      {headerStyle === 'full' && (
        <div className="text-[11px] text-fg-muted space-y-1 mb-3 border-b border-border-subtle pb-3">
          <div>
            <span className="text-fg-subtle">From: </span>
            {email.sender}
          </div>
          <div>
            <span className="text-fg-subtle">To: </span>you@mailvault.app
          </div>
          <div>
            <span className="text-fg-subtle">Date: </span>
            {email.date}
          </div>
        </div>
      )}
      {headerStyle === 'compact' && (
        <div className="text-[11px] text-fg-muted mb-2 flex gap-3">
          <span>{email.sender}</span>
          <span>{email.date}</span>
        </div>
      )}
      {headerStyle === 'minimal' && (
        <div className="text-[11px] text-fg-muted mb-2">
          {email.sender} · {email.date}
        </div>
      )}
      <h2 className="text-[15px] font-semibold text-fg mb-3">{email.subject}</h2>
      {showImages === 'never' && (
        <p className="text-[10px] text-fg-subtle mb-2 italic">Remote images blocked</p>
      )}
      {showImages === 'always' && (
        <div className="h-16 bg-bg-elevated border border-border-subtle rounded mb-3 text-[10px] flex items-center justify-center text-fg-subtle">
          Image placeholder
        </div>
      )}
      <div
        className="text-fg-muted whitespace-pre-wrap"
        style={{ fontSize, lineHeight: lh }}
      >
        {BODY}
      </div>
      <span
        className="absolute bottom-3 right-3 text-[10px] px-2 py-0.5 rounded-full border"
        style={{ borderColor: email.categoryColor, color: email.categoryColor }}
      >
        {email.category}
      </span>
    </div>
  );
}
