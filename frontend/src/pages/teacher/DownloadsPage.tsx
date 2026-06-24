import { useEffect, useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Download, Loader2, CheckCircle, Clock, FolderOpen,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { downloadFile } from '@/api/client'
import { downloadsApi } from '@/api/endpoints'
import type { SubjectDownload } from '@/types'
import { cn } from '@/lib/utils'

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return mins + 'm ago'
  if (hours < 24) return hours + 'h ago'
  if (days < 7) return days + 'd ago'
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function SkeletonCard() {
  return (
    <div className="glass-card p-6 mb-3 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3 flex-1">
          <div className="h-5 w-[200px] skeleton rounded-md" />
          <div className="h-3.5 w-[150px] skeleton rounded-md" />
          <div className="h-3 w-[120px] skeleton rounded-md" />
        </div>
        <div className="h-10 w-[140px] skeleton rounded-[10px] flex-shrink-0" />
      </div>
    </div>
  )
}

type TabKey = 'new' | 'downloaded' | 'all'

export default function DownloadsPage() {
  const { user } = useAuth()
  const location = useLocation()

  const [downloads, setDownloads] = useState<SubjectDownload[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('new')
  const [downloadingId, setDownloadingId] = useState<number | null>(null)
  const [errors, setErrors] = useState<Record<number, string>>({})

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'new', label: 'New' },
    { key: 'downloaded', label: 'Downloaded' },
    { key: 'all', label: 'All' },
  ]

  const newItems = useMemo(() => downloads.filter(d => d.status === 'new'), [downloads])
  const downloadedItems = useMemo(() => downloads.filter(d => d.status === 'downloaded'), [downloads])
  const visibleItems = useMemo(() => {
    if (activeTab === 'new') return newItems
    if (activeTab === 'downloaded') return downloadedItems
    return downloads
  }, [activeTab, downloads, newItems, downloadedItems])

  useEffect(() => {
    const fetch = async () => {
      if (!user?.id) return
      setLoading(true)
      try {
        const data = await downloadsApi.list(user.id)
        setDownloads(data)
      } catch {
        setDownloads([])
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [user?.id])

  // When navigating to /downloads, reset new count (handled by sidebar re-fetch)
  useEffect(() => {
    if (location.pathname === '/downloads') {
      setActiveTab('new')
    }
  }, [location.pathname])

  const handleDownload = async (d: SubjectDownload) => {
    setDownloadingId(d.id)
    setErrors(prev => { const n = { ...prev }; delete n[d.id]; return n })
    try {
      if (!d.imposed_pdf_path) throw new Error('No PDF path')
      const url = await downloadsApi.getPdfUrl(d.imposed_pdf_path)
      const filename = `${d.class_name || 'Class'} - ${d.subject_name || 'Exam'} Exam.pdf`
      await downloadFile(url, filename)
      await downloadsApi.markDownloaded(d.id)
      setDownloads(prev =>
        prev.map(item =>
          item.id === d.id
            ? { ...item, status: 'downloaded' as const, downloaded_at: new Date().toISOString() }
            : item,
        ),
      )
    } catch {
      setErrors(prev => ({ ...prev, [d.id]: 'Download failed. Try again.' }))
      setTimeout(() => {
        setErrors(prev => { const n = { ...prev }; delete n[d.id]; return n })
      }, 3000)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div className="max-w-[800px] mx-auto p-6">
      {/* ── Header ── */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Downloads</h1>
        <p className="text-[15px] text-text-secondary mt-1">
          {downloads.length === 0
            ? 'No documents available yet'
            : `${downloads.length} document${downloads.length !== 1 ? 's' : ''} ready for download`}
        </p>
      </div>

      {/* ── Segmented Tab Control ── */}
      <div className="mb-8 animate-slide-up">
        <div className="inline-flex items-center bg-background-secondary/70 backdrop-blur-sm rounded-[14px] p-1 gap-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
          {tabs.map(tab => {
            const count = tab.key === 'new' ? newItems.length
              : tab.key === 'downloaded' ? downloadedItems.length
              : downloads.length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'h-[34px] px-5 text-[14px] font-medium rounded-[10px] transition-all duration-200 flex items-center gap-2',
                  activeTab === tab.key
                    ? 'bg-surface text-text-primary shadow-sm'
                    : 'bg-transparent text-text-secondary hover:text-text-primary',
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold',
                    activeTab === tab.key
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-background-tertiary text-text-tertiary',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Document List ── */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : visibleItems.length > 0 ? (
        <div className="space-y-3">
          {visibleItems.map((d, i) => {
            const isNew = d.status === 'new'
            const isDownloading = downloadingId === d.id
            const error = errors[d.id]
            return (
              <div
                key={d.id}
                className="glass-card p-6 hover:shadow-lg hover:border-accent/20 transition-all duration-200"
                style={{
                  animation: `slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both`,
                  animationDelay: `${i * 45}ms`,
                }}
              >
                <div className="flex items-start justify-between gap-6">
                  {/* Left content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <h3 className="text-[17px] font-semibold text-text-primary truncate">
                        {d.subject_name || 'Unknown Subject'}
                      </h3>
                      {isNew && (
                        <span className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold tracking-wider rounded-full bg-accent text-accent-foreground flex-shrink-0 uppercase">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-text-secondary mb-2">
                      {d.class_name || 'Unknown Class'}
                      {d.term ? <>, {d.term}</> : ''}
                      {d.exam_type ? <> · {d.exam_type}</> : ''}
                    </p>
                    <p className="flex items-center gap-1.5 text-[13px]">
                      {isNew ? (
                        <>
                          <Clock className="w-3.5 h-3.5 text-text-tertiary" />
                          <span className="text-text-tertiary">
                            Released {relativeTime(d.released_at)}
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 text-[hsl(var(--status-completed))]" />
                          <span className="text-[hsl(var(--status-completed))]">
                            Downloaded {d.downloaded_at ? relativeTime(d.downloaded_at) : ''}
                          </span>
                        </>
                      )}
                    </p>
                    {error && (
                      <p className="flex items-center gap-1 text-[12px] text-status-rejected mt-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-rejected" />
                        {error}
                      </p>
                    )}
                  </div>

                  {/* Right actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(d)}
                      disabled={isDownloading}
                      className={cn(
                        'h-11 px-6 rounded-[12px] text-[14px] font-medium transition-all duration-200 flex items-center gap-2',
                        'bg-accent text-accent-foreground hover:brightness-95 active:scale-[0.97]',
                        'disabled:opacity-40 disabled:cursor-not-allowed shadow-sm',
                      )}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {isDownloading ? 'Downloading…' : 'Download PDF'}
                    </button>
                    {!isNew && (
                      <button
                        onClick={() => handleDownload(d)}
                        className="text-[13px] text-accent bg-transparent border-none cursor-pointer hover:underline transition-all"
                      >
                        Download again
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ── Empty States ── */
        <div className="glass-card py-20 text-center animate-scale-in">
          {activeTab === 'new' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--status-completed-bg))] flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-[hsl(var(--status-completed))]" />
              </div>
              <p className="text-[17px] font-medium text-text-primary mb-1">You're all caught up</p>
              <p className="text-[14px] text-text-secondary">No new documents to download.</p>
            </>
          ) : activeTab === 'downloaded' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-background-secondary flex items-center justify-center mx-auto mb-5">
                <Download className="w-8 h-8 text-text-tertiary" />
              </div>
              <p className="text-[17px] font-medium text-text-primary mb-1">No downloads yet</p>
              <p className="text-[14px] text-text-secondary">Documents you download will appear here.</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-background-secondary flex items-center justify-center mx-auto mb-5">
                <FolderOpen className="w-8 h-8 text-text-tertiary" />
              </div>
              <p className="text-[17px] font-medium text-text-primary mb-1">No documents available yet</p>
              <p className="text-[14px] text-text-secondary max-w-sm mx-auto">
                Your administrator will release exam PDFs here once they've been processed.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
