import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, ChevronLeft, Eye, EyeOff, Check, Loader2,
  Plus, X, Mail,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Constants ──────────────────────────────────────────────────────

type MicroStep = 'name' | 'email' | 'password' | 'confirming'
type ConfirmState = 'in-progress' | 'success' | 'error'
type AnimPhase = 'idle' | 'exit' | 'enter-prep' | 'enter'

const CLASS_OPTIONS = [
  'Reception', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3',
]

const SUBJECTS_BY_CLASS: Record<string, string[]> = {
  'Reception': ['English Language', 'Mathematics', 'Basic Science', 'Social Studies', 'Creative Arts'],
  'Primary 1': ['English Language', 'Mathematics', 'Basic Science', 'Social Studies', 'CRS', 'Agricultural Science', 'Creative Arts'],
  'Primary 2': ['English Language', 'Mathematics', 'Basic Science', 'Social Studies', 'CRS', 'Agricultural Science', 'Creative Arts'],
  'Primary 3': ['English Language', 'Mathematics', 'Basic Science', 'Social Studies', 'CRS', 'Agricultural Science', 'Creative Arts'],
  'Primary 4': ['English Language', 'Mathematics', 'Basic Science', 'Social Studies', 'CRS', 'Agricultural Science', 'Creative Arts'],
  'Primary 5': ['English Language', 'Mathematics', 'Basic Science', 'Social Studies', 'CRS', 'Agricultural Science', 'Creative Arts'],
  'Primary 6': ['English Language', 'Mathematics', 'Basic Science', 'Social Studies', 'CRS', 'Agricultural Science', 'Creative Arts'],
  'JSS 1': ['English Language', 'Mathematics', 'Basic Science', 'Basic Technology', 'Social Studies', 'CRS', 'Agricultural Science', 'Business Studies', 'Computer Science', 'Creative Arts'],
  'JSS 2': ['English Language', 'Mathematics', 'Basic Science', 'Basic Technology', 'Social Studies', 'CRS', 'Agricultural Science', 'Business Studies', 'Computer Science', 'Creative Arts'],
  'JSS 3': ['English Language', 'Mathematics', 'Basic Science', 'Basic Technology', 'Social Studies', 'CRS', 'Agricultural Science', 'Business Studies', 'Computer Science', 'Creative Arts'],
  'SS 1': ['English Language', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government', 'Literature', 'History', 'Geography', 'Agricultural Science', 'Computer Science', 'Further Mathematics', 'Accounting', 'Commerce', 'Civic Education', 'CRS', 'French', 'Yoruba'],
  'SS 2': ['English Language', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government', 'Literature', 'History', 'Geography', 'Agricultural Science', 'Computer Science', 'Further Mathematics', 'Accounting', 'Commerce', 'Civic Education', 'CRS', 'French', 'Yoruba'],
  'SS 3': ['English Language', 'Mathematics', 'Physics', 'Chemistry', 'Biology', 'Economics', 'Government', 'Literature', 'History', 'Geography', 'Agricultural Science', 'Computer Science', 'Further Mathematics', 'Accounting', 'Commerce', 'Civic Education', 'CRS', 'French', 'Yoruba'],
}

type Assignment = { classId: string; subjectId: string }

// ─── Helpers ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getPasswordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0
  let classes = 0
  if (/[a-z]/.test(password)) classes++
  if (/[A-Z]/.test(password)) classes++
  if (/[0-9]/.test(password)) classes++
  if (/[^a-zA-Z0-9]/.test(password)) classes++

  if (password.length < 8) return 1
  if (password.length >= 12 && classes === 4) return 4
  if (classes >= 3) return 3
  if (classes >= 2) return 2
  return 1
}

// ─── Component ──────────────────────────────────────────────────────

export default function OnboardingPage() {
  const navigate = useNavigate()

  // Auth check
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [autoSignedIn, setAutoSignedIn] = useState(false)

  // Step 1: micro-step flow
  const [microStep, setMicroStep] = useState<MicroStep>('name')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [errorStep, setErrorStep] = useState<MicroStep | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmState>('in-progress')

  // Animation
  const [animPhase, setAnimPhase] = useState<AnimPhase>('idle')
  const [animDir, setAnimDir] = useState<'forward' | 'backward'>('forward')
  const [cachedStep, setCachedStep] = useState<MicroStep | null>(null)
  const animTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // For step 2
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [setupError, setSetupError] = useState('')

  // Session check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session?.user)
      setCheckingAuth(false)
    })
  }, [])

  // Cleanup animation timeout on unmount
  useEffect(() => {
    return () => { if (animTimeout.current) clearTimeout(animTimeout.current) }
  }, [])

  // ─── Slide transition ─────────────────────────────────────────────

  const slideTo = (next: MicroStep, dir: 'forward' | 'backward') => {
    if (animPhase !== 'idle') return
    setAnimDir(dir)
    setCachedStep(microStep)
    setAnimPhase('exit')

    animTimeout.current = setTimeout(() => {
      setMicroStep(next)
      setCachedStep(null)
      setAnimPhase('enter-prep')

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimPhase('enter')
        })
      })

      animTimeout.current = setTimeout(() => {
        setAnimPhase('idle')
      }, 250)
    }, 180)
  }

  // ─── Sign-up logic ────────────────────────────────────────────────

  const handleCreateAccount = async () => {
    if (animPhase !== 'idle') return

    setAccountError('')
    setErrorStep(null)
    setMicroStep('confirming')
    setConfirmState('in-progress')

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email, password,
        options: {
          data: {
            full_name: fullName,
            username: email.split('@')[0],
            role: 'teacher',
            onboarding_complete: false,
          },
        },
      })
      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('AN_ACCOUNT_EXISTS')
        }
        throw new Error(authError.message || 'Failed to create account')
      }
      if (!data.user) throw new Error('Failed to create account')

      try {
        await supabase.from('users').insert({
          auth_id: data.user.id,
          username: email.split('@')[0],
          email,
          full_name: fullName,
          role: 'teacher',
        })
      } catch {
        // non-fatal
      }

      if (data.session) {
        // Auto-signed-in (email confirmation OFF) → go straight to assignments
        setAutoSignedIn(true)
      } else {
        // Email confirmation required → show success screen
        setConfirmState('success')
      }
    } catch (err: any) {
      const msg = err?.message || ''
      let friendly: string
      let backTo: MicroStep

      if (msg === 'AN_ACCOUNT_EXISTS') {
        friendly = 'An account already exists with this email'
        backTo = 'email'
      } else if (msg.includes('Password')) {
        friendly = 'Make sure your password is strong enough'
        backTo = 'password'
      } else {
        friendly = 'Something went wrong — please try again'
        backTo = 'password'
      }

      setAccountError(friendly)
      setErrorStep(backTo)
      setConfirmState('error')

      animTimeout.current = setTimeout(() => {
        slideTo(backTo, 'backward')
      }, 600)
    }
  }

  // ─── Step 2 logic ─────────────────────────────────────────────────

  const addAssignments = () => {
    const newAssignments: Assignment[] = []
    if (selectedClass && selectedSubjects.size > 0) {
      selectedSubjects.forEach(subjectId => {
        if (!isSubjectAssigned(selectedClass, subjectId)) {
          newAssignments.push({ classId: selectedClass, subjectId })
        }
      })
    }
    if (newAssignments.length > 0) {
      setAssignments(prev => [...prev, ...newAssignments])
      setSelectedSubjects(new Set())
    }
  }

  const removeAssignment = (index: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== index))
  }

  const isSubjectAssigned = (classId: string, subjectId: string) =>
    assignments.some(a => a.classId === classId && a.subjectId === subjectId)

  const toggleSubject = (id: string) => {
    if (selectedClass && isSubjectAssigned(selectedClass, id)) return
    setSelectedSubjects(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleFinish = async () => {
    setSaving(true)
    setSetupError('')
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('Not authenticated')

      const profileId = authUser.id

      const classNames = [...new Set(assignments.map(a => a.classId))]
      const { data: existingClasses } = await supabase
        .from('classes')
        .select('id, name')

      const existingMap = new Map(existingClasses?.map(c => [c.name, c.id]) || [])
      const subjectIds: Record<string, number> = {}
      const classIds: Record<string, number> = {}

      for (const name of classNames) {
        if (existingMap.has(name)) {
          classIds[name] = existingMap.get(name)!
        } else {
          const { data } = await supabase.from('classes').insert({
            name, school_id: 1, section: null,
          }).select().single()
          if (data) classIds[name] = data.id
        }
      }

      // Get the database teacher profile id matching auth user's id
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', profileId)
        .single()
      const dbTeacherId = profile?.id

      const uniqueAssignments = new Set<string>()
      for (const a of assignments) {
        const classId = classIds[a.classId]
        if (!classId) continue

        // Find or create subject for this specific class
        let subjId: number | null = null
        const { data: existingSubj } = await supabase
          .from('subjects')
          .select('id')
          .eq('name', a.subjectId)
          .eq('class_id', classId)
          .maybeSingle()

        if (existingSubj) {
          subjId = existingSubj.id
        } else {
          const { data: newSubj, error: subjErr } = await supabase
            .from('subjects')
            .insert({ name: a.subjectId, class_id: classId })
            .select()
            .single()
          if (subjErr) throw subjErr
          if (newSubj) subjId = newSubj.id
        }

        if (!subjId) continue

        const key = `${classId}-${subjId}`
        if (uniqueAssignments.has(key)) continue
        uniqueAssignments.add(key)

        const { error: assnErr } = await supabase.from('teacher_assignments').insert({
          teacher_id: dbTeacherId || null,
          auth_id: profileId,
          class_id: classId,
          subject_id: subjId,
        })
        if (assnErr) throw assnErr
      }

      await supabase.auth.updateUser({
        data: { onboarding_complete: true },
      })

      setCompleted(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (err: any) {
      console.error(err)
      const msg = err?.message || ''
      if (msg.includes('403') || msg.includes('Not authenticated') || msg.includes('Auth session missing')) {
        setSetupError('Your session may have expired. Try signing in again.')
      } else if (msg.includes('relation') || msg.includes('does not exist')) {
        setSetupError('A required database table is missing. Please contact your administrator.')
      } else {
        setSetupError(msg || 'Something went wrong. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  // ─── Step renderers ────────────────────────────────────────────────

  const isValidEmail = EMAIL_RE.test(email)

  const stepName = () => (
    <>
      <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">
        What's your name?
      </h1>
      <p className="text-sm text-text-secondary mt-1.5 leading-snug">
        This is how you'll appear to administrators and colleagues.
      </p>

      <div className="mt-7">
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Full name
        </label>
        <input
          autoFocus
          value={fullName}
          onChange={e => {
            setFullName(e.target.value)
            if (errorStep === 'name') { setAccountError(''); setErrorStep(null) }
          }}
          placeholder="Your full name"
          className="block w-full h-11 px-3.5 rounded-xl bg-background-secondary border border-border text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_hsla(211,100%,50%,0.12)]"
        />
      </div>

      <div className="mt-6">
        <button
          onClick={() => slideTo('email', 'forward')}
          disabled={fullName.trim().length < 2 || /\d/.test(fullName)}
          className="w-full h-11 rounded-xl bg-accent text-white text-[15px] font-medium
            disabled:opacity-40 disabled:cursor-not-allowed
            active:scale-[0.98] active:brightness-[0.94] transition-all duration-instant"
        >
          Continue
        </button>
      </div>
    </>
  )

  const stepEmail = () => (
    <>
      {microStep !== 'name' && (
        <button
          onClick={() => slideTo('name', 'backward')}
          className="flex items-center gap-1 text-sm text-accent mb-4 hover:opacity-70 transition-opacity"
        >
          <ChevronLeft size={20} />
          <span>Back</span>
        </button>
      )}

      <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">
        Your school email
      </h1>
      <p className="text-sm text-text-secondary mt-1.5 leading-snug">
        Use your official school email address. We'll send a confirmation link here.
      </p>

      <div className="mt-7">
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Email address
        </label>
        <div className="relative">
          <input
            autoFocus
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              if (errorStep === 'email') { setAccountError(''); setErrorStep(null) }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && isValidEmail) slideTo('password', 'forward')
            }}
            placeholder="you@school.com"
            className="block w-full h-11 px-3.5 rounded-xl bg-background-secondary border border-border text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_hsla(211,100%,50%,0.12)]"
          />
          {email.length > 0 && isValidEmail && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-status-completed">
              <Check size={18} strokeWidth={3} />
            </div>
          )}
        </div>
        {errorStep === 'email' && accountError && (
          <p className="text-sm text-status-rejected mt-1.5">{accountError}</p>
        )}
      </div>

      <div className="mt-6">
        <button
          onClick={() => slideTo('password', 'forward')}
          disabled={!isValidEmail}
          className="w-full h-11 rounded-xl bg-accent text-white text-[15px] font-medium
            disabled:opacity-40 disabled:cursor-not-allowed
            active:scale-[0.98] active:brightness-[0.94] transition-all duration-instant"
        >
          Continue
        </button>
      </div>
    </>
  )

  const strength = getPasswordStrength(password)
  const strengthSegments = [1, 2, 3, 4] as const
  const hasStartedTyping = password.length > 0

  const segmentColor = (segIndex: number) => {
    if (segIndex > strength) return 'bg-border'
    if (strength === 1) return 'bg-status-rejected'
    if (strength === 2 || strength === 3) return 'bg-status-pending'
    return 'bg-status-completed'
  }

  const stepPassword = () => (
    <>
      <button
        onClick={() => slideTo('email', 'backward')}
        className="flex items-center gap-1 text-sm text-accent mb-4 hover:opacity-70 transition-opacity"
      >
        <ChevronLeft size={20} />
        <span>Back</span>
      </button>

      <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">
        Create a password
      </h1>
      <p className="text-sm text-text-secondary mt-1.5 leading-snug">
        At least 8 characters. You'll use this to sign in.
      </p>

      <div className="mt-7">
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            autoFocus
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => {
              setPassword(e.target.value)
              if (errorStep === 'password') { setAccountError(''); setErrorStep(null) }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && strength >= 2) handleCreateAccount()
            }}
            placeholder="Create a password"
            className="block w-full h-11 px-3.5 pr-11 rounded-xl bg-background-secondary border border-border text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_3px_hsla(211,100%,50%,0.12)]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {/* Strength indicator */}
        <div className={cn(
          'mt-2.5 flex gap-1 overflow-hidden transition-all duration-300',
          hasStartedTyping ? 'opacity-100 h-1.5' : 'opacity-0 h-0',
        )}>
          {strengthSegments.map((seg) => (
            <div
              key={seg}
              className="h-full flex-1 rounded-full bg-border transition-all duration-300 overflow-hidden"
            >
              <div
                className={cn('h-full rounded-full transition-all duration-300', segmentColor(seg))}
                style={{ width: seg <= strength ? '100%' : '0%' }}
              />
            </div>
          ))}
        </div>

        {errorStep === 'password' && accountError && (
          <p className="text-sm text-status-rejected mt-1.5">{accountError}</p>
        )}
      </div>

      <div className="mt-6">
        <button
          onClick={handleCreateAccount}
          disabled={strength < 2}
          className="w-full h-11 rounded-xl bg-accent text-white text-[15px] font-medium
            disabled:opacity-40 disabled:cursor-not-allowed
            active:scale-[0.98] active:brightness-[0.94] transition-all duration-instant"
        >
          Create Account
        </button>
      </div>
    </>
  )

  const stepConfirming = () => (
    <div className="flex flex-col items-center justify-center py-6 min-h-[220px]">
      {confirmState === 'in-progress' && (
        <>
          <Loader2 size={32} className="animate-spin text-accent" />
          <p className="mt-5 text-[15px] font-medium text-text-primary">Creating your account…</p>
        </>
      )}

      {confirmState === 'success' && (
        <>
          <svg width="56" height="56" viewBox="0 0 56 56" className="mb-5">
            <circle
              cx="28" cy="28" r="24"
              fill="none" stroke="hsl(var(--status-completed))" strokeWidth="3"
              strokeDasharray={151} strokeDashoffset={151}
              style={{ animation: 's-cir 400ms ease forwards' }}
            />
            <path
              d="M18 28l6 6 14-14"
              fill="none" stroke="hsl(var(--status-completed))" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={30} strokeDashoffset={30}
              style={{ animation: 's-chk 400ms 400ms ease forwards' }}
            />
          </svg>
          <h2 className="text-[22px] font-semibold tracking-tight text-text-primary">Check your email</h2>
          <p className="text-sm text-text-secondary mt-2 text-center leading-snug">
            We sent a confirmation link to{' '}
            <span className="font-medium text-text-primary">{email}</span>.
            <br />
            Click it to activate your account, then come back to sign in.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-7 w-full h-11 rounded-xl bg-accent text-white text-[15px] font-medium
              active:scale-[0.98] active:brightness-[0.94] transition-all duration-instant"
          >
            Go to sign in
          </button>
          <button
            onClick={() => {
              setFullName('')
              setEmail('')
              setPassword('')
              setAccountError('')
              setErrorStep(null)
              setMicroStep('name')
            }}
            className="mt-3 text-sm text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Wrong email? Start over
          </button>
        </>
      )}

      {confirmState === 'error' && (
        <p className="text-sm text-text-tertiary">Something didn't work — taking you back…</p>
      )}
    </div>
  )

  // ─── Render step content with animation ───────────────────────────

  const renderStepContent = (step: MicroStep) => {
    switch (step) {
      case 'name': return stepName()
      case 'email': return stepEmail()
      case 'password': return stepPassword()
      case 'confirming': return stepConfirming()
    }
  }

  const getWrapperStyle = () => {
    if (animPhase === 'idle') return {}

    const exitOffset = animDir === 'forward' ? '-20px' : '20px'
    const enterOffset = animDir === 'forward' ? '20px' : '-20px'

    return {
      exit: {
        position: 'absolute' as const,
        inset: 0,
        transition: 'all 180ms cubic-bezier(0.4, 0, 1, 1)',
        opacity: animPhase === 'exit' ? 0 : 1,
        transform: animPhase === 'exit' ? `translateX(${exitOffset})` : 'translateX(0)',
      } as React.CSSProperties,
      enter: {
        transition: animPhase === 'enter'
          ? 'all 220ms cubic-bezier(0, 0, 0.2, 1)'
          : 'none',
        opacity: animPhase === 'enter' ? 1 : 0,
        transform: animPhase === 'enter'
          ? 'translateX(0)'
          : `translateX(${enterOffset})`,
      } as React.CSSProperties,
    }
  }

  // ─── Loading state ────────────────────────────────────────────────

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    )
  }

  // ─── Step 2 (authenticated user) ──────────────────────────────────

  if ((isAuthenticated || autoSignedIn) && completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm bg-surface rounded-2xl shadow-card p-10 pt-12 pb-8 text-center">
          <svg width="56" height="56" viewBox="0 0 56 56" className="mx-auto mb-5">
            <circle
              cx="28" cy="28" r="24"
              fill="none" stroke="hsl(var(--status-completed))" strokeWidth="3"
              strokeDasharray={151} strokeDashoffset={151}
              style={{ animation: 's-cir 400ms ease forwards' }}
            />
            <path
              d="M18 28l6 6 14-14"
              fill="none" stroke="hsl(var(--status-completed))" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={30} strokeDashoffset={30}
              style={{ animation: 's-chk 400ms 400ms ease forwards' }}
            />
          </svg>
          <h2 className="text-[22px] font-semibold tracking-tight text-text-primary mb-2">Welcome aboard!</h2>
          <p className="text-sm text-text-secondary">Your account is ready. Redirecting to dashboard…</p>
        </div>
      </div>
    )
  }

  if (isAuthenticated || autoSignedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-full max-w-lg">
          <div className="relative w-full max-w-lg">
            <div className="space-y-4">
              <div className="bg-surface rounded-2xl shadow-card p-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                    <BookOpen className="w-[18px] h-[18px] text-accent" />
                  </div>
                  <h2 className="text-base font-semibold text-text-primary">Teaching assignments</h2>
                </div>
                <p className="text-sm text-text-secondary mb-5">
                  Tell us what you teach. Choose classes and subjects below.
                </p>

                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-medium text-text-secondary mb-2 block">
                      Quick add — one class, multiple subjects
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        value={selectedClass}
                        onChange={e => {
                          setSelectedClass(e.target.value)
                          setSelectedSubjects(new Set())
                        }}
                        className="flex h-9 w-full rounded-lg border border-border bg-transparent px-3 py-1 text-sm text-text-primary"
                      >
                        <option value="">Select class...</option>
                        {CLASS_OPTIONS.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <button
                        onClick={addAssignments}
                        disabled={!selectedClass || selectedSubjects.size === 0}
                        className="flex items-center justify-center gap-1 h-9 rounded-lg border border-border text-sm font-medium
                          text-text-secondary hover:bg-background-tertiary transition-colors
                          disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-text-secondary">
                        Subjects{selectedSubjects.size > 0 && ` (${selectedSubjects.size} selected)`}
                      </label>
                      {selectedClass && (() => {
                        const allSubjects = SUBJECTS_BY_CLASS[selectedClass] || []
                        const allSelected = allSubjects.length > 0 && allSubjects.every(s => selectedSubjects.has(s))
                        return allSubjects.length > 0 && (
                          <button
                            onClick={() => {
                              if (allSelected) setSelectedSubjects(new Set())
                              else setSelectedSubjects(new Set(allSubjects))
                            }}
                            className="text-xs font-medium text-accent hover:opacity-70 transition-opacity"
                          >
                            {allSelected ? 'Clear' : 'Add all'}
                          </button>
                        )
                      })()}
                    </div>
                    {selectedClass ? (
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                        {(SUBJECTS_BY_CLASS[selectedClass] || []).map(subj => {
                          const assigned = isSubjectAssigned(selectedClass, subj)
                          return (
                            <button
                              key={subj}
                              onClick={() => toggleSubject(subj)}
                              type="button"
                              disabled={assigned}
                              className={cn(
                                'text-xs px-2.5 py-1 rounded-full border transition-all',
                                assigned
                                  ? 'border-border text-text-disabled opacity-40 cursor-not-allowed'
                                  : selectedSubjects.has(subj)
                                    ? 'bg-accent text-accent-foreground border-accent'
                                    : 'border-border text-text-tertiary hover:border-accent/50 hover:text-text-primary',
                              )}
                            >
                              {assigned ? `${subj} ✓` : subj}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-text-tertiary py-3">Select a class above to see its subjects.</p>
                    )}
                  </div>
                </div>
              </div>

              {assignments.length > 0 && (
                <div className="bg-surface rounded-2xl shadow-card p-8 animate-fade-in">
                  <h3 className="text-sm font-medium text-text-primary mb-3">
                    Your assignments ({assignments.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {assignments.map((a, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-background-tertiary text-text-secondary"
                      >
                        <span>{a.classId} — {a.subjectId}</span>
                        <button
                          onClick={() => removeAssignment(i)}
                          className="ml-0.5 hover:text-status-rejected transition-colors"
                        >
                          <span className="text-sm leading-none">&times;</span>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {setupError && (
                <div className="p-3 rounded-xl bg-status-rejected-bg border border-status-rejected/20">
                  <p className="text-xs text-status-rejected">{setupError}</p>
                  <button
                    onClick={handleFinish}
                    className="mt-2 text-xs font-medium text-accent hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 h-11 rounded-xl border border-border text-sm font-medium text-text-secondary
                    hover:bg-background-tertiary transition-colors"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleFinish}
                  disabled={saving || assignments.length === 0}
                  className="flex-1 h-11 rounded-xl bg-accent text-white text-sm font-medium
                    disabled:opacity-40 disabled:cursor-not-allowed
                    active:scale-[0.98] active:brightness-[0.94] transition-all duration-instant"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin" />
                      Saving…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Check size={14} />
                      Complete setup
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Step 1 (new Apple-style flow) ────────────────────────────────

  const styles = getWrapperStyle()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <BookOpen size={28} className="text-accent" />
        <span className="text-lg font-semibold tracking-tight text-text-primary">ExamVault</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-surface rounded-2xl shadow-card p-10 pb-8">
        {/* Animated content area */}
        <div className="relative min-h-[260px] overflow-hidden">
          {/* Exiting content (during transition) */}
          {animPhase === 'exit' && cachedStep && (
            <div style={styles.exit}>
              {renderStepContent(cachedStep)}
            </div>
          )}

          {/* Current / entering content */}
          <div
            style={{
              ...(animPhase !== 'idle' ? { position: 'absolute' as const, inset: 0 } : {}),
              ...(animPhase === 'idle' ? {} : styles.enter),
            }}
          >
            {renderStepContent(microStep)}
          </div>
        </div>
      </div>

      {/* Inline styles for SVG animations */}
      <style>{`
        @keyframes s-cir { to { stroke-dashoffset: 0; } }
        @keyframes s-chk { to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  )
}
