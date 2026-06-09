import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  School, ChevronRight, Check, Loader2, Plus, X, BookOpen,
  GraduationCap, ArrowLeft, ArrowRight, Sparkles,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const CLASS_OPTIONS = [
  'Reception', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3',
]

const SUBJECT_OPTIONS = [
  'English Language', 'Mathematics', 'Physics', 'Chemistry', 'Biology',
  'Economics', 'Government', 'Literature', 'History', 'Geography',
  'Agricultural Science', 'Computer Science', 'Further Mathematics',
  'Accounting', 'Commerce', 'Civic Education', 'CRS', 'Islamic Studies',
  'French', 'Yoruba', 'Igbo', 'Hausa',
]

type Assignment = { classId: string; subjectId: string }

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  // Step 1: Account
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accountError, setAccountError] = useState('')
  const [creatingAccount, setCreatingAccount] = useState(false)

  // Step 2: Assignments
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [selectedClassMulti, setSelectedClassMulti] = useState<Set<string>>(new Set())

  const handleCreateAccount = async () => {
    if (!fullName || !email || !password) {
      setAccountError('All fields are required')
      return
    }
    if (password.length < 6) {
      setAccountError('Password must be at least 6 characters')
      return
    }

    setCreatingAccount(true)
    setAccountError('')

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            username: email.split('@')[0],
            role: 'teacher',
          },
        },
      })
      if (authError) throw authError
      setStep(2)
    } catch (err: any) {
      setAccountError(err?.message || 'Failed to create account')
    } finally {
      setCreatingAccount(false)
    }
  }

  const addAssignments = () => {
    const newAssignments: Assignment[] = []

    if (selectedClass && selectedSubjects.size > 0) {
      selectedSubjects.forEach(subjectId => {
        newAssignments.push({ classId: selectedClass, subjectId })
      })
    }

    if (newAssignments.length > 0) {
      setAssignments(prev => [...prev, ...newAssignments])
      setSelectedSubjects(new Set())
    }
  }

  const addBulkAssignments = () => {
    const newAssignments: Assignment[] = []
    selectedClassMulti.forEach(classId => {
      selectedSubjects.forEach(subjectId => {
        newAssignments.push({ classId, subjectId })
      })
    })
    if (newAssignments.length > 0) {
      setAssignments(prev => [...prev, ...newAssignments])
      setSelectedClassMulti(new Set())
      setSelectedSubjects(new Set())
    }
  }

  const removeAssignment = (index: number) => {
    setAssignments(prev => prev.filter((_, i) => i !== index))
  }

  const toggleSubject = (id: string) => {
    setSelectedSubjects(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleClassMulti = (id: string) => {
    setSelectedClassMulti(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single()

      if (!profile) throw new Error('Profile not found')

      // Create classes (ensure they exist)
      const classNames = [...new Set(assignments.map(a => a.classId))]
      const { data: existingClasses } = await supabase
        .from('classes')
        .select('id, name')

      const existingMap = new Map(existingClasses?.map(c => [c.name, c.id]) || [])
      const subjectIds: Record<string, number> = {}
      const classIds: Record<string, number> = {}

      // Find or create classes
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

      // Find or create subjects
      const subjectNames = [...new Set(assignments.map(a => a.subjectId))]
      const { data: existingSubjects } = await supabase
        .from('subjects')
        .select('id, name')

      const existingSubjMap = new Map(existingSubjects?.map(s => [s.name, s.id]) || [])

      for (const name of subjectNames) {
        if (existingSubjMap.has(name)) {
          subjectIds[name] = existingSubjMap.get(name)!
        }
      }

      // Create teacher_assignments
      const uniqueAssignments = new Set<string>()
      for (const a of assignments) {
        const classId = classIds[a.classId]
        const key = `${classId}-${subjectIds[a.subjectId] || a.subjectId}`
        if (!classId || !subjectIds[a.subjectId] || uniqueAssignments.has(key)) continue
        uniqueAssignments.add(key)

        await supabase.from('teacher_assignments').insert({
          teacher_id: profile.id,
          class_id: classId,
          subject_id: subjectIds[a.subjectId],
        })
      }

      setCompleted(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm border-border/50 text-center animate-scale-in">
          <CardContent className="pt-10 pb-8">
            <div className="w-16 h-16 rounded-full bg-status-completed/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-status-completed" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Welcome aboard!</h2>
            <p className="text-sm text-muted-foreground">
              Your account is ready. Redirecting to dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      {/* Steps indicator */}
      <div className="relative w-full max-w-lg mb-8">
        <div className="flex items-center justify-center gap-2">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300',
                step > s ? 'bg-primary text-primary-foreground' :
                step === s ? 'bg-primary text-primary-foreground ring-2 ring-primary/30' :
                'bg-muted text-muted-foreground',
              )}>
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              <span className={cn(
                'text-xs font-medium',
                step === s ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {s === 1 ? 'Account' : 'Assignments'}
              </span>
              {s < 2 && <div className="w-12 h-px bg-border mx-1" />}
            </div>
          ))}
        </div>
      </div>

      <div className="relative w-full max-w-lg animate-slide-up">
        {step === 1 && (
          <Card className="border-border/50 shadow-xl">
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <School className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-lg">Create your account</CardTitle>
              <CardDescription>
                Join ExamVault as a teacher. Set up your profile to get started.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {accountError && (
                <div className="text-sm px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                  {accountError}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@school.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Create a password (min 6 characters)"
                  required
                />
              </div>

              <Button
                onClick={handleCreateAccount}
                className="w-full"
                disabled={creatingAccount}
              >
                {creatingAccount ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating account...</>
                ) : (
                  <><Sparkles className="w-4 h-4 mr-2" /> Create account and continue</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            {/* Assignment creation */}
            <Card className="border-border/50 shadow-xl">
              <CardHeader>
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Teaching assignments</CardTitle>
                <CardDescription>
                  Tell us what you teach. Choose classes and subjects below.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Single class + multi subject */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Quick add — one class, multiple subjects
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={selectedClass}
                      onChange={e => setSelectedClass(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      <option value="">Select class...</option>
                      {CLASS_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addAssignments}
                      disabled={!selectedClass || selectedSubjects.size === 0}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>

                {/* Subject tags */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Subjects {selectedSubjects.size > 0 && `(${selectedSubjects.size} selected)`}
                  </Label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {SUBJECT_OPTIONS.map(subj => (
                      <button
                        key={subj}
                        onClick={() => toggleSubject(subj)}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full border transition-all',
                          selectedSubjects.has(subj)
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                        )}
                      >
                        {subj}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Bulk mode: multi class + multi subject */}
                <div>
                  <Label className="text-xs font-medium text-muted-foreground mb-2 block">
                    Bulk add — multiple classes, multiple subjects
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {CLASS_OPTIONS.map(c => (
                      <button
                        key={c}
                        onClick={() => toggleClassMulti(c)}
                        className={cn(
                          'text-xs px-2.5 py-1 rounded-full border transition-all',
                          selectedClassMulti.has(c)
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'border-border text-muted-foreground hover:border-primary/50',
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addBulkAssignments}
                    disabled={selectedClassMulti.size === 0 || selectedSubjects.size === 0}
                  >
                    <GraduationCap className="w-4 h-4 mr-1" />
                    Create {selectedClassMulti.size * selectedSubjects.size} assignments
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Assignment list */}
            {assignments.length > 0 && (
              <Card className="border-border/50 shadow-xl animate-slide-up">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    Your assignments ({assignments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {assignments.map((a, i) => (
                      <Badge key={i} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                        <span>{a.classId} — {a.subjectId}</span>
                        <button
                          onClick={() => removeAssignment(i)}
                          className="ml-1 hover:text-destructive transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={handleFinish} disabled={saving || assignments.length === 0} className="flex-1">
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <><Check className="w-4 h-4 mr-1" /> Complete setup</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
