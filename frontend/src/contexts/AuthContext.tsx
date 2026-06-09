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
    id: 0, // Placeholder — real id from users table
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
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const fromMeta = metadataToUser(authUser);
      // Try to enrich with DB profile, but fall back to metadata
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', authUser.id)
          .single();
        if (profile) {
          setUser({
            id: profile.id, auth_id: profile.auth_id || '',
            username: profile.username || fromMeta.username,
            email: profile.email || fromMeta.email,
            full_name: profile.full_name || fromMeta.full_name,
            role: profile.role || fromMeta.role,
            school_id: profile.school_id || fromMeta.school_id,
            created_at: profile.created_at,
          });
          return;
        }
      } catch {
        // DB query failed — use metadata as fallback
      }
      // Try email-based lookup
      try {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('email', authUser.email)
          .single();
        if (profile) {
          setUser({
            id: profile.id, auth_id: profile.auth_id || fromMeta.auth_id,
            username: profile.username || fromMeta.username,
            email: profile.email || fromMeta.email,
            full_name: profile.full_name || fromMeta.full_name,
            role: profile.role || fromMeta.role,
            school_id: profile.school_id || fromMeta.school_id,
            created_at: profile.created_at,
          });
          return;
        }
      } catch {}
      // Ultimate fallback: use auth metadata
      setUser(fromMeta);
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await resolveUser();
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        resolveUser();
      }
      setLoading(false);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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

  const signup = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName, username: email.split('@')[0], role: 'teacher' },
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
