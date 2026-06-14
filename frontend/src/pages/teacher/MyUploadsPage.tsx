import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Eye, Download, Trash2, Search,
  ChevronDown, ChevronLeft, ChevronRight, ArrowUpDown, Loader2, Clock,
  CheckCircle, AlertCircle, RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { subjectsApi } from '@/api/endpoints'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
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

const PAGE_SIZE = 20

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
      window.open(url, '_blank')
    } catch (err) {
      console.error('Download failed:', err)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">My Uploads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage your exam submissions.
          </p>
        </div>
        <Button onClick={() => navigate('/upload')}>
          <FileText className="w-4 h-4 mr-2" /> Upload New
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search uploads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'pending', 'processing', 'completed', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-lg border transition-all capitalize',
                statusFilter === status
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length > 0 ? (
            <><div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-2xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">File</th>
                    <th className="text-left text-2xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Subject</th>
                    <th className="text-left text-2xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Class</th>
                    <th className="text-left text-2xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                    <th className="text-left text-2xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Date</th>
                    <th className="text-left text-2xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Rejection Reason</th>
                    <th className="text-right text-2xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((s, i) => (
                    <tr
                      key={s.id}
                      className="hover:bg-muted/30 transition-colors animate-slide-up"
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            {imageUrls[s.id] ? (
                              <img
                                src={imageUrls[s.id]!}
                                className="w-full h-full object-cover"
                                alt=""
                              />
                            ) : (
                              <FileText className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-[200px]">{s.title}</p>
                            <p className="text-2xs text-muted-foreground">#{String(s.number).padStart(3, '0')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">{s.subjects?.name || '—'}</td>
                      <td className="px-4 py-3 text-sm">{s.classes?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={statusVariant[s.status] || 'pending'}
                          className="capitalize"
                        >
                          {s.status === 'completed' && releasedSubjects[s.subject_id]
                            ? 'Ready'
                            : s.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-[200px]">
                        {s.rejection_reason ? (
                          <span className="text-status-rejected truncate block" title={s.rejection_reason}>
                            <AlertCircle className="w-3 h-3 inline mr-1 -mt-0.5" />
                            {s.rejection_reason}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {releasedSubjects[s.subject_id] && (
                            <button
                              onClick={() => handleDownloadPdf(s.subject_id)}
                              title="Download print-ready PDF"
                              disabled={downloadingId === s.subject_id}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[hsl(var(--status-completed))] hover:bg-[hsl(var(--status-completed-bg))] transition-colors duration-120 disabled:pointer-events-none"
                            >
                              {downloadingId === s.subject_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          {imageUrls[s.id] && (
                            <Button variant="ghost" size="icon-sm" asChild>
                              <a href={imageUrls[s.id]!} target="_blank" rel="noopener noreferrer">
                                <Eye className="w-3.5 h-3.5" />
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDelete(s.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalCount > pageSize && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-xs border border-border hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.ceil(totalCount / pageSize) }, (_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i)}
                      className={cn(
                        'w-8 h-8 rounded-lg text-xs font-medium transition-colors',
                        page === i
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border hover:bg-muted/30',
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() => setPage(p => Math.min(Math.ceil(totalCount / pageSize) - 1, p + 1))}
                    disabled={page >= Math.ceil(totalCount / pageSize) - 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-xs border border-border hover:bg-muted/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>) : (
            <div className="py-16 text-center">
              <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">No uploads found</p>
              <p className="text-xs text-muted-foreground/60 mb-4">
                {search ? 'Try different search terms or filters' : 'Upload your first exam to get started'}
              </p>
              {!search && (
                <Button size="sm" onClick={() => navigate('/upload')}>
                  Upload Exam
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
