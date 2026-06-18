import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Image as ImageIcon, Clock, CheckCircle, Eye, Loader2, Trash2,
  FileText, Download, ScanText, FileDown, Grid3x3, ChevronLeft,
  ChevronRight, AlertCircle, Zap, Check, X, Settings2, SendHorizontal,
} from 'lucide-react'
import { imagesApi, subjectsApi, classesApi } from '../../api/endpoints'
import { supabase } from '../../lib/supabase'
import { cn } from '../../lib/utils'

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-status-pending-bg text-status-pending',
  in_review: 'bg-status-processing-bg text-status-processing',
  completed: 'bg-status-completed-bg text-status-completed',
  rejected: 'bg-status-rejected-bg text-status-rejected',
}

const PIPELINE_STEPS = [
  { key: 'ocr', icon: ScanText, label: 'OCR Transcription' },
  { key: 'docx', icon: FileDown, label: 'DOCX Build' },
  { key: 'impose', icon: Grid3x3, label: 'Imposition' },
]

async function getSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data } = await supabase.storage.from('uploads').createSignedUrl(path, 3600)
  return data?.signedUrl || null
}

const DEFAULT_IMPOSE_PARAMS = {
  cols: 3,
  rows: 2,
  margin_mm: 2.5,
  gap_mm: 2,
  page_margin_cm: 0.25,
  split_mode: 'Auto',
  header_pg2: false,
  scale_a: 100,
  scale_b: 100,
}

function stepState(subject: any, step: string): 'incomplete' | 'in-progress' | 'complete' {
  if (!subject) return 'incomplete'
  const status = subject.status || 'active'

  if (step === 'ocr') {
    if (status === 'completed' || status === 'ocr_complete' || status === 'docx_pending' || status === 'docx_complete' || status === 'impose_pending' || subject.ocr_text) return 'complete'
    if (status === 'ocr_pending') return 'in-progress'
    return 'incomplete'
  }

  if (step === 'docx') {
    if (status === 'completed' || status === 'docx_complete' || status === 'impose_pending' || subject.docx_path) return 'complete'
    if (status === 'docx_pending') return 'in-progress'
    if (status === 'ocr_complete' || status === 'ocr_pending' || subject.ocr_text) return 'incomplete'
    return 'incomplete'
  }

  if (step === 'impose') {
    if (status === 'completed' || subject.imposed_pdf_path) return 'complete'
    if (status === 'impose_pending') return 'in-progress'
    if (subject.docx_path) return 'incomplete'
    return 'incomplete'
  }

  return 'incomplete'
}

const stepIcon = (state: 'incomplete' | 'in-progress' | 'complete') => {
  if (state === 'complete') return CheckCircle
  if (state === 'in-progress') return Loader2
  return Clock
}

const stepBg = (state: string) => {
  if (state === 'complete') return 'bg-status-completed-bg'
  if (state === 'in-progress') return 'bg-status-processing-bg'
  return 'bg-background-secondary'
}

const stepColor = (state: string) => {
  if (state === 'complete') return 'text-status-completed'
  if (state === 'in-progress') return 'text-status-processing'
  return 'text-text-tertiary'
}

