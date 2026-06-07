import { LiveSyncControl } from '@/components/LiveSync/LiveSyncControl';
import { SettingsCollapsibleSection } from './SettingsCollapsibleSection';

export function SettingsLiveSync() {
  return (
    <>
      <SettingsCollapsibleSection
        id="livesync-overview"
        title="Background watching"
        subtitle="How live sync monitors your linked mailboxes."
      >
        <p className="text-[12px] text-fg-muted leading-relaxed">
          Live sync polls <strong className="text-fg font-normal">Inbox</strong> and{' '}
          <strong className="text-fg font-normal">Junk/Spam</strong> on every linked account.
          New mail is analyzed automatically — rules apply silently, suspicious or rescued junk
          mail surfaces in the notification bell.
        </p>
      </SettingsCollapsibleSection>

      <SettingsCollapsibleSection
        id="livesync-controls"
        title="Live sync controls"
        subtitle="Enable watching, polling interval, auto-actions, and notifications."
      >
        <LiveSyncControl variant="card" />
      </SettingsCollapsibleSection>
    </>
  );
}
