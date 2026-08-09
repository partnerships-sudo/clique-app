import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/query-client';
import { registerForPushNotificationsAsync, syncPushToken } from '@/lib/push-notifications';
import {
  getSavedAccounts,
  upsertSavedAccount,
  removeSavedAccount,
  refreshSavedAccountTokens,
  type SavedAccount,
} from '@/lib/saved-accounts';

type SignUpParams = {
  email: string;
  password: string;
  fullName: string;
  username: string;
};

type SessionContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  savedAccounts: SavedAccount[];
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>;
  switchAccount: (userId: string) => Promise<void>;
  /** `forgetDevice` also removes this device's push token from the outgoing
   * account, so it stops receiving notifications here — off by default so
   * switching to another account on the same device doesn't need to. */
  signOut: (options?: { forgetDevice?: boolean }) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function upsertProfile(user: User, fullName?: string, username?: string) {
  const name = fullName ?? user.user_metadata?.full_name ?? user.email ?? 'You';
  const handle = username ?? user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'you';
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    full_name: name,
    username: handle,
  });
  if (error) console.error('profile upsert error:', error.message);
}

/** Fetch the profile and save the account to the local saved-accounts list. */
async function saveAccountFromSession(session: Session) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name, avatar_url')
    .eq('id', session.user.id)
    .single();

  await upsertSavedAccount({
    userId: session.user.id,
    email: session.user.email ?? '',
    fullName: profile?.full_name ?? session.user.user_metadata?.full_name ?? '',
    username: profile?.username ?? session.user.user_metadata?.username ?? '',
    avatarUrl: profile?.avatar_url ?? null,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  });
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);

  // Load saved accounts on mount
  useEffect(() => {
    getSavedAccounts().then(setSavedAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setIsLoading(false), 3000);
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
      clearTimeout(timeout);
      // Save the restored session so it appears in the account switcher
      if (data.session) {
        saveAccountFromSession(data.session)
          .then(() => getSavedAccounts().then(setSavedAccounts))
          .catch(() => {});
      }
    }).catch(() => {
      setIsLoading(false);
      clearTimeout(timeout);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(false);

      if (newSession) {
        // Keep saved tokens fresh on every auth state change
        refreshSavedAccountTokens(
          newSession.user.id,
          newSession.access_token,
          newSession.refresh_token,
        ).then(() => getSavedAccounts().then(setSavedAccounts)).catch(() => {});
      } else {
        // Session ended — redirect to auth
        router.replace('/(auth)');
        getSavedAccounts().then(setSavedAccounts).catch(() => {});
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      syncPushToken(session.user.id).catch(() => {});
    }
  }, [session?.user?.id]);

  const value: SessionContextValue = {
    session,
    user: session?.user ?? null,
    isLoading,
    savedAccounts,

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      setSession(data.session);
      setIsLoading(false);
      // Save account for the switcher
      await saveAccountFromSession(data.session);
      getSavedAccounts().then(setSavedAccounts).catch(() => {});
      return { error: null };
    },

    async signUp({ email, password, fullName, username }) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, username } },
      });
      if (error) return { error: error.message };
      if (data.user) await upsertProfile(data.user, fullName, username);
      setSession(data.session);
      setIsLoading(false);
      if (data.session) {
        await saveAccountFromSession(data.session);
        getSavedAccounts().then(setSavedAccounts).catch(() => {});
      }
      return { error: null };
    },

    async switchAccount(userId) {
      const accounts = await getSavedAccounts();
      const account = accounts.find((a) => a.userId === userId);
      if (!account) return;
      const { error } = await supabase.auth.setSession({
        access_token: account.accessToken,
        refresh_token: account.refreshToken,
      });
      if (error) throw error;
      queryClient.clear();
      router.replace('/(tabs)');
    },

    async signOut({ forgetDevice = false } = {}) {
      if (forgetDevice && session?.user?.id) {
        // Remove from saved accounts so it won't appear in the switcher
        await removeSavedAccount(session.user.id);
        getSavedAccounts().then(setSavedAccounts).catch(() => {});
        try {
          const token = await registerForPushNotificationsAsync();
          if (token) {
            await supabase.from('push_tokens').delete().eq('user_id', session.user.id).eq('token', token);
          }
        } catch {
          // Best-effort — a push-cleanup hiccup shouldn't block signing out.
        }
      }
      await supabase.auth.signOut();
      queryClient.clear();
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSessionContext must be used within a SessionProvider');
  return ctx;
}
