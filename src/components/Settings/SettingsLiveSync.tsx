import { LiveSyncControl } from '@/components/LiveSync/LiveSyncControl';

export function SettingsLiveSync() {
  return (
    <>
      <div className="panel p-4 mb-4">
        <div className="label-mono mb-1">Background watching</div>
        <p className="text-[12px] text-fg-muted leading-relaxed">
          Live sync polls <strong className="text-fg font-normal">Inbox</strong> and{' '}
          <strong className="text-fg font-normal">Junk/Spam</strong> on every linked account.
          New mail is analyzed automatically — rules apply silently, suspicious or rescued junk
          mail surfaces in the notification bell.
        </p>
      </div>
      <LiveSyncControl variant="card" />
    </>
  );
}