export default function AdminSubjectView() {
  const { subjectId } = useParams()
  const navigate = useNavigate()
  const [images, setImages] = useState<any[]>([])
  const [subject, setSubject] = useState<any>(null)
  const [className, setClassName] = useState('')
  const [loading, setLoading] = useState(true)
  const [imageUrls, setImageUrls] = useState<Record<number, string | null>>({})
  const [docxDownloadUrl, setDocxDownloadUrl] = useState<string | null>(null)
  const [imposedDownloadUrl, setImposedDownloadUrl] = useState<string | null>(null)
  const [docxPreviews, setDocxPreviews] = useState<string[]>([])
  const [imposePreviews, setImposePreviews] = useState<string[]>([])
  const [ocrText, setOcrText] = useState('')
  const [ocrSaved, setOcrSaved] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [showImposeSettings, setShowImposeSettings] = useState(false)
  const [imposeParams, setImposeParams] = useState(DEFAULT_IMPOSE_PARAMS)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [deletingImageId, setDeletingImageId] = useState<number | null>(null)
  const [ocrError, setOcrError] = useState('')
  const [docxError, setDocxError] = useState('')
  const [imposeError, setImposeError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }, [])

  const fetchData = useCallback(async () => {
    if (!subjectId) return
    setLoading(true)
    try {
      const [imgRes, subjRes, clsRes, ocrRes] = await Promise.all([
        imagesApi.bySubject(Number(subjectId)),
        subjectsApi.list(),
        classesApi.list(),
        imagesApi.getOcrText(Number(subjectId)),
      ])
      setImages(imgRes.data || [])
      const subj = (subjRes.data || []).find((x: any) => x.id === Number(subjectId))
      setSubject(subj)
      if (subj) {
        const cls = (clsRes.data || []).find((x: any) => x.id === subj.class_id)
        if (cls) setClassName(cls.name)
      }
      setOcrText(ocrRes.data?.ocr_text || '')
      setOcrSaved(false)

      const urls: Record<number, string | null> = {}
      await Promise.all((imgRes.data || []).map(async (img: any) => {
        if (img.file_path) urls[img.id] = await getSignedUrl(img.file_path)
      }))
      setImageUrls(urls)

      if (subj?.docx_path) setDocxDownloadUrl(await getSignedUrl(subj.docx_path))
      if (subj?.imposed_pdf_path) setImposedDownloadUrl(await getSignedUrl(subj.imposed_pdf_path))

      if (subj?.docx_preview_paths?.length) {
        const signed = await Promise.all(
          subj.docx_preview_paths.map((p: string) => getSignedUrl(p))
        )
        setDocxPreviews(signed.filter(Boolean) as string[])
      }
      if (subj?.impose_preview_paths?.length) {
        const signed = await Promise.all(
          subj.impose_preview_paths.map((p: string) => getSignedUrl(p))
        )
        setImposePreviews(signed.filter(Boolean) as string[])
      }
    } catch {
      showFeedback('error', 'Failed to load subject data')
    } finally {
      setLoading(false)
    }
  }, [subjectId, showFeedback])

  useEffect(() => { fetchData() }, [fetchData])

  const handleOcr = async () => {
    if (!subjectId) return
    setActionLoading('ocr')
    setOcrError('')
    try {
      const res = await imagesApi.ocr(Number(subjectId))
      showFeedback('success', res.data.message)
      setOcrText(res.data.ocr_text || '')
      setTimeout(fetchData, 2000)
    } catch (e: any) {
      setOcrError(e?.message || 'OCR failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleSaveOcrText = async () => {
    if (!subjectId) return
    try {
      await imagesApi.updateOcrText(Number(subjectId), ocrText)
      setOcrSaved(true)
      showFeedback('success', 'OCR text saved')
    } catch (e: any) {
      showFeedback('error', e?.message || 'Save failed')
    }
  }

  const handleBuildDocx = async () => {
    if (!subjectId) return
    setActionLoading('docx')
    setDocxError('')
    try {
      const res = await imagesApi.buildDocx(Number(subjectId))
      showFeedback('success', res.data.message)
      if (res.data.previews?.length) setDocxPreviews(res.data.previews.map((b: string) => `data:image/png;base64,${b}`))
      setTimeout(fetchData, 1000)
    } catch (e: any) {
      setDocxError(e?.message || 'Build failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDocxDownload = async () => {
    if (!subjectId) return
    try {
      await imagesApi.downloadDocx(Number(subjectId))
    } catch {
      showFeedback('error', 'Failed to download DOCX')
    }
  }

  const handleImpose = async () => {
    if (!subjectId) return
    setActionLoading('impose')
    setImposeError('')
    try {
      const res = await imagesApi.impose(Number(subjectId), imposeParams)
      showFeedback('success', res.data.message)
      if (res.data.previews?.length) setImposePreviews(res.data.previews.map((b: string) => `data:image/png;base64,${b}`))
      setTimeout(fetchData, 1000)
    } catch (e: any) {
      setImposeError(e?.message || 'Impose failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRelease = async () => {
    if (!subjectId) return
    setActionLoading('release')
    try {
      await subjectsApi.release(Number(subjectId))
      setSubject((prev: any) => ({ ...prev, released: true, released_at: new Date().toISOString() }))
      showFeedback('success', 'Released to teachers')
    } catch (e: any) {
      showFeedback('error', e?.message || 'Release failed')
    } finally {
      setActionLoading(null)
    }
  }

  const handleImposedDownload = async () => {
    if (!subjectId) return
    try {
      await imagesApi.downloadImposed(Number(subjectId))
    } catch {
      showFeedback('error', 'Failed to download imposed PDF')
    }
  }

  const handleDeleteImage = async (id: number) => {
    try {
      await imagesApi.delete(id)
      setImages(prev => prev.filter(i => i.id !== id))
      setDeletingImageId(null)
    } catch {
      showFeedback('error', 'Failed to delete image')
      setDeletingImageId(null)
    }
  }

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !subjectId || !subject) return
    setUploading(true)
    try {
      await imagesApi.upload(Number(subjectId), subject.class_id, file.name, file)
      await fetchData()
    } catch {
      showFeedback('error', 'Failed to upload image')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleToggleStatus = async () => {
    if (!subjectId || !subject) return
    const newStatus = subject.status === 'completed' ? 'active' : 'completed'
    try {
      await subjectsApi.updateStatus(Number(subjectId), newStatus)
      setSubject((prev: any) => ({ ...prev, status: newStatus }))
      showFeedback('success', `Subject marked as ${newStatus}`)
    } catch (e: any) {
      showFeedback('error', e?.message || 'Failed to update status')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-6">
      {feedback && (
        <div className={cn(
          'flex items-center gap-2.5 px-4 py-3 rounded-[12px] border text-sm animate-fade-in',
          feedback.type === 'success'
            ? 'bg-status-completed-bg border-status-completed/20 text-status-completed'
            : 'bg-status-rejected-bg border-status-rejected/20 text-status-rejected',
        )}>
          {feedback.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {feedback.message}
        </div>
      )}

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedImage(null)}
        >
          <img src={selectedImage} alt="Preview" className="max-w-full max-h-full rounded-[16px] shadow-2xl" />
        </div>
      )}

      {/* Header */}
      <div className="bg-surface rounded-[16px] shadow-card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 flex items-center justify-center rounded-sm text-text-secondary hover:bg-background-secondary transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <nav className="flex items-center gap-1.5 text-xs text-text-tertiary mb-1">
                <Link to="/admin/structure" className="hover:text-primary transition-colors">Classes</Link>
                <ChevronRight className="w-3 h-3" />
                <span>{className || '...'}</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-text-primary font-medium">{subject?.name || 'Subject'}</span>
              </nav>
              <h1 className="text-[22px] font-bold tracking-tight text-text-primary">
                {subject?.name || 'Subject'}
              </h1>
              <p className="text-[13px] text-text-secondary mt-0.5">
                {className} · {images.length} image{images.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {subject?.rejection_reason && (
              <div className="text-xs px-3 py-1.5 rounded-lg bg-status-rejected-bg text-status-rejected border border-status-rejected/20 max-w-[300px] truncate" title={subject.rejection_reason}>
                <AlertCircle className="w-3 h-3 inline mr-1 -mt-0.5" />
                {subject.rejection_reason}
              </div>
            )}
            {subject && (
              <button
                onClick={handleToggleStatus}
                className={cn(
                  'h-9 px-4 rounded-[10px] text-[13px] font-medium transition-all flex items-center gap-1.5',
                  subject.status === 'completed'
                    ? 'bg-status-completed-bg text-status-completed hover:brightness-95'
                    : 'bg-background-tertiary text-text-secondary hover:bg-background-secondary',
                )}
              >
                <CheckCircle className="w-4 h-4" />
                {subject.status === 'completed' ? 'Mark Active' : 'Mark Complete'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline Progress Bar */}
      <div className="bg-surface rounded-[16px] shadow-card p-5">
        <h2 className="text-[15px] font-semibold text-text-primary mb-5">Pipeline Progress</h2>
        <div className="flex items-center gap-0">
          {PIPELINE_STEPS.map((step, idx) => {
            const state = stepState(subject, step.key)
            const Icon = state === 'in-progress' ? Loader2 : stepIcon(state)
            const prevComplete = idx === 0 || stepState(subject, PIPELINE_STEPS[idx - 1].key) === 'complete'
            const isComplete = state === 'complete'
            const isInProgress = state === 'in-progress'
            return (
              <div key={step.key} className="flex-1 flex items-center">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-400',
                    stepBg(state),
                    isInProgress && 'animate-pulse',
                  )}>
                    <Icon className={cn('w-5 h-5', stepColor(state), isInProgress && 'animate-spin')} />
                  </div>
                  <div>
                    <p className={cn(
                      'text-[13px] font-medium transition-colors duration-400',
                      isComplete ? 'text-status-completed' : isInProgress ? 'text-accent' : 'text-text-tertiary',
                    )}>
                      {step.label}
                    </p>
                    <p className={cn('text-[11px]', stepColor(state))}>
                      {isComplete ? 'Complete' : isInProgress ? 'In progress' : 'Pending'}
                    </p>
                  </div>
                </div>
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-1 mx-4 rounded-full transition-all duration-400',
                    isComplete ? 'bg-status-completed' : prevComplete ? 'bg-status-completed' : 'bg-border',
                  )} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Actions + OCR */}
        <div className="lg:col-span-2 space-y-6">
          {/* OCR Action */}
          <div className="bg-surface rounded-[16px] shadow-card p-5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <ScanText className="w-4 h-4 text-accent" />
                  <span className="text-[14px] font-medium text-text-primary">OCR Transcription</span>
                  {subject?.ocr_text && (
                    <span className="text-[11px] text-status-completed bg-status-completed-bg rounded-full px-2 py-0.5">Done</span>
                  )}
                </div>
                <p className="text-[12px] text-text-tertiary mt-0.5">Transcribe handwritten scripts with Gemini 2.5 Flash</p>
              </div>
              <button
                onClick={handleOcr}
                disabled={actionLoading === 'ocr' || images.length === 0}
                className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 flex-shrink-0"
              >
                {actionLoading === 'ocr' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {actionLoading === 'ocr' ? 'Processing...' : 'Run OCR'}
              </button>
            </div>
            <textarea
              value={ocrText}
              onChange={e => { setOcrText(e.target.value); setOcrSaved(false) }}
              className="w-full h-36 px-3.5 py-2.5 text-[13px] font-mono bg-background-secondary border border-border rounded-[12px] text-text-primary placeholder:text-text-tertiary outline-none transition-shadow focus:border-accent focus:shadow-[0_0_0_3px_hsl(var(--accent)/0.1)] resize-y"
              placeholder="OCR text will appear here after processing..."
            />
            <div className="flex items-center justify-end mt-2 gap-2">
              {ocrError && <p className="text-[12px] text-status-rejected flex-1">{ocrError}</p>}
              <button
                onClick={handleSaveOcrText}
                disabled={ocrSaved || !ocrText.trim()}
                className="h-8 px-3 rounded-[8px] text-[12px] font-medium bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                {ocrSaved ? <Check className="w-3 h-3" /> : null}
                {ocrSaved ? 'Saved' : 'Save OCR Text'}
              </button>
            </div>
          </div>

          {/* DOCX Action */}
          <div className="bg-surface rounded-[16px] shadow-card p-5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-accent" />
                  <span className="text-[14px] font-medium text-text-primary">Build DOCX</span>
                  {docxDownloadUrl && <span className="text-[11px] text-status-completed bg-status-completed-bg rounded-full px-2 py-0.5">Ready</span>}
                </div>
                <p className="text-[12px] text-text-tertiary mt-0.5">Formatted Word document with Times New Roman and proper layout</p>
              </div>
              <div className="flex items-center gap-2">
                {docxDownloadUrl && (
                  <button
                    onClick={handleDocxDownload}
                    className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-accent/10 text-accent hover:brightness-95 transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                )}
                <button
                  onClick={handleBuildDocx}
                  disabled={actionLoading === 'docx' || !subject?.ocr_text}
                  className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  {actionLoading === 'docx' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {actionLoading === 'docx' ? 'Building...' : 'Build'}
                </button>
              </div>
            </div>
            {docxError && <p className="text-[12px] text-status-rejected mb-2">{docxError}</p>}
            {docxPreviews.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[12px] font-medium text-text-secondary">Preview</p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {docxPreviews.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`DOCX preview ${i + 1}`}
                      className="h-48 rounded-[8px] border border-border shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(url, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Impose Action */}
          <div className="bg-surface rounded-[16px] shadow-card p-5">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Grid3x3 className="w-4 h-4 text-accent" />
                  <span className="text-[14px] font-medium text-text-primary">Imposition</span>
                  {imposedDownloadUrl && <span className="text-[11px] text-status-completed bg-status-completed-bg rounded-full px-2 py-0.5">Ready</span>}
                </div>
                <p className="text-[12px] text-text-tertiary mt-0.5">Grid layout with cut marks for booklet printing</p>
              </div>
              <div className="flex items-center gap-2">
                {imposedDownloadUrl && (
                  <button
                    onClick={handleImposedDownload}
                    className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-status-completed-bg text-status-completed hover:brightness-95 transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> Download
                  </button>
                )}
                <button
                  onClick={() => setShowImposeSettings(v => !v)}
                  className={cn(
                    'h-9 px-3 rounded-[10px] text-[13px] font-medium transition-all flex items-center gap-1.5',
                    showImposeSettings ? 'bg-accent/10 text-accent' : 'bg-background-secondary text-text-secondary hover:bg-background-tertiary',
                  )}
                  title="Impose settings"
                >
                  <Settings2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleImpose}
                  disabled={actionLoading === 'impose' || !subject?.docx_path}
                  className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  {actionLoading === 'impose' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {actionLoading === 'impose' ? 'Imposing...' : 'Run'}
                </button>
              </div>
            </div>

            {/* Impose Settings */}
            {showImposeSettings && (
              <div className="mt-3 p-4 rounded-[12px] bg-background-secondary border border-border space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Columns</label>
                    <input type="number" min={1} max={6} value={imposeParams.cols}
                      onChange={e => setImposeParams(p => ({ ...p, cols: Number(e.target.value) }))}
                      className="w-full h-8 px-2.5 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Rows</label>
                    <input type="number" min={1} max={6} value={imposeParams.rows}
                      onChange={e => setImposeParams(p => ({ ...p, rows: Number(e.target.value) }))}
                      className="w-full h-8 px-2.5 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Margin (mm)</label>
                    <input type="number" min={0} max={20} step={0.5} value={imposeParams.margin_mm}
                      onChange={e => setImposeParams(p => ({ ...p, margin_mm: Number(e.target.value) }))}
                      className="w-full h-8 px-2.5 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Gap (mm)</label>
                    <input type="number" min={0} max={10} step={0.5} value={imposeParams.gap_mm}
                      onChange={e => setImposeParams(p => ({ ...p, gap_mm: Number(e.target.value) }))}
                      className="w-full h-8 px-2.5 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Page Margin (cm)</label>
                    <input type="number" min={0} max={3} step={0.1} value={imposeParams.page_margin_cm}
                      onChange={e => setImposeParams(p => ({ ...p, page_margin_cm: Number(e.target.value) }))}
                      className="w-full h-8 px-2.5 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary outline-none focus:border-accent" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Split Mode</label>
                    <select value={imposeParams.split_mode}
                      onChange={e => setImposeParams(p => ({ ...p, split_mode: e.target.value }))}
                      className="w-full h-8 px-2.5 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary outline-none focus:border-accent">
                      <option value="Auto">Auto</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={imposeParams.header_pg2}
                        onChange={e => setImposeParams(p => ({ ...p, header_pg2: e.target.checked }))}
                        className="w-4 h-4 rounded accent-accent" />
                      <span className="text-[12px] text-text-secondary">Header pg2</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Section A Scale</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min={50} max={150} step={5} value={imposeParams.scale_a}
                        onChange={e => setImposeParams(p => ({ ...p, scale_a: Number(e.target.value) }))}
                        className="flex-1 h-8 px-2.5 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary outline-none focus:border-accent" />
                      <span className="text-[12px] text-text-secondary w-4">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-text-secondary mb-1">Section B Scale</label>
                    <div className="flex items-center gap-1">
                      <input type="number" min={50} max={150} step={5} value={imposeParams.scale_b}
                        onChange={e => setImposeParams(p => ({ ...p, scale_b: Number(e.target.value) }))}
                        className="flex-1 h-8 px-2.5 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary outline-none focus:border-accent" />
                      <span className="text-[12px] text-text-secondary w-4">%</span>
                    </div>
                  </div>
                </div>
                <p className="text-[12px] text-text-tertiary italic">100% uses automatic fit. Higher values enlarge text, lower values compact it.</p>
              </div>
            )}

            {imposeError && <p className="text-[12px] text-status-rejected mt-2">{imposeError}</p>}

            {imposePreviews.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[12px] font-medium text-text-secondary">Preview</p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {imposePreviews.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Impose preview ${i + 1}`}
                      className="h-48 rounded-[8px] border border-border shadow-sm cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(url, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Release to Teachers */}
          {subject?.status === 'completed' && subject?.imposed_pdf_path && (
            <div className="bg-surface rounded-[16px] shadow-card p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <SendHorizontal className="w-4 h-4 text-accent" />
                    <span className="text-[14px] font-medium text-text-primary">Release to Teachers</span>
                    {subject?.released && (
                      <span className="text-[11px] text-status-completed bg-status-completed-bg rounded-full px-2 py-0.5">Released</span>
                    )}
                  </div>
                  <p className="text-[12px] text-text-tertiary mt-0.5">
                    {subject?.released
                      ? `Released ${subject?.released_at ? new Date(subject.released_at).toLocaleDateString() : ''}`
                      : 'Teachers will see this exam as available for download'}
                  </p>
                </div>
                {!subject?.released && (
                  <button
                    onClick={handleRelease}
                    disabled={actionLoading === 'release'}
                    className="h-9 px-4 rounded-[10px] text-[13px] font-medium bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                  >
                    {actionLoading === 'release' ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                    {actionLoading === 'release' ? 'Releasing...' : 'Release'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right — Image Gallery */}
        <div className="space-y-4">
          <div className="bg-surface rounded-[16px] shadow-card p-5">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-[15px] font-semibold text-text-primary">
                Uploaded Scripts
                <span className="text-[13px] text-text-tertiary font-normal ml-2">({images.length})</span>
              </h2>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.tiff"
                className="hidden"
                onChange={handleUploadImage}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-8 px-3 rounded-[8px] bg-accent text-accent-foreground text-[12px] font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                {uploading ? 'Uploading...' : 'Add Image'}
              </button>
            </div>
            {images.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {images.map((img: any) => (
                  <div key={img.id} className="group relative rounded-[10px] overflow-hidden bg-background-secondary border border-border">
                    {deletingImageId === img.id ? (
                      <div className="w-full aspect-[3/4] flex flex-col items-center justify-center gap-2 p-3 bg-background-secondary">
                        <p className="text-[12px] text-text-primary text-center">Delete this image?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteImage(img.id)}
                            className="text-[12px] text-status-rejected underline bg-transparent border-none p-0 cursor-pointer"
                          >
                            Yes, delete
                          </button>
                          <button
                            onClick={() => setDeletingImageId(null)}
                            className="text-[12px] text-text-secondary bg-transparent border-none p-0 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : imageUrls[img.id] ? (
                      <img
                        src={imageUrls[img.id]!}
                        alt={img.title}
                        className="w-full aspect-[3/4] object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                        onClick={() => setSelectedImage(imageUrls[img.id]!)}
                      />
                    ) : (
                      <div className="w-full aspect-[3/4] flex items-center justify-center">
                        <ImageIcon className="w-8 h-8 text-text-tertiary" />
                      </div>
                    )}
                    {deletingImageId !== img.id && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <div className="absolute bottom-0 left-0 right-0 p-2 pointer-events-auto">
                          <p className="text-[11px] text-white font-medium truncate">{img.title}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                              STATUS_STYLES[img.status] || 'bg-white/20 text-white',
                            )}>
                              {img.status}
                            </span>
                            {img.rejection_reason && (
                              <span className="text-[10px] text-status-rejected truncate ml-1 max-w-[80px]" title={img.rejection_reason}>
                                <AlertCircle className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
                                {img.rejection_reason}
                              </span>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeletingImageId(img.id) }}
                              className="w-6 h-6 flex items-center justify-center rounded-sm bg-white/20 text-white hover:bg-status-rejected/80 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ImageIcon className="w-8 h-8 text-text-tertiary mb-2" />
                <p className="text-[13px] text-text-secondary">No scripts yet</p>
                <p className="text-[11px] text-text-tertiary mt-1">Upload images to get started</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
