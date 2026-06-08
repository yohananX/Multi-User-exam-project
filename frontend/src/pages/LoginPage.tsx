import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { School, LogIn } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--main-bg)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: 'var(--accent-muted)' }}>
            <School className="w-7 h-7" style={{ color: 'var(--accent)' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>ExamVault</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>School Exam Management</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="input-dark w-full" placeholder="Enter username" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="input-dark w-full" placeholder="Enter password" required />
          </div>

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
            <LogIn className="w-4 h-4" /> Sign In
          </button>

          <div className="pt-3 border-t border-border">
            <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
              Demo: <strong style={{ color: 'var(--text-secondary)' }}>admin</strong> / <strong style={{ color: 'var(--text-secondary)' }}>teacher1</strong> / <strong style={{ color: 'var(--text-secondary)' }}>teacher2</strong><br />
              Pass: <strong style={{ color: 'var(--text-secondary)' }}>admin123</strong> / <strong style={{ color: 'var(--text-secondary)' }}>teacher123</strong>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
