import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, hasSupabaseAuthEnv } from '../lib/supabase';

const MISSING_ENV_MESSAGE =
  'Missing Supabase auth environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseAuthEnv()) {
      setLoading(false);
      return;
    }

    const client = getSupabaseClient();
    let isMounted = true;

    const initializeSession = async () => {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) {
          throw mapAuthError(error, 'Failed to restore session');
        }

        if (!isMounted) return;
        setSession(data.session ?? null);
        setUser(data.session?.user ?? null);
      } catch (error) {
        if (!isMounted) return;
        setSession(null);
        setUser(null);
        console.error(error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeSession();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event: unknown, nextSession: Session | null) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const ensureClient = () => {
    if (!hasSupabaseAuthEnv()) {
      throw new Error(MISSING_ENV_MESSAGE);
    }

    return getSupabaseClient();
  };

  const signUp = async (email: string, password: string) => {
    const client = ensureClient();
    const { error } = await client.auth.signUp({ email, password });
    if (error) {
      throw mapAuthError(error, 'Unable to create account');
    }
  };

  const signIn = async (email: string, password: string) => {
    const client = ensureClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      throw mapAuthError(error, 'Unable to sign in');
    }
  };

  const signOut = async () => {
    const client = ensureClient();
    const { error } = await client.auth.signOut();
    if (error) {
      throw mapAuthError(error, 'Unable to sign out');
    }
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function mapAuthError(error: unknown, fallback: string): Error {
  const raw =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
  const message = raw.toLowerCase();

  if (!raw) {
    return new Error(fallback);
  }

  if (message.includes('invalid login credentials')) {
    return new Error('Invalid email or password. Please try again.');
  }

  if (message.includes('email not confirmed')) {
    return new Error('Please verify your email address before signing in.');
  }

  if (message.includes('already registered') || message.includes('user already registered')) {
    return new Error('An account with this email already exists. Please sign in instead.');
  }

  if (message.includes('password should be at least')) {
    return new Error('Password must be at least 6 characters long.');
  }

  if (message.includes('failed to fetch') || message.includes('network')) {
    return new Error('Network issue detected. Check your connection and try again.');
  }

  return new Error(raw || fallback);
}
