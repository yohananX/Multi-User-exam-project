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

async function fetchProfileByAuthId(authId: string): Promise<User | null> {
  try {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authId)
      .single();
    if (!data) return null;
    return {
      id: data.id, auth_id: data.auth_id || '', username: data.username || '',
      email: data.email, full_name: data.full_name, role: data.role,
      school_id: data.school_id, created_at: data.created_at,
    } as User;
  } catch {
    return null;
  }
}

async function fetchProfileByEmail(email: string): Promise<User | null> {
  try {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    if (!data) return null;
    return {
      id: data.id, auth_id: data.auth_id || '', username: data.username || '',
      email: data.email, full_name: data.full_name, role: data.role,
      school_id: data.school_id, created_at: data.created_at,
    } as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveUser = async (authUserId: string, userEmail?: string) => {
    let profile = await fetchProfileByAuthId(authUserId);
    if (!profile && userEmail) {
      profile = await fetchProfileByEmail(userEmail);
    }
    setUser(profile);
    return profile;
  };

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await resolveUser(session.user.id, session.user.email);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        resolveUser(session.user.id, session.user.email);
      }
      setLoading(false);
    });

    return () => listener?.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Map Supabase error messages to user-friendly ones
      const msg = error.message || '';
      if (msg.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password. Please try again.');
      }
      if (msg.includes('Email not confirmed')) {
        throw new Error('Please confirm your email before signing in. Check your inbox.');
      }
      throw new Error(msg || 'Failed to sign in. Please try again.');
    }
    // Resolve profile immediately after successful login
    if (data.user) {
      await resolveUser(data.user.id, data.user.email);
    }
  };

  const signup = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
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
      if (msg.includes('already registered')) {
        throw new Error('An account with this email already exists.');
      }
      if (msg.includes('password')) {
        throw new Error('Password must be at least 6 characters.');
      }
      throw new Error(msg || 'Failed to create account.');
    }
    if (!data.user) throw new Error('Failed to create account. Please try again.');

    // Manually create user profile (in case the DB trigger isn't set up yet)
    try {
      const username = email.split('@')[0];
      await supabase.from('users').insert({
        auth_id: data.user.id,
        username,
        email,
        full_name: fullName,
        role: 'teacher',
      });
    } catch (insertErr) {
      // Profile may already exist from trigger — that's fine
      console.warn('Profile insert warning (may already exist):', insertErr);
    }
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
