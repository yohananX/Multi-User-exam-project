import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function metadataToUser(authUser: any): User {
  const meta = authUser.user_metadata || {};
  return {
    id: 0,
    auth_id: authUser.id,
    username: meta.username || authUser.email?.split('@')[0] || '',
    email: authUser.email || '',
    full_name: meta.full_name || authUser.email || '',
    role: meta.role || 'teacher',
    school_id: meta.school_id || null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveUser = async () => {
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        setUser(null);
        return;
      }

      const fromMeta = metadataToUser(authUser);

      // Attempt 1: look up by auth_id (UUID match — fastest path)
      const { data: profileByAuthId, error: authIdError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .maybeSingle();

      if (profileByAuthId) {
        setUser({
          id: profileByAuthId.id,
          auth_id: profileByAuthId.auth_id || authUser.id,
          username: profileByAuthId.username || fromMeta.username,
          email: profileByAuthId.email || fromMeta.email,
          full_name: profileByAuthId.full_name || fromMeta.full_name,
          role: profileByAuthId.role || fromMeta.role,
          school_id: profileByAuthId.school_id || fromMeta.school_id,
          created_at: profileByAuthId.created_at,
        });
        return;
      }

      if (authIdError) {
        console.warn('[AuthContext] auth_id lookup error:', authIdError.message);
      } else {
        console.warn('[AuthContext] No user row found for auth_id:', authUser.id);
      }

      // Attempt 2: look up by email (case-insensitive using ilike)
      const { data: profileByEmail, error: emailError } = await supabase
        .from('users')
        .select('*')
        .ilike('email', authUser.email || '')
        .maybeSingle();

      if (profileByEmail) {
        // Self-heal: if auth_id is missing or wrong, fix it now
        // This handles admin-created teachers whose auth_id was never set
        if (!profileByEmail.auth_id || profileByEmail.auth_id !== authUser.id) {
          console.warn(
            '[AuthContext] Fixing missing/wrong auth_id for user id:',
            profileByEmail.id
          );
          // Try to update auth_id. If RLS blocks it, we swallow/warn but proceed.
          try {
            await supabase
              .from('users')
              .update({ auth_id: authUser.id })
              .eq('id', profileByEmail.id);
          } catch (updateErr: any) {
            console.warn('[AuthContext] Could not auto-update auth_id:', updateErr?.message);
          }
        }

        setUser({
          id: profileByEmail.id,
          auth_id: authUser.id,
          username: profileByEmail.username || fromMeta.username,
          email: profileByEmail.email || fromMeta.email,
          full_name: profileByEmail.full_name || fromMeta.full_name,
          role: profileByEmail.role || fromMeta.role,
          school_id: profileByEmail.school_id || fromMeta.school_id,
          created_at: profileByEmail.created_at,
        });
        return;
      }

      if (emailError) {
        console.warn('[AuthContext] email lookup error:', emailError.message);
      } else {
        console.warn('[AuthContext] No user row found for email:', authUser.email);
      }

      // Attempt 3: last resort metadata fallback
      // id will be 0 — queries filtering by teacher_id will return nothing
      console.error(
        '[AuthContext] CRITICAL: No DB profile found.',
        'auth_id:', authUser.id,
        'email:', authUser.email,
        'user.id will be 0. Manually insert a row in the users table.'
      );
      setUser(fromMeta);

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // onAuthStateChange fires immediately with the current session on subscribe.
    // No separate getSession() call needed — that caused resolveUser to run twice.
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'TOKEN_REFRESHED') {
          // Ignore token refreshes to prevent visual reload spinner on tab switch
          return;
        }
        if (session?.user) {
          await resolveUser();
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );
    return () => listener?.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('Invalid login credentials'))
        throw new Error('Invalid email or password. Please try again.');
      if (msg.includes('Email not confirmed'))
        throw new Error('Please confirm your email before signing in.');
      throw new Error(msg || 'Failed to sign in.');
    }
    if (data.user) await resolveUser();
  };

  const signup = async (
    email: string,
    password: string,
    fullName: string
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          username: email.split('@')[0],
          role: 'teacher',
        },
      },
    });
    if (error) {
      const msg = error.message || '';
      if (msg.includes('already registered'))
        throw new Error('An account with this email already exists.');
      if (msg.includes('password'))
        throw new Error('Password must be at least 6 characters.');
      throw new Error(msg || 'Failed to create account.');
    }
    if (!data.user) throw new Error('Failed to create account.');
    await resolveUser();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
