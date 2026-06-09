import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { School, UserPlus } from 'lucide-react';
import { authApi } from '../api/endpoints';

export default function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '', school_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register({ ...form, school_name: form.school_name || undefined });
      navigate('/login');
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--main-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'var(--accent-muted)' }}>
            <School className="w-7 h-7" style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Create Account</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Register your school</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Full Name</label>
            <input type="text" value={form.full_name} onChange={set('full_name')}
              className="input-dark w-full" placeholder="Your full name" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Username</label>
            <input type="text" value={form.username} onChange={set('username')}
              className="input-dark w-full" placeholder="Choose a username" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input type="email" value={form.email} onChange={set('email')}
              className="input-dark w-full" placeholder="your@email.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <input type="password" value={form.password} onChange={set('password')}
              className="input-dark w-full" placeholder="Create a password" required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>School Name</label>
            <input type="text" value={form.school_name} onChange={set('school_name')}
              className="input-dark w-full" placeholder="Your school name (becomes admin)" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
            <UserPlus className="w-4 h-4" /> {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-xs text-center pt-2" style={{ color: 'var(--text-tertiary)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-medium" style={{ color: 'var(--accent)' }}>Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
