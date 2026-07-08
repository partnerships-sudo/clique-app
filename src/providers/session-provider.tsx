import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/query-client';
import { syncPushToken } from '@/lib/push-notifications';

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
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
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

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
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
    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };
      setSession(data.session);
      setIsLoading(false);
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
      return { error: null };
    },
    async signOut() {
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
