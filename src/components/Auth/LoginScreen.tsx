import { useState, useEffect, FormEvent } from 'react';
import clsx from 'clsx';
import { Lock, User as UserIcon, AtSign, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useUserStore } from '@/stores/userStore';
import { BrandLockupHorizontal } from '@/components/Brand';

type Tab = 'signin' | 'register';

export function LoginScreen() {
  const hasAnyUser = useUserStore((s) => s.hasAnyUser);
  const busy = useUserStore((s) => s.busy);
  const error = useUserStore((s) => s.error);
  const errorField = useUserStore((s) => s.errorField);
  const login = useUserStore((s) => s.login);
  const register = useUserStore((s) => s.register);
  const clearError = useUserStore((s) => s.clearError);

  const [tab, setTab] = useState<Tab>(hasAnyUser ? 'signin' : 'register');
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    setTab(hasAnyUser ? 'signin' : 'register');
  }, [hasAnyUser]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    clearError();
    if (tab === 'signin') {
      await login({ identifier: identifier.trim(), password });
    } else {
      await register({ username: username.trim(), email: email.trim(), password });
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center drag-region bg-bg">
      <div className="w-full max-w-md panel p-8 no-drag animate-fade-in">
        <div className="flex items-center mb-6 text-fg">
          <BrandLockupHorizontal className="h-6 w-auto" />
          <span className="ml-auto px-2 h-[18px] inline-flex items-center bg-accent/10 border border-accent/30 text-accent font-mono text-[10px] uppercase tracking-[0.16em]">
            Local
          </span>
        </div>

        <h1 className="font-mono text-[20px] font-semibold tracking-[0.04em] mb-1">
          {tab === 'signin' ? 'Sign in' : 'Create your account'}
        </h1>
        <p className="text-fg-muted text-[12px] mb-5">
          {tab === 'signin'
            ? 'Sign in to MailVault before linking email accounts.'
            : 'A local-only account on this Mac. No cloud, no telemetry.'}
        </p>

        <div role="tablist" className="flex border border-border mb-5">
          <button
            role="tab"
            type="button"
            onClick={() => {
              setTab('signin');
              clearError();
            }}
            className={clsx(
              'flex-1 h-9 text-[11px] font-mono uppercase tracking-wider',
              tab === 'signin'
                ? 'bg-accent/10 text-accent border-r border-border'
                : 'text-fg-muted hover:text-fg border-r border-border'
            )}
          >
            <Lock className="w-3 h-3 inline mr-1.5 -mt-0.5" />
            Sign In
          </button>
          <button
            role="tab"
            type="button"
            onClick={() => {
              setTab('register');
              clearError();
            }}
            className={clsx(
              'flex-1 h-9 text-[11px] font-mono uppercase tracking-wider',
              tab === 'register'
                ? 'bg-accent/10 text-accent'
                : 'text-fg-muted hover:text-fg'
            )}
          >
            <UserIcon className="w-3 h-3 inline mr-1.5 -mt-0.5" />
            Create Account
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {tab === 'signin' ? (
            <Field
              icon={<UserIcon className="w-3.5 h-3.5" />}
              label="Username or Email"
              autoFocus
              value={identifier}
              onChange={setIdentifier}
              error={errorField === 'username' || errorField === 'email'}
            />
          ) : (
            <>
              <Field
                icon={<UserIcon className="w-3.5 h-3.5" />}
                label="Username"
                placeholder="3–32 chars: letters, numbers, dot, dash, underscore"
                autoFocus
                value={username}
                onChange={setUsername}
                error={errorField === 'username'}
              />
              <Field
                icon={<AtSign className="w-3.5 h-3.5" />}
                label="Email"
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={setEmail}
                error={errorField === 'email'}
              />
            </>
          )}
          <Field
            icon={<KeyRound className="w-3.5 h-3.5" />}
            label="Password"
            placeholder={tab === 'register' ? 'At least 8 characters' : ''}
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            error={errorField === 'password'}
            trailing={
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="text-fg-subtle hover:text-fg"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            }
          />

          {error && (
            <div className="border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] text-danger">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className={clsx(
              'w-full h-10 font-mono uppercase tracking-wider text-[11px]',
              busy
                ? 'bg-accent/30 text-fg-muted cursor-wait'
                : 'bg-accent text-bg hover:bg-accent-dim'
            )}
          >
            {busy
              ? tab === 'signin'
                ? 'Signing in…'
                : 'Creating account…'
              : tab === 'signin'
                ? 'Sign In'
                : 'Create Account & Sign In'}
          </button>
        </form>

        <p className="text-[10px] text-fg-subtle font-mono mt-5 uppercase tracking-widest text-center">
          Stored locally · Passwords hashed with bcrypt · No cloud
        </p>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoFocus,
  error,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  error?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label-mono mb-1 block">{label}</span>
      <div
        className={clsx(
          'flex items-center gap-2 h-10 px-3 border bg-bg-elevated transition-colors',
          error
            ? 'border-danger/60 focus-within:border-danger'
            : 'border-border focus-within:border-accent/60'
        )}
      >
        <span className="text-fg-subtle">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none text-[13px] placeholder:text-fg-subtle"
        />
        {trailing}
      </div>
    </label>
  );
}
