import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  UploadCloud, Image, X, CheckCircle, AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/tiff']
const MAX_FILE_SIZE = 10 * 1024 * 1024

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function CircularProgress({ pct, size = 20 }: { pct: number; size?: number }) {
  const r = (size - 4) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (circ * pct) / 100
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={pct >= 100 ? 'hsl(var(--status-completed))' : 'hsl(var(--accent))'}
        strokeWidth="2" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={pct >= 100 ? 0 : offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={pct > 0 && pct < 100 ? 'animate-spin' : ''}
        style={pct > 0 && pct < 100 ? { transformOrigin: 'center' } : undefined}
      />
      {pct > 0 && pct < 100 && (
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle"
          fontSize="8" fill="hsl(var(--accent))" fontWeight="600">
          {pct}
        </text>
      )}
    </svg>
  )
}

/* ─── Apple-style custom select ─── */
function SelectWrapper({ label, value, onChange, options, disabled, placeholder }: {
  label: string
  value: string | number
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  options: { id: number; name: string }[]
  disabled?: boolean
  placeholder: string
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium text-text-secondary mb-1.5 tracking-wide">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn(
            'w-full h-11 pl-3.5 pr-10 text-[15px] bg-background-secondary border border-border rounded-xl text-text-primary',
            'outline-none appearance-none cursor-pointer',
            'transition-all duration-fast',
            'focus:border-accent focus:shadow-[0_0_0_3px_hsl(var(--accent)/0.12)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'hover:border-text-tertiary/40',
          )}
        >
          <option value="" disabled className="text-text-tertiary">{placeholder}</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {/* Custom chevron */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-text-tertiary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    </div>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const addMoreRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const [assignments, setAssignments] = useState<any[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(true)
  const [form, setForm] = useState({
    classId: null as number | null,
    subjectId: null as number | null,
  })

  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [fileStatuses, setFileStatuses] = useState<Record<number, number>>({})
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<Set<number>>(new Set())

  useEffect(() => {
    const teacherId = user?.id
    if (!teacherId) return
    setForm({ classId: null, subjectId: null })
    const fetchAssignments = async () => {
      setLoadingAssignments(true)
      try {
        const { data, error } = await supabase
          .from('teacher_assignments')
          .select('*, classes(id, name), subjects(id, name)')
          .eq('teacher_id', teacherId)
        if (error) throw error
        setAssignments(data || [])
      } catch {
        setAssignments([])
      } finally {
        setLoadingAssignments(false)
      }
    }
    fetchAssignments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, location])

  const availableClasses = assignments.reduce<{ id: number; name: string }[]>((acc, a) => {
    if (a.classes && !acc.find(c => c.id === a.classes.id)) {
      acc.push({ id: a.classes.id, name: a.classes.name })
    }
    return acc
  }, [])

  const availableSubjects = form.classId
    ? assignments
        .filter(a => a.class_id === form.classId && a.subjects)
        .map(a => ({ id: a.subjects.id, name: a.subjects.name }))
    : []

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragOver(e.type === 'dragover')
  }, [])

  const addFiles = useCallback((incoming: File[]) => {
    const images = incoming.filter(f => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_FILE_SIZE)
    setFiles(prev => [...prev, ...images])
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragOver(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }

  const removeFile = (index: number) => {
    setRemoving(prev => new Set(prev).add(index))
    setTimeout(() => {
      setFiles(prev => prev.filter((_, i) => i !== index))
      setRemoving(prev => { const n = new Set(prev); n.delete(index); return n })
      setFileStatuses(prev => { const n = { ...prev }; delete n[index]; return n })
    }, 200)
  }

  const clearAll = () => {
    const indices = files.map((_, i) => i)
    setRemoving(new Set(indices))
    setTimeout(() => {
      setFiles([])
      setRemoving(new Set())
      setFileStatuses({})
    }, 200)
  }

  const formComplete = form.classId && form.subjectId
  const totalSize = files.reduce((acc, f) => acc + f.size, 0)

  const handleUpload = async () => {
    if (!formComplete || files.length === 0) return
    setUploading(true)
    setError('')

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('Not authenticated')

      const { data: subj } = await supabase.from('subjects').select('name').eq('id', form.subjectId).single()
      const subjectName = subj?.name || 'Unknown'

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setFileStatuses(prev => ({ ...prev, [i]: 1 }))

        const ext = file.name.split('.').pop() || 'jpg'
        const path = `uploads/class_${form.classId}/subject_${form.subjectId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

        const { error: storageError } = await supabase.storage
          .from('uploads')
          .upload(path, file)
        if (storageError) throw storageError

        const { data: last } = await supabase
          .from('images')
          .select('number')
          .eq('subject_id', form.subjectId)
          .order('number', { ascending: false })
          .limit(1)
        const num = (last?.length ? last[0].number : 0) + 1

        await supabase.from('images').insert({
          title: subjectName,
          number: num,
          status: 'pending',
          file_path: path,
          class_id: form.classId,
          subject_id: form.subjectId,
          uploaded_by: authUser.id,
        })

        setFileStatuses(prev => ({ ...prev, [i]: 100 }))
      }
      setCompleted(true)
    } catch (err: any) {
      setError(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  /* ───── SUCCESS STATE ───── */
  if (completed) {
    return (
      <div className="max-w-[720px] mx-auto pt-16 md:pt-24 animate-fade-in">
        <div className="bg-surface rounded-2xl shadow-card p-10 md:p-14 text-center">
          {/* Animated checkmark */}
          <div className="relative mx-auto mb-6 w-16 h-16">
            <svg width="64" height="64" viewBox="0 0 64 64" className="mx-auto">
              <circle
                cx="32" cy="32" r="30" fill="none" stroke="hsl(var(--status-completed))" strokeWidth="2.5"
                strokeDasharray="188.5" strokeDashoffset="188.5" strokeLinecap="round"
                style={{ animation: 'drawCircle 0.6s var(--ease-decelerate) forwards' }}
              />
              <path
                d="M20 33l8 8 16-16" fill="none" stroke="hsl(var(--status-completed))" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="40" strokeDashoffset="40"
                style={{ animation: 'drawCheck 0.4s 0.5s var(--ease-spring) forwards' }}
              />
            </svg>
          </div>

          <h2 className="text-[22px] font-semibold text-text-primary tracking-tight">Upload complete</h2>
          <p className="text-[15px] text-text-secondary mt-1.5">
            {files.length} script{files.length !== 1 ? 's' : ''} uploaded successfully
          </p>

          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => navigate('/uploads')}
              className="relative h-11 px-6 bg-accent text-accent-foreground text-[14px] font-medium rounded-[12px] hover-scale hover:brightness-110 transition-all duration-fast shadow-sm active:scale-[0.97]"
            >
              View My Uploads
            </button>
            <button
              onClick={() => { setCompleted(false); setFiles([]); setFileStatuses({}) }}
              className="relative h-11 px-6 bg-background-secondary text-text-primary text-[14px] font-medium rounded-[12px] hover:bg-background-tertiary transition-all duration-fast hover-scale active:scale-[0.97]"
            >
              Upload More
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ───── MAIN VIEW ───── */
  return (
    <div className="max-w-[720px] mx-auto animate-fade-in space-y-5">
      {/* Error alert */}
      {error && (
        <div
          className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-status-rejected-bg border-l-4 border-status-rejected text-status-rejected text-sm animate-slide-down"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Card 1: Exam Details ─── */}
      <div
        className={cn(
          'bg-surface rounded-2xl shadow-card p-7 transition-all duration-fast',
          uploading && 'opacity-50 pointer-events-none',
        )}
        style={{ animation: 'fadeIn 0.3s var(--ease-spring) both' }}
      >
        <h2 className="text-[17px] font-semibold text-text-primary mb-6 tracking-tight">Exam Details</h2>

        {loadingAssignments ? (
          <div className="flex items-center gap-3 py-4">
            <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <span className="text-[14px] text-text-secondary">Loading your subjects…</span>
          </div>
        ) : availableClasses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-[15px] text-text-secondary">No classes assigned yet</p>
            <p className="text-[13px] text-text-tertiary mt-1">Talk to your admin to get assigned to classes and subjects</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
            <SelectWrapper
              label="Class"
              value={form.classId ?? ''}
              onChange={e => setForm(f => ({ classId: Number(e.target.value) || null, subjectId: null }))}
              options={availableClasses}
              placeholder="Select class…"
            />
            <SelectWrapper
              label="Subject"
              value={form.subjectId ?? ''}
              onChange={e => setForm(f => ({ ...f, subjectId: Number(e.target.value) || null }))}
              options={form.classId ? availableSubjects : []}
              disabled={!form.classId}
              placeholder="Select subject…"
            />
          </div>
        )}
      </div>

      {/* ─── Card 2: Upload Scripts ─── */}
      <div
        className="bg-surface rounded-2xl shadow-card p-7"
        style={{ animation: 'fadeIn 0.3s var(--ease-spring) both', animationDelay: '80ms' }}
      >
        <h2 className="text-[17px] font-semibold text-text-primary mb-5 tracking-tight">Upload Scripts</h2>

        {/* Hidden file inputs */}
        <input
          ref={fileRef}
          type="file" multiple accept="image/jpeg,image/png,image/tiff"
          onChange={handleFileSelect}
          className="hidden"
        />
        <input
          ref={addMoreRef}
          type="file" multiple accept="image/jpeg,image/png,image/tiff"
          onChange={handleFileSelect}
          className="hidden"
        />

        {files.length === 0 ? (
          /* ─── Empty drop zone ─── */
          <div
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center py-14 px-6 rounded-2xl border-2 border-dashed cursor-pointer select-none',
              'transition-all duration-200',
              dragOver
                ? 'border-accent bg-accent-subtle scale-[1.01]'
                : 'border-border hover:border-accent/40 hover:bg-accent/[0.02]',
            )}
          >
            <div className={cn(
              'transition-all duration-200',
              dragOver ? 'scale-110' : '',
            )}>
              <UploadCloud className={cn(
                'w-10 h-10 transition-colors duration-200',
                dragOver ? 'text-accent' : 'text-text-tertiary',
              )} />
            </div>
            <p className={cn(
              'text-[17px] font-medium mt-4 transition-colors duration-200',
              dragOver ? 'text-accent' : 'text-text-primary',
            )}>
              {dragOver ? 'Release to add files' : 'Drop exam scripts here'}
            </p>
            <p className="text-[14px] text-text-secondary mt-1">or click to browse files</p>
            <p className="text-xs text-text-tertiary mt-2.5">JPEG, PNG, or TIFF · Max 10MB per file</p>
          </div>
        ) : (
          /* ─── Files present ─── */
          <>
            {/* "Add more" bar */}
            <div
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => addMoreRef.current?.click()}
              className={cn(
                'flex items-center gap-2.5 h-12 px-4 rounded-xl border-2 border-dashed cursor-pointer select-none',
                'transition-all duration-200 mb-4',
                dragOver
                  ? 'border-accent bg-accent-subtle'
                  : 'border-border hover:border-accent/40 hover:bg-accent/[0.02]',
              )}
            >
              <UploadCloud className={cn(
                'w-4 h-4 flex-shrink-0 transition-colors duration-200',
                dragOver ? 'text-accent' : 'text-text-secondary',
              )} />
              <span className={cn(
                'text-[13px] transition-colors duration-200',
                dragOver ? 'text-accent' : 'text-text-secondary',
              )}>
                {dragOver ? 'Release to add files' : 'Add more files'}
              </span>
            </div>

            {/* File list */}
            <div className="space-y-0">
              {files.map((file, i) => {
                const status = fileStatuses[i]
                const isDone = status === 100
                const isUploading = status !== undefined && status > 0 && status < 100
                const isRemoving = removing.has(i)
                return (
                  <div key={`${file.name}-${i}`}>
                    <div
                      className={cn(
                        'flex items-center gap-3 h-[52px] transition-all duration-200',
                        isRemoving ? 'opacity-0 scale-95 h-0 overflow-hidden mb-0' : '',
                      )}
                      style={{
                        animation: isRemoving ? undefined : 'fadeIn 0.25s var(--ease-spring) both',
                        animationDelay: isRemoving ? undefined : `${i * 50}ms`,
                      }}
                    >
                      {/* Thumbnail placeholder */}
                      <div className="w-9 h-9 rounded-lg bg-background-secondary flex items-center justify-center flex-shrink-0">
                        <Image className="w-5 h-5 text-text-secondary" />
                      </div>

                      {/* Filename + size */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-text-primary truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-text-tertiary">{formatSize(file.size)}</p>
                      </div>

                      {/* Status indicator */}
                      {uploading ? (
                        isDone ? (
                          <CheckCircle className="w-5 h-5 text-status-completed flex-shrink-0 animate-scale-in" />
                        ) : (
                          <CircularProgress pct={isUploading ? status : 0} />
                        )
                      ) : (
                        <button
                          onClick={() => removeFile(i)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-text-tertiary hover:text-text-primary hover:bg-background-tertiary transition-all duration-fast flex-shrink-0 active:scale-90"
                          aria-label={`Remove ${file.name}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Divider between rows */}
                    {i < files.length - 1 && !isRemoving && (
                      <div className="h-px bg-border ml-12" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Clear all */}
            {files.length >= 2 && (
              <div className="flex justify-end mt-3">
                <button
                  onClick={clearAll}
                  disabled={uploading}
                  className="text-[13px] text-accent font-medium hover:text-accent-hover transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear all
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Sticky Bottom Bar ─── */}
      <div className="sticky bottom-0 pb-4 pt-3 -mx-4 px-4 bg-background/80 backdrop-blur-xl border-t border-border/40">
        <div className="max-w-[720px] mx-auto flex items-center justify-between gap-4">
          {/* File count + size */}
          {files.length > 0 && (
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-[14px] font-medium text-text-primary whitespace-nowrap">
                {files.length} file{files.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[12px] text-text-tertiary hidden sm:inline">
                ({formatSize(totalSize)})
              </span>
            </div>
          )}

          {/* Invisible spacer when no files (keeps button right-aligned) */}
          {files.length === 0 && <div />}

          {/* Upload button */}
          <div className="relative group">
            <button
              onClick={handleUpload}
              disabled={!formComplete || files.length === 0 || uploading}
              className={cn(
                'relative h-11 px-7 text-[14px] font-medium rounded-[12px]',
                'transition-all duration-200 flex items-center gap-2.5',
                formComplete && files.length > 0 && !uploading
                  ? 'bg-accent text-accent-foreground shadow-sm hover:shadow-md hover:scale-[1.02] hover:brightness-110 active:scale-[0.97] cursor-pointer'
                  : 'bg-background-tertiary text-text-disabled cursor-not-allowed',
              )}
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" />
                  <span>Uploading…</span>
                </>
              ) : (
                'Upload'
              )}
            </button>

            {/* Tooltip */}
            {(!formComplete || files.length === 0) && !uploading && (
              <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block animate-scale-in">
                <div className="bg-surface text-text-secondary text-xs px-3 py-1.5 rounded-xl shadow-lg border border-border/60 whitespace-nowrap">
                  {!formComplete ? 'Select a class and subject first' : 'Add at least one file'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
