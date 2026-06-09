import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload, File, X, Check, Loader2, AlertCircle, Image,
  ChevronDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
  'Accounting', 'Commerce',
]

const TERM_OPTIONS = ['First Term', 'Second Term', 'Third Term']
const EXAM_TYPE_OPTIONS = ['Midterm', 'Final Exam', 'Quiz', 'Test', 'Assignment', 'Project']
const SESSION = '2025/2026'

export default function UploadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const [form, setForm] = useState({
    className: '',
    subjectName: '',
    examType: '',
    term: '',
  })

  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState('')

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(e.type === 'dragover')
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const dropped = Array.from(e.dataTransfer.files)
    const images = dropped.filter(f => f.type.startsWith('image/'))
    setFiles(prev => [...prev, ...images])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (!form.className || !form.subjectName || files.length === 0) {
      setError('Please fill in class, subject, and select files')
      return
    }

    setUploading(true)
    setProgress(0)
    setError('')

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('Not authenticated')

      // Find or create class
      let classId: number
      const { data: existingClass } = await supabase
        .from('classes').select('id').eq('name', form.className).single()
      if (existingClass) {
        classId = existingClass.id
      } else {
        const { data: newClass } = await supabase
          .from('classes').insert({ name: form.className, school_id: 1 }).select().single()
        classId = newClass!.id
      }

      // Find or create subject
      let subjectId: number
      const { data: existingSubject } = await supabase
        .from('subjects').select('id').eq('name', form.subjectName).single()
      if (existingSubject) {
        subjectId = existingSubject.id
      } else {
        const { data: newSubject } = await supabase
          .from('subjects').insert({ name: form.subjectName, class_id: classId }).select().single()
        subjectId = newSubject!.id
      }

      // Upload each file
      let uploaded = 0
      for (const file of files) {
        const ext = file.name.split('.').pop() || 'jpg'
        const path = `uploads/class_${classId}/subject_${subjectId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        
        const { error: storageError } = await supabase.storage
          .from('uploads')
          .upload(path, file)

        if (storageError) throw storageError

        // Get next image number
        const { data: last } = await supabase
          .from('images')
          .select('number')
          .eq('subject_id', subjectId)
          .order('number', { ascending: false })
          .limit(1)
        const num = (last?.length ? last[0].number : 0) + 1

        await supabase.from('images').insert({
          title: `${form.subjectName} - ${form.examType} - ${form.term}`,
          number: num,
          status: 'pending',
          file_path: path,
          class_id: classId,
          subject_id: subjectId,
          uploaded_by: authUser.id,
        })

        uploaded++
        setProgress(Math.round((uploaded / files.length) * 100))
      }

      setCompleted(true)
      setTimeout(() => navigate('/uploads'), 2000)
    } catch (err: any) {
      setError(err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const totalSize = files.reduce((acc, f) => acc + f.size, 0)
  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (completed) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Card className="w-full max-w-sm text-center animate-scale-in">
          <CardContent className="pt-10 pb-8">
            <div className="w-16 h-16 rounded-full bg-status-completed/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-status-completed" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Upload complete!</h2>
            <p className="text-sm text-muted-foreground">
              {files.length} file{files.length !== 1 ? 's' : ''} uploaded successfully.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Upload Exam</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submit exam materials for processing.
        </p>
      </div>

      {error && (
        <div className="text-sm px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Exam Details</CardTitle>
          <CardDescription>Fill in the exam information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <select
                value={form.className}
                onChange={e => setForm(f => ({ ...f, className: e.target.value }))}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select class...</option>
                {CLASS_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <select
                value={form.subjectName}
                onChange={e => setForm(f => ({ ...f, subjectName: e.target.value }))}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select subject...</option>
                {SUBJECT_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Exam Type</Label>
              <select
                value={form.examType}
                onChange={e => setForm(f => ({ ...f, examType: e.target.value }))}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select type...</option>
                {EXAM_TYPE_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Term</Label>
              <select
                value={form.term}
                onChange={e => setForm(f => ({ ...f, term: e.target.value }))}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="">Select term...</option>
                {TERM_OPTIONS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Session</Label>
            <Input value={SESSION} disabled className="text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* File upload */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Upload Files</CardTitle>
          <CardDescription>
            Drag and drop your exam images here, or click to browse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
              dragOver
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-primary/50 hover:bg-muted/30',
            )}
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className={cn(
              'w-8 h-8 mx-auto mb-3 transition-colors',
              dragOver ? 'text-primary' : 'text-muted-foreground',
            )} />
            <p className="text-sm font-medium">
              {dragOver ? 'Drop files here' : 'Drag files here or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports JPEG, PNG, TIFF
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  {files.length} file{files.length !== 1 ? 's' : ''} ({formatSize(totalSize)})
                </p>
                <Button variant="ghost" size="sm" onClick={() => setFiles([])} className="text-xs text-muted-foreground">
                  Clear all
                </Button>
              </div>
              {files.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50 animate-slide-up"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Image className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-2xs text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Uploading...</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/')}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          disabled={uploading || !form.className || !form.subjectName || files.length === 0}
          className="min-w-[140px]"
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
          ) : (
            <><Upload className="w-4 h-4 mr-2" /> Upload ({files.length})</>
          )}
        </Button>
      </div>
    </div>
  )
}
