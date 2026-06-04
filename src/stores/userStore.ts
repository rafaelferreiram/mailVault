import { create } from 'zustand';
import type { User } from '@shared/types';

interface UserState {
  user: User | null;
  /** True if any user has ever been registered. Drives "Sign In" vs "Create Account" default tab. */
  hasAnyUser: boolean;
  loading: boolean;
  busy: boolean;
  error: string | null;
  errorField: string | null;

  bootstrap: () => Promise<void>;
  register: (input: { username: string; email: string; password: string }) => Promise<boolean>;
  login: (input: { identifier: string; password: string }) => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (current: string, next: string) => Promise<boolean>;
  clearError: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  hasAnyUser: false,
  loading: true,
  busy: false,
  error: null,
  errorField: null,

  bootstrap: async () => {
    set({ loading: true });
    const [user, hasAnyUser] = await Promise.all([
      window.mailvault.userMe(),
      window.mailvault.userHasAny(),
    ]);
    set({ user, hasAnyUser, loading: false });
  },

  register: async (input) => {
    set({ busy: true, error: null, errorField: null });
    const result = await window.mailvault.userRegister(input);
    if (!result.ok) {
      set({
        busy: false,
        error: result.error.message,
        errorField: parseField(result.error.code),
      });
      return false;
    }
    set({ user: result.user, hasAnyUser: true, busy: false });
    return true;
  },

  login: async (input) => {
    set({ busy: true, error: null, errorField: null });
    const result = await window.mailvault.userLogin(input);
    if (!result.ok) {
      set({
        busy: false,
        error: result.error.message,
        errorField: parseField(result.error.code),
      });
      return false;
    }
    set({ user: result.user, busy: false });
    return true;
  },

  logout: async () => {
    await window.mailvault.userLogout();
    set({ user: null });
  },

  changePassword: async (current, next) => {
    set({ busy: true, error: null, errorField: null });
    const result = await window.mailvault.userChangePassword({
      currentPassword: current,
      newPassword: next,
    });
    if (!result.ok) {
      set({
        busy: false,
        error: result.error.message,
        errorField: parseField(result.error.code),
      });
      return false;
    }
    set({ busy: false });
    return true;
  },

  clearError: () => set({ error: null, errorField: null }),
}));

function parseField(code?: string): string | null {
  if (!code) return null;
  if (code.startsWith('validation:')) return code.slice('validation:'.length);
  return null;
}

if (typeof window !== 'undefined' && window.mailvault?.onUserChanged) {
  window.mailvault.onUserChanged(({ user }) => {
    useUserStore.setState({ user });
  });
}
