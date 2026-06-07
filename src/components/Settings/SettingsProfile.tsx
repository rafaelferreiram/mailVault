import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Camera, LogOut, Save, Smile } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { useUIStore } from '@/stores/uiStore';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/Button';
import { SettingsCollapsibleSection } from './SettingsCollapsibleSection';

const EMOJI_OPTIONS = [
  '🦊', '🐱', '🐶', '🦁', '🐼', '🐨', '🐸', '🦄',
  '🌙', '⭐', '🔥', '💎', '🎯', '🚀', '🎨', '📬',
  '😎', '🤓', '🧠', '💼', '🏠', '🌿', '☕', '🎵',
];

export function SettingsProfile() {
  const user = useUserStore((s) => s.user);
  const busy = useUserStore((s) => s.busy);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const changePassword = useUserStore((s) => s.changePassword);
  const logout = useUserStore((s) => s.logout);
  const clearError = useUserStore((s) => s.clearError);
  const showToast = useUIStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [avatarEmoji, setAvatarEmoji] = useState<string | null>(null);
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const [avatarDirty, setAvatarDirty] = useState(false);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName || user.username);
    setRecoveryEmail(user.email);
    setAvatarEmoji(user.avatarEmoji);
    setAvatarImage(user.avatarImage);
    setAvatarDirty(false);
  }, [user]);

  if (!user) return null;

  const onSaveProfile = async () => {
    clearError();
    const trimmedEmail = recoveryEmail.trim().toLowerCase();
    const ok = await updateProfile({
      displayName: displayName.trim(),
      email: trimmedEmail !== user.email ? trimmedEmail : undefined,
      ...(avatarDirty
        ? { avatarEmoji: avatarImage ? null : avatarEmoji, avatarImage }
        : {}),
    });
    if (ok) {
      showToast('ok', 'Profile updated');
      setAvatarDirty(false);
    } else {
      showToast('err', useUserStore.getState().error ?? 'Failed to update profile');
    }
  };

  const onPickEmoji = (emoji: string) => {
    setAvatarEmoji(emoji);
    setAvatarImage(null);
    setAvatarDirty(true);
  };

  const onClearAvatar = () => {
    setAvatarEmoji(null);
    setAvatarImage(null);
    setAvatarDirty(true);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('err', 'Choose a JPEG or PNG image');
      return;
    }
    if (file.size > 256 * 1024) {
      showToast('err', 'Image must be under 256 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result ?? '');
      setAvatarImage(data);
      setAvatarEmoji(null);
      setAvatarDirty(true);
    };
    reader.readAsDataURL(file);
  };

  const onChangePassword = async () => {
    clearError();
    if (newPw.length < 8) {
      showToast('err', 'New password must be at least 8 characters');
      return;
    }
    if (newPw !== confirmPw) {
      showToast('err', 'New passwords do not match');
      return;
    }
    const ok = await changePassword(currentPw, newPw);
    if (ok) {
      showToast('ok', 'MailVault password updated');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } else {
      showToast('err', useUserStore.getState().error ?? 'Failed to change password');
    }
  };

  const previewUser = {
    ...user,
    displayName: displayName.trim() || user.username,
    avatarEmoji: avatarImage ? null : avatarEmoji,
    avatarImage,
  };

  return (
    <>
      <SettingsCollapsibleSection
        id="profile-identity"
        title="Profile"
        subtitle="How you appear inside MailVault — not your Gmail or Outlook identity."
      >
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex flex-col items-center gap-3 shrink-0">
            <UserAvatar user={previewUser} size={72} />
            <div className="flex flex-wrap gap-2 justify-center">
              <Button
                variant="secondary"
                size="sm"
                iconLeft={<Camera className="w-3 h-3" />}
                onClick={() => fileRef.current?.click()}
              >
                Photo
              </Button>
              <Button variant="ghost" size="sm" onClick={onClearAvatar}>
                Reset
              </Button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <div>
              <label htmlFor="profile-display-name" className="label-mono mb-1.5 block">
                Your name
              </label>
              <input
                id="profile-display-name"
                className="input max-w-md"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={48}
                placeholder={user.username}
              />
              <p className="text-[11px] text-fg-muted mt-1.5">
                Shown in the app header and settings — not sent to Gmail or Outlook.
              </p>
            </div>

            <div>
              <div className="label-mono mb-2 flex items-center gap-1.5">
                <Smile className="w-3 h-3" />
                Emoji avatar
              </div>
              <div className="flex flex-wrap gap-1.5 max-w-md">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onPickEmoji(emoji)}
                    className={clsx(
                      'w-9 h-9 text-lg border transition-colors',
                      avatarEmoji === emoji && !avatarImage
                        ? 'border-accent bg-accent/10'
                        : 'border-border-subtle hover:border-border-strong hover:bg-bg-hover'
                    )}
                    aria-label={`Use ${emoji} as avatar`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SettingsCollapsibleSection>

      <SettingsCollapsibleSection
        id="profile-account"
        title="MailVault account"
        subtitle="Your local sign-in — separate from Gmail or Outlook passwords."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mb-4">
          <div className="panel-inset p-3">
            <div className="label-mono mb-1">Username</div>
            <div className="text-[13px] font-mono text-fg">{user.username}</div>
            <p className="text-[10px] text-fg-muted mt-1.5">Used to sign in — cannot be changed.</p>
          </div>
          <div>
            <label htmlFor="profile-recovery-email" className="label-mono mb-1.5 block">
              Recovery email
            </label>
            <input
              id="profile-recovery-email"
              type="email"
              className="input max-w-md"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              maxLength={254}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <p className="text-[10px] text-fg-muted mt-1.5">
              For account recovery and sign-in if you forget your username.
            </p>
          </div>
        </div>
        <p className="text-[11px] text-fg-muted max-w-xl mb-4">
          Email provider passwords are never stored — only OAuth tokens in your OS keychain.
        </p>
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Save className="w-3 h-3" />}
            onClick={() => void onSaveProfile()}
            disabled={busy}
          >
            Save profile
          </Button>
        </div>
      </SettingsCollapsibleSection>

      <SettingsCollapsibleSection
        id="profile-password"
        title="Change MailVault password"
        subtitle="Updates your local MailVault login only — not your Gmail or Outlook password."
      >
        <div className="max-w-md space-y-3">
          <div>
            <label htmlFor="profile-current-password" className="label-mono mb-1.5 block">
              Current password
            </label>
            <input
              id="profile-current-password"
              type="password"
              className="input"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="profile-new-password" className="label-mono mb-1.5 block">
              New password
            </label>
            <input
              id="profile-new-password"
              type="password"
              className="input"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="profile-confirm-password" className="label-mono mb-1.5 block">
              Confirm new password
            </label>
            <input
              id="profile-confirm-password"
              type="password"
              className="input"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void onChangePassword()}
              disabled={busy || !currentPw || !newPw}
            >
              Update password
            </Button>
          </div>
        </div>
      </SettingsCollapsibleSection>

      <SettingsCollapsibleSection
        id="profile-session"
        title="Session"
        subtitle="Sign out of MailVault on this device."
      >
        <Button
          variant="secondary"
          iconLeft={<LogOut className="w-3.5 h-3.5" />}
          onClick={() => void logout()}
        >
          Sign out of MailVault
        </Button>
      </SettingsCollapsibleSection>
    </>
  );
}
