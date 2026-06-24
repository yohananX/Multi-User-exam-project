import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { School, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [forgotMode, setForgotMode] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    if (forgotMode) {
      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (resetError) throw resetError
        setSuccessMsg('Reset link sent! Please check your email inbox.')
      } catch (err: any) {
        setError(err?.message || 'Failed to send reset link.')
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden bg-background selection:bg-accent/25">
      {/* ── Animated Background Orbs ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        {/* Dark overlay gradient for depth perception */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/90" />
        {/* Subtle accent top glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.05),transparent_60%)]" />
        {/* Fine noise-like texture overlay */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")' }} />
      </div>

      {/* ── Main Content ── */}
      <div className="relative w-full max-w-sm">

        {/* ── Logo Area ── */}
        <div
          className="flex flex-col items-center mb-10 opacity-0 animate-fade-in"
          style={{ animationDelay: '100ms' }}
        >
          {/* Icon with glow ring */}
          <div className="relative mb-5">
            {/* Expanding glow ring behind icon */}
            <div
              className="absolute -inset-4 rounded-full bg-accent/20 blur-xl animate-pulse-ring"
              aria-hidden="true"
            />
            {/* Gradient circle container */}
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-violet-500 dark:to-violet-400 flex items-center justify-center shadow-lg shadow-accent/30">
              <School className="w-7 h-7 text-accent-foreground animate-breathe" />
            </div>
          </div>

          {/* Gradient title */}
          <h1 className="text-2xl font-bold tracking-tight text-gradient-accent">
            Scribe
          </h1>
          <p className="text-sm text-text-secondary mt-1.5 tracking-wide">
            School Examination Management
          </p>
        </div>

        {/* ── Glass Card ── */}
        {/* Key changes on forgotMode toggle to replay entrance animation (crossfade) */}
        <Card
          key={forgotMode ? 'forgot' : 'login'}
          className={cn(
            'bg-surface/70 backdrop-blur-2xl rounded-3xl shadow-xl border-border/50',
            'opacity-0 animate-scale-in',
          )}
          style={{ animationDelay: '300ms' }}
        >
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold tracking-tight">
              {forgotMode ? 'Reset password' : 'Welcome back'}
            </CardTitle>
            <CardDescription className="text-text-tertiary text-sm">
              {forgotMode
                ? 'Enter your email address to receive a recovery link'
                : 'Sign in to your account'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* ── Error Message ── */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-3 px-4 py-3 rounded-xl border-l-4 border-destructive bg-destructive/5 text-sm text-destructive opacity-0 animate-slide-down"
                  style={{ animationDuration: '300ms' }}
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* ── Success Message ── */}
              {successMsg && (
                <div
                  role="status"
                  className="flex items-start gap-3 px-4 py-3 rounded-xl border-l-4 border-status-completed bg-status-completed-bg/50 text-sm text-status-completed opacity-0 animate-slide-down"
                  style={{ animationDuration: '300ms' }}
                >
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* ── Email Field ── */}
              <div
                className="space-y-2 opacity-0 animate-slide-up"
                style={{ animationDelay: '380ms' }}
              >
                <Label htmlFor="email" className="text-sm font-medium text-text-primary">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@school.com"
                  required
                  autoFocus
                  className={cn(
                    'h-11 rounded-xl border-border/60 bg-surface/50',
                    'px-4 text-sm text-text-primary placeholder:text-text-tertiary',
                    'transition-all duration-200',
                    'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:ring-offset-0',
                  )}
                />
              </div>

              {/* ── Password Field ── */}
              {!forgotMode && (
                <div
                  className="space-y-2 opacity-0 animate-slide-up"
                  style={{ animationDelay: '460ms' }}
                >
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-text-primary">
                      Password
                    </Label>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setError(''); setSuccessMsg('') }}
                      className="text-xs text-text-tertiary hover:text-accent transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      className={cn(
                        'h-11 rounded-xl border-border/60 bg-surface/50',
                        'px-4 pr-11 text-sm text-text-primary placeholder:text-text-tertiary',
                        'transition-all duration-200',
                        'focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:ring-offset-0',
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Submit Button ── */}
              <div
                className="opacity-0 animate-slide-up"
                style={{ animationDelay: '540ms' }}
              >
                <Button
                  type="submit"
                  variant="default"
                  disabled={loading}
                  aria-busy={loading}
                  className={cn(
                    'w-full h-12 rounded-xl',
                    'bg-gradient-to-r from-accent via-accent to-accent-hover',
                    'text-accent-foreground font-medium text-base',
                    'shadow-lg shadow-accent/25',
                    'hover:shadow-xl hover:shadow-accent/30 hover:brightness-110 hover:scale-[1.01]',
                    'active:scale-[0.98]',
                    'transition-all duration-300',
                    'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-lg disabled:hover:brightness-100',
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {forgotMode ? 'Sending link...' : 'Signing in...'}
                    </>
                  ) : (
                    forgotMode ? 'Send Reset Link' : 'Sign in'
                  )}
                </Button>
              </div>

              {/* ── Back to Login Link ── */}
              {forgotMode && (
                <div
                  className="opacity-0 animate-fade-in"
                  style={{ animationDelay: '100ms' }}
                >
                  <button
                    type="button"
                    onClick={() => { setForgotMode(false); setError(''); setSuccessMsg('') }}
                    className="w-full flex items-center justify-center gap-1.5 text-xs text-text-tertiary hover:text-accent transition-colors mt-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Back to login
                  </button>
                </div>
              )}

            </form>
          </CardContent>
        </Card>

        {/* ── Footer ── */}
        <p
          className="text-center text-xs text-text-tertiary mt-6 opacity-0 animate-fade-in"
          style={{ animationDelay: '600ms' }}
        >
          Don't have an account?{' '}
          <Link
            to="/onboarding"
            className="text-accent hover:text-accent-hover font-medium underline-offset-4 hover:underline transition-all"
          >
            Create account
          </Link>
        </p>

      </div>

      {/* ── Custom Keyframes & Orb Styles ── */}
      <style>{`
        @keyframes orb-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(60px, -80px) scale(1.1); }
          50% { transform: translate(-40px, -30px) scale(0.9); }
          75% { transform: translate(80px, 50px) scale(1.05); }
        }
        @keyframes orb-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-70px, 60px) scale(1.15); }
          50% { transform: translate(50px, 80px) scale(0.85); }
          75% { transform: translate(-30px, -60px) scale(1.1); }
        }
        @keyframes orb-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, 40px) scale(1.05); }
          66% { transform: translate(-40px, -20px) scale(0.95); }
        }
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.6;
          will-change: transform;
        }
        .orb-1 {
          width: 500px;
          height: 500px;
          top: -200px;
          right: -150px;
          background: radial-gradient(circle at center, hsl(260 100% 70% / 0.2), transparent 70%);
          animation: orb-1 30s ease-in-out infinite;
        }
        .dark .orb-1 {
          background: radial-gradient(circle at center, hsl(260 100% 70% / 0.08), transparent 70%);
        }
        .orb-2 {
          width: 400px;
          height: 400px;
          bottom: -150px;
          left: -100px;
          background: radial-gradient(circle at center, hsl(211 100% 60% / 0.2), transparent 70%);
          animation: orb-2 25s ease-in-out infinite;
        }
        .dark .orb-2 {
          background: radial-gradient(circle at center, hsl(211 100% 60% / 0.08), transparent 70%);
        }
        .orb-3 {
          width: 350px;
          height: 350px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle at center, hsl(190 100% 60% / 0.12), transparent 70%);
          animation: orb-3 35s ease-in-out infinite;
        }
        .dark .orb-3 {
          background: radial-gradient(circle at center, hsl(190 100% 60% / 0.05), transparent 70%);
        }
        .animate-breathe {
          animation: breathe 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
