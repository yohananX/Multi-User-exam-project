import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Eye, Download, Trash2, Search, X,
  ChevronLeft, ChevronRight, Loader2, Clock,
  CheckCircle, AlertCircle, RefreshCw, UploadCloud,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { subjectsApi } from '@/api/endpoints'
import { downloadFile } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Submission = any

const statusVariant: Record<string, 'pending' | 'processing' | 'completed' | 'rejected' | 'approved'> = {
  pending: 'pending',
  in_review: 'processing',
  processing: 'processing',
  completed: 'completed',
  rejected: 'rejected',
  approved: 'approved',
}

const statusIcon: Record<string, React.ElementType> = {
  pending: Clock,
  processing: RefreshCw,
  completed: CheckCircle,
  rejected: AlertCircle,
}

const statusColors: Record<string, string> = {
  pending: 'bg-[hsl(var(--status-pending-bg))] text-[hsl(var(--status-pending))] border-[hsl(var(--status-pending)/0.25)]',
  processing: 'bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing))] border-[hsl(var(--status-processing)/0.25)]',
  completed: 'bg-[hsl(var(--status-completed-bg))] text-[hsl(var(--status-completed))] border-[hsl(var(--status-completed)/0.25)]',
  rejected: 'bg-[hsl(var(--status-rejected-bg))] text-[hsl(var(--status-rejected))] border-[hsl(var(--status-rejected)/0.25)]',
}

const PAGE_SIZE = 20

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 animate-pulse">
      <div className="w-10 h-10 rounded-lg skeleton flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-48 skeleton rounded-md" />
        <div className="h-3 w-32 skeleton rounded-md" />
      </div>
      <div className="hidden md:block h-4 w-24 skeleton rounded-md" />
      <div className="hidden md:block h-4 w-24 skeleton rounded-md" />
      <div className="h-6 w-20 skeleton rounded-full" />
      <div className="hidden md:block h-4 w-24 skeleton rounded-md" />
      <div className="flex gap-1">
        <div className="w-8 h-8 skeleton rounded-lg" />
        <div className="w-8 h-8 skeleton rounded-lg" />
      </div>
    </div>
  )
}

