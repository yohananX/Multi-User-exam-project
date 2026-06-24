import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, XCircle, Eye, EyeOff, LogOut, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { assignmentsApi } from '@/api/endpoints'

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

const StrengthBar: React.FC<{ password: string }> = ({ password }) => {
  const strength = getPasswordStrength(password)
  const segments = [1, 2, 3, 4] as const
  const hasStarted = password.length > 0

  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const segmentColor = (segIndex: number) => {
    if (segIndex > strength) return 'bg-border'
    if (strength === 1) return 'bg-status-rejected'
    if (strength === 2 || strength === 3) return 'bg-status-pending'
    return 'bg-status-completed'
  }

  return (
    <div className="space-y-1.5">
      <div className={cn(
        'flex gap-1 overflow-hidden transition-all duration-300',
        hasStarted ? 'opacity-100 h-1.5' : 'opacity-0 h-0',
      )}>
        {segments.map(seg => (
          <div key={seg} className="h-full flex-1 rounded-full bg-border/40 transition-all duration-300 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500 ease-standard', segmentColor(seg))}
              style={{ width: seg <= strength ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>
      {hasStarted && (
        <p className={cn(
          'text-[12px] font-medium transition-all duration-300',
          strength === 0 && 'opacity-0',
          strength === 1 && 'text-status-rejected',
          strength === 2 && 'text-status-pending',
          strength === 3 && 'text-status-pending',
          strength === 4 && 'text-status-completed',
        )}>
          {strengthLabels[strength]}
        </p>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isTeacher = user?.role === 'teacher'

  // ── Profile state ──
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const originalEmail = user?.email || ''
  const [saving, setSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  // ── Password state ──
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword
  const passwordsDontMatch = confirmPassword.length > 0 && newPassword !== confirmPassword
  const passwordStrength = getPasswordStrength(newPassword)
  const canSavePassword = currentPassword.length > 0 && newPassword.length >= 8 && confirmPassword.length > 0 && passwordsMatch && passwordStrength >= 2

  // ── Assignments state ──
  const [assignments, setAssignments] = useState<any[]>([])
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [loadingAssignments, setLoadingAssignments] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('teacher_assignments')
      .select('*, classes!inner(name), subjects!inner(name)')
      .eq('teacher_id', user.id)
      .then(({ data }) => {
        setAssignments(data || [])
        setLoadingAssignments(false)
      }, () => setLoadingAssignments(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, location])

  // ── Profile save ──
  const handleSaveProfile = async () => {
    setSaving(true)
    setProfileSuccess('')
    setProfileError('')
    try {
      if (email !== user?.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email })
        if (emailError) throw emailError
      }
      if (fullName !== user?.full_name) {
        const { error: nameError } = await supabase.auth.updateUser({ data: { full_name: fullName } })
        if (nameError) throw nameError
      }
      if (user?.id) {
        const { error: dbError } = await supabase
          .from('users')
          .update({ full_name: fullName, email })
          .eq('id', user.id)
        if (dbError) throw dbError
      }
      setProfileSuccess('Saved successfully')
      setTimeout(() => setProfileSuccess(''), 3000)
    } catch (err: any) {
      setProfileError(err.message || 'Failed to save')
    }
    setSaving(false)
  }

  // ── Password save ──
  const handleSavePassword = async () => {
    setSavingPassword(true)
    setPasswordSuccess('')
    setPasswordError('')
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      })
      if (signInError) throw new Error('Current password is incorrect')

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Password updated')
      setTimeout(() => setPasswordSuccess(''), 3000)
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password')
    }
    setSavingPassword(false)
  }

  // ── Remove assignment ──
  const handleRemoveAssignment = async (id: number) => {
    try {
      await assignmentsApi.delete(id)
      setAssignments(prev => prev.filter(a => a.id !== id))
    } catch { /* ignore */ }
    setRemovingId(null)
  }

  // ── Sign out of all devices ──
  const handleGlobalSignOut = async () => {
    await supabase.auth.signOut({ scope: 'global' })
    navigate('/login')
  }

  // ── Danger zone: only for teachers, not admins ──
  const showDangerZone = isTeacher

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <div className="max-w-[640px] mx-auto p-6 flex flex-col gap-6 pb-16">
      {/* ── Section 1: Profile ── */}
      <section
        className="glass-card p-7"
        style={{ animation: 'slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both' }}
      >
        <h2 className="text-[17px] font-semibold text-text-primary mb-6">Profile</h2>
        <div className="flex gap-5">
          {/* Avatar */}
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-accent to-[hsl(260,100%,60%)] flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-white/20">
            <span className="text-[22px] font-semibold text-white">{initials}</span>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            {/* Full name */}
            <div>
              <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full h-11 px-4 rounded-[14px] bg-background-secondary/70 border border-border text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_hsla(211,100%,50%,0.12)]"
              />
              <p className="text-[12px] text-text-tertiary mt-1.5 italic flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-text-tertiary/40" />
                Changes to your name are display-only for now.
              </p>
            </div>

            {/* Email */}
            <div>
              <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-[14px] bg-background-secondary/70 border border-border text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_hsla(211,100%,50%,0.12)]"
              />
              {email !== originalEmail && (
                <p className="text-[12px] text-status-pending mt-1.5 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-status-pending" />
                  Changing your email will require re-confirmation at the new address.
                </p>
              )}
            </div>

            {/* Save button + messages */}
            <div className="flex items-center justify-between pt-1">
              <div>
                {profileSuccess && (
                  <div className="flex items-center gap-1.5 text-[13px] text-status-completed animate-slide-down">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{profileSuccess}</span>
                  </div>
                )}
                {profileError && (
                  <div className="flex items-center gap-1.5 text-[13px] text-status-rejected animate-slide-down">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{profileError}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="h-11 px-7 rounded-[14px] bg-accent text-white text-[15px] font-medium disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.97] hover:brightness-95 transition-all duration-150 shadow-sm"
              >
                {saving ? 'Saving\u2026' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Change Password ── */}
      <section
        className="glass-card p-7"
        style={{ animation: 'slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both', animationDelay: '80ms' }}
      >
        <h2 className="text-[17px] font-semibold text-text-primary mb-6">Change Password</h2>
        <div className="flex flex-col gap-5">
          {/* Current Password */}
          <div>
            <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="w-full h-11 px-4 pr-12 rounded-[14px] bg-background-secondary/70 border border-border text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_hsla(211,100%,50%,0.12)]"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
              >
                {showCurrent ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full h-11 px-4 pr-12 rounded-[14px] bg-background-secondary/70 border border-border text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_hsla(211,100%,50%,0.12)]"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
              >
                {showNew ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
            <StrengthBar password={newPassword} />
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="text-[13px] font-medium text-text-secondary mb-1.5 block">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full h-11 px-4 pr-12 rounded-[14px] bg-background-secondary/70 border border-border text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_hsla(211,100%,50%,0.12)]"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
              >
                {showConfirm ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
              </button>
            </div>
            {passwordsDontMatch && (
              <div className="flex items-center gap-1.5 text-[12px] text-status-rejected mt-1.5 animate-slide-down">
                <XCircle className="w-3.5 h-3.5" />
                <span>Passwords don't match</span>
              </div>
            )}
            {passwordsMatch && newPassword.length >= 8 && (
              <div className="flex items-center gap-1.5 text-[12px] text-status-completed mt-1.5 animate-slide-down">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Passwords match</span>
              </div>
            )}
          </div>

          {/* Save button + messages */}
          <div className="flex items-center justify-between pt-1">
            <div>
              {passwordSuccess && (
                <div className="flex items-center gap-1.5 text-[13px] text-status-completed animate-slide-down">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{passwordSuccess}</span>
                </div>
              )}
              {passwordError && (
                <div className="flex items-center gap-1.5 text-[13px] text-status-rejected animate-slide-down">
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{passwordError}</span>
                </div>
              )}
            </div>
            <button
              onClick={handleSavePassword}
              disabled={!canSavePassword || savingPassword}
              className="h-11 px-7 rounded-[14px] bg-accent text-white text-[15px] font-medium disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.97] hover:brightness-95 transition-all duration-150 shadow-sm"
            >
              {savingPassword ? 'Saving\u2026' : 'Save'}
            </button>
          </div>
        </div>
      </section>

      {/* ── Section 3: Teaching Assignments ── */}
      <section
        className="glass-card p-7"
        style={{ animation: 'slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both', animationDelay: '160ms' }}
      >
        <h2 className="text-[17px] font-semibold text-text-primary mb-5">Teaching Assignments</h2>
        {loadingAssignments ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="h-4 w-48 skeleton rounded-md" />
                <div className="h-8 w-20 skeleton rounded-lg" />
              </div>
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-background-secondary flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6 text-text-tertiary" />
            </div>
            <p className="text-[14px] text-text-secondary max-w-sm mx-auto">
              You have no teaching assignments yet. Contact your administrator to get assigned.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {assignments.map(a => (
              <div
                key={a.id}
                className={cn(
                  'flex items-center justify-between py-3.5 transition-all duration-200 overflow-hidden',
                  a._removing ? 'opacity-0 h-0 py-0' : 'opacity-100 h-auto',
                )}
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[14px] font-medium text-text-primary">{a.classes?.name}</span>
                  <span className="text-[14px] text-text-secondary">{' \u00B7 '}{a.subjects?.name}</span>
                </div>
                {removingId === a.id ? (
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-[13px] text-text-primary whitespace-nowrap">Remove this assignment?</span>
                    <button
                      onClick={() => handleRemoveAssignment(a.id)}
                      className="text-[13px] font-medium text-status-rejected underline cursor-pointer bg-transparent border-none p-0 hover:no-underline transition-all"
                    >
                      Yes, remove
                    </button>
                    <button
                      onClick={() => setRemovingId(null)}
                      className="text-[13px] text-text-secondary cursor-pointer bg-transparent border-none p-0 hover:text-text-primary transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setRemovingId(a.id)}
                    className="h-9 px-4 rounded-[10px] border border-border/60 text-[13px] text-status-rejected bg-transparent hover:bg-[hsl(0_70%_50%/0.08)] hover:border-status-rejected/30 transition-all duration-150 flex-shrink-0 ml-3"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Section 4: Danger Zone (teacher only) ── */}
      {showDangerZone && (
        <section
          className="glass-card p-7 rounded-[16px]"
          style={{
            borderLeft: '3px solid hsl(var(--status-rejected) / 0.4)',
            animation: 'slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both',
            animationDelay: '240ms',
          }}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--status-rejected-bg))] flex items-center justify-center flex-shrink-0 mt-0.5">
              <LogOut className="w-5 h-5 text-status-rejected" />
            </div>
            <div className="flex-1">
              <h2 className="text-[17px] font-semibold text-text-primary mb-1.5">Account</h2>
              <p className="text-[13px] text-text-secondary mb-4">
                This will sign you out of every browser and device.
              </p>
              <button
                onClick={handleGlobalSignOut}
                className="h-10 px-5 rounded-[12px] border border-status-rejected/30 text-[13px] font-medium text-status-rejected bg-transparent hover:bg-[hsl(0_70%_50%/0.08)] active:scale-[0.97] transition-all duration-150"
              >
                Sign Out of All Devices
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
