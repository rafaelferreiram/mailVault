import { create } from 'zustand';
import type { EmailMessage, EmailPreview } from '@shared/types';
import { useUIStore } from './uiStore';

interface MailboxState {
  folder: { id: string; name: string } | null;
  messages: EmailMessage[];
  source: 'cache' | 'live' | null;
  loading: boolean;
  error: string | null;
  selectedMessageId: string | null;
  preview: EmailPreview | null;
  previewLoading: boolean;

  openFolder: (folderId: string, folderName: string) => void;
  loadFolder: (accountId: string) => Promise<void>;
  selectMessage: (accountId: string, messageId: string) => Promise<void>;
  clearPreview: () => void;
}

export const useMailboxStore = create<MailboxState>((set, get) => ({
  folder: null,
  messages: [],
  source: null,
  loading: false,
  error: null,
  selectedMessageId: null,
  preview: null,
  previewLoading: false,

  openFolder: (folderId, folderName) => {
    useUIStore.getState().setRoute('mailbox');
    set({
      folder: { id: folderId, name: folderName },
      messages: [],
      source: null,
      selectedMessageId: null,
      preview: null,
      error: null,
    });
  },

  loadFolder: async (accountId) => {
    const folder = get().folder;
    if (!folder) return;
    set({ loading: true, error: null });
    try {
      const result = await window.mailvault.listEmailsByFolder(accountId, {
        folderId: folder.id,
        limit: 200,
      });
      set({
        messages: result.messages,
        source: result.source,
        loading: false,
        selectedMessageId: result.messages[0]?.id ?? null,
      });
      if (result.messages[0]) {
        await get().selectMessage(accountId, result.messages[0].id);
      }
    } catch (e) {
      set({ loading: false, error: (e as Error).message, messages: [] });
    }
  },

  selectMessage: async (accountId, messageId) => {
    set({ selectedMessageId: messageId, previewLoading: true, preview: null });
    try {
      const preview = await window.mailvault.getEmailPreview(accountId, messageId);
      set({ preview, previewLoading: false });
    } catch {
      const msg = get().messages.find((m) => m.id === messageId);
      set({
        previewLoading: false,
        preview: msg
          ? {
              id: msg.id,
              subject: msg.subject,
              fromEmail: msg.fromEmail,
              fromName: msg.fromName,
              receivedAt: msg.receivedAt,
              isUnread: msg.isUnread,
              snippet: msg.snippet,
              bodyText: msg.snippet || 'Preview unavailable.',
            }
          : null,
      });
    }
  },

  clearPreview: () => set({ preview: null, selectedMessageId: null }),
}));