export default function MyUploadsPage() {
  const navigate = useNavigate()
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [imageUrls, setImageUrls] = useState<Record<number, string | null>>({})
  const [releasedSubjects, setReleasedSubjects] = useState<Record<number, boolean>>({})
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const pageSize = PAGE_SIZE

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const from = page * pageSize
      const to = from + pageSize - 1

      const { count } = await supabase
        .from('images')
        .select('*', { count: 'exact', head: true })
        .eq('uploaded_by', user.id)
      setTotalCount(count ?? 0)

      const { data } = await supabase
        .from('images')
        .select('*, subjects(name), classes(name)')
        .eq('uploaded_by', user.id)
        .order('created_at', { ascending: false })
        .range(from, to)

      setSubmissions(data || [])

      // Get unique subject IDs from loaded images
      const subjectIds = [...new Set((data || []).map((img: any) => img.subject_id).filter(Boolean))] as number[]
      if (subjectIds.length > 0) {
        try {
          const releasedMap = await subjectsApi.isReleased(subjectIds)
          setReleasedSubjects(releasedMap)
        } catch { /* silent failure */ }
      }

      // Load signed URLs for thumbnails
      ;(data || []).forEach((img: any) => {
        if (img.file_path) {
          supabase.storage
            .from('uploads')
            .createSignedUrl(img.file_path, 3600)
            .then(({ data: urlData }) => {
              if (urlData?.signedUrl) {
                setImageUrls(prev => ({ ...prev, [img.id]: urlData.signedUrl }))
              }
            })
        }
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [page])

  const filtered = submissions.filter(s => {
    const matchesSearch = search === '' ||
      s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.subjects?.name?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleDelete = async (id: number) => {
    const { data: img } = await supabase.from('images').select('file_path').eq('id', id).single()
    if (img?.file_path) await supabase.storage.from('uploads').remove([img.file_path])
    await supabase.from('images').delete().eq('id', id)
    fetchData()
  }

  const handleDownloadPdf = async (subjectId: number) => {
    setDownloadingId(subjectId)
    try {
      const url = await subjectsApi.getImposedPdfUrl(subjectId)
      await downloadFile(url, `Subject_${subjectId}_Exam.pdf`)
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloadingId(null)
    }
  }

  const totalPages = Math.ceil(totalCount / pageSize)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">My Uploads</h1>
          <p className="text-[15px] text-text-secondary mt-1">
            View and manage your exam submissions.
          </p>
        </div>
        <Button
          onClick={() => navigate('/upload')}
          size="lg"
          className="rounded-[14px] h-11 px-5 text-[15px] font-medium bg-accent text-accent-foreground hover:brightness-95 active:scale-[0.98] shadow-sm"
        >
          <UploadCloud className="w-[18px] h-[18px] mr-2" />
          Upload New
        </Button>
      </div>

      {/* ── Filters Bar ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-slide-up">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary pointer-events-none" />
          <input
            type="text"
            placeholder="Search uploads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-10 rounded-[14px] border border-border bg-surface text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-all duration-200 focus:border-accent focus:shadow-[0_0_0_3px_hsla(211,100%,50%,0.12)]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <X className="w-[16px] h-[16px]" />
            </button>
          )}
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {['all', 'pending', 'processing', 'completed', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'h-9 px-4 rounded-full text-[13px] font-medium transition-all duration-200',
                statusFilter === status
                  ? 'bg-accent text-accent-foreground shadow-sm'
                  : 'bg-transparent text-text-secondary border border-border hover:border-text-tertiary hover:text-text-primary',
              )}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="glass-card overflow-hidden">
        {loading ? (
          /* ── Loading State ── */
          <div className="divide-y divide-border/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <>
            {/* ── Card List ── */}
            <div className="divide-y divide-border/40">
              {filtered.map((s, i) => {
                const StatusIcon = statusIcon[s.status]
                const ready = s.status === 'completed' && releasedSubjects[s.subject_id]
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center gap-4 px-5 py-4 transition-all duration-200',
                      'hover:bg-[hsl(var(--background-secondary)/0.5)]',
                    )}
                    style={{
                      animation: `slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both`,
                      animationDelay: `${i * 30}ms`,
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg bg-accent-subtle flex items-center justify-center flex-shrink-0 overflow-hidden ring-1 ring-border/30">
                      {imageUrls[s.id] ? (
                        <img
                          src={imageUrls[s.id]!}
                          className="w-full h-full object-cover"
                          alt=""
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-accent" />
                      )}
                    </div>

                    {/* Filename + Number */}
                    <div className="min-w-0 flex-1 hidden sm:block">
                      <p className="text-[15px] font-medium text-text-primary truncate max-w-[260px]">
                        {s.title}
                      </p>
                      <p className="text-[12px] text-text-tertiary">
                        #{String(s.number).padStart(3, '0')}
                      </p>
                    </div>

                    {/* Subject - desktop */}
                    <div className="hidden md:block min-w-[100px]">
                      <p className="text-[14px] text-text-secondary truncate">{s.subjects?.name || '—'}</p>
                    </div>

                    {/* Class - desktop */}
                    <div className="hidden lg:block min-w-[80px]">
                      <p className="text-[14px] text-text-secondary truncate">{s.classes?.name || '—'}</p>
                    </div>

                    {/* Status badge */}
                    <div className="flex-shrink-0">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium border',
                        statusColors[ready ? 'completed' : s.status] || 'bg-background-secondary text-text-secondary border-border',
                      )}>
                        {StatusIcon && <StatusIcon className="w-3 h-3" />}
                        {ready ? 'Ready' : s.status}
                      </span>
                    </div>

                    {/* Date - desktop */}
                    <div className="hidden md:block min-w-[80px] flex-shrink-0">
                      <p className="text-[13px] text-text-tertiary whitespace-nowrap">
                        {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>

                    {/* Rejection reason - desktop */}
                    {s.rejection_reason && (
                      <div className="hidden lg:block min-w-[120px] max-w-[160px] flex-shrink-0">
                        <p className="text-[12px] text-status-rejected truncate flex items-center gap-1" title={s.rejection_reason}>
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{s.rejection_reason}</span>
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                      {releasedSubjects[s.subject_id] && (
                        <button
                          onClick={() => handleDownloadPdf(s.subject_id)}
                          title="Download print-ready PDF"
                          disabled={downloadingId === s.subject_id}
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-[hsl(var(--status-completed))] hover:bg-[hsl(var(--status-completed-bg))] transition-all duration-150 disabled:pointer-events-none active:scale-90"
                        >
                          {downloadingId === s.subject_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-[18px] h-[18px]" />
                          )}
                        </button>
                      )}
                      {imageUrls[s.id] && (
                        <a
                          href={imageUrls[s.id]!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:bg-background-secondary transition-all duration-150 active:scale-90"
                        >
                          <Eye className="w-[18px] h-[18px]" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-text-tertiary hover:text-status-rejected hover:bg-[hsl(var(--status-rejected-bg))] transition-all duration-150 active:scale-90"
                      >
                        <Trash2 className="w-[18px] h-[18px]" />
                      </button>
                    </div>

                    {/* Mobile: filename below */}
                    <div className="sm:hidden min-w-0 flex-1">
                      <p className="text-[14px] font-medium text-text-primary truncate max-w-[160px]">
                        {s.title}
                      </p>
                      <p className="text-[11px] text-text-tertiary">
                        #{String(s.number).padStart(3, '0')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Pagination ── */}
            {totalCount > pageSize && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-border/40 bg-background-secondary/30">
                <p className="text-[13px] text-text-tertiary">
                  Showing <span className="font-medium text-text-secondary">{page * pageSize + 1}</span>
                  {' '}–{' '}
                  <span className="font-medium text-text-secondary">{Math.min((page + 1) * pageSize, totalCount)}</span>
                  {' '}of{' '}
                  <span className="font-medium text-text-secondary">{totalCount}</span>
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary border border-border/60 hover:bg-background-secondary hover:border-border disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                  >
                    <ChevronLeft className="w-[18px] h-[18px]" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={cn(
                        'w-9 h-9 rounded-xl text-[13px] font-medium transition-all duration-150',
                        page === i
                          ? 'bg-accent text-accent-foreground shadow-sm'
                          : 'border border-border/60 text-text-secondary hover:bg-background-secondary hover:border-border',
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-text-secondary border border-border/60 hover:bg-background-secondary hover:border-border disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                  >
                    <ChevronRight className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── Empty State ── */
          <div className="py-20 text-center animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-accent-subtle flex items-center justify-center mx-auto mb-5">
              <FileText className="w-8 h-8 text-accent" />
            </div>
            <p className="text-[17px] font-medium text-text-primary mb-1">No uploads found</p>
            <p className="text-[14px] text-text-secondary max-w-sm mx-auto mb-6">
              {search
                ? 'Try different search terms or filters to find what you\'re looking for.'
                : 'Upload your first exam to get started.'}
            </p>
            {!search && (
              <Button
                size="lg"
                onClick={() => navigate('/upload')}
                className="rounded-[14px] h-11 px-6 text-[15px] font-medium bg-accent text-accent-foreground hover:brightness-95"
              >
                <UploadCloud className="w-[18px] h-[18px] mr-2" />
                Upload Exam
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
