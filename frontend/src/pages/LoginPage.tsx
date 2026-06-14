import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { School, Eye, EyeOff, Loader2 } from 'lucide-react'
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/20">
            <School className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Scribe</h1>
          <p className="text-sm text-muted-foreground mt-1">School Examination Management</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{forgotMode ? 'Reset password' : 'Welcome back'}</CardTitle>
            <CardDescription>
              {forgotMode
                ? 'Enter your email address to receive a recovery link'
                : 'Sign in to your account'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive animate-fade-in">
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="text-sm px-4 py-3 rounded-lg bg-status-completed-bg border border-status-completed/20 text-status-completed animate-fade-in">
                  {successMsg}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@school.com"
                  required
                  autoFocus
                />
              </div>

              {!forgotMode && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setError(''); setSuccessMsg('') }}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer"
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
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {forgotMode ? 'Sending link...' : 'Signing in...'}
                  </>
                ) : (
                  forgotMode ? 'Send Reset Link' : 'Sign in'
                )}
              </Button>

              {forgotMode && (
                <button
                  type="button"
                  onClick={() => { setForgotMode(false); setError(''); setSuccessMsg('') }}
                  className="w-full text-center text-xs text-muted-foreground hover:text-primary transition-colors mt-2 block"
                >
                  Back to login
                </button>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Don't have an account?{' '}
          <Link to="/onboarding" className="text-primary hover:underline font-medium">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
