import { useEffect, useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Download, Loader2, CheckCircle, Clock, FolderOpen,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
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
    <div className="bg-surface shadow-card rounded-[16px] p-6 mb-3 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3 flex-1">
          <div className="h-5 w-[200px] rounded-sm bg-background-tertiary" />
          <div className="h-3.5 w-[150px] rounded-sm bg-background-tertiary" />
          <div className="h-3 w-[120px] rounded-sm bg-background-tertiary" />
        </div>
        <div className="h-10 w-[140px] rounded-[10px] bg-background-tertiary flex-shrink-0" />
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
      window.open(url, '_blank')
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
    <div className="max-w-[800px] mx-auto animate-fade-in">
      {/* Page heading */}
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Downloads</h1>
        <p className="text-[15px] text-text-secondary mt-1">
          {downloads.length === 0 ? 'No documents available yet' : `${downloads.length} document(s) ready`}
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6">
        <div className="inline-flex items-center bg-background-secondary rounded-[10px] p-0.5 gap-0">
          {tabs.map(tab => {
            const count = tab.key === 'new' ? newItems.length
              : tab.key === 'downloaded' ? downloadedItems.length
              : downloads.length
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'h-[30px] px-4 text-[13px] rounded-[8px] transition-all duration-150',
                  activeTab === tab.key
                    ? 'bg-surface shadow-sm text-text-primary font-medium'
                    : 'bg-transparent text-text-secondary',
                )}
              >
                {tab.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : visibleItems.length > 0 ? (
        <div className="space-y-3">
          {visibleItems.map(d => {
            const isNew = d.status === 'new'
            const isDownloading = downloadingId === d.id
            const error = errors[d.id]
            return (
              <div key={d.id} className="bg-surface shadow-card rounded-[16px] p-6">
                <div className="flex items-start justify-between gap-6">
                  {/* Left content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-[17px] font-semibold text-text-primary truncate">
                        {d.subject_name || 'Unknown Subject'}
                      </h3>
                      {isNew && (
                        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-accent text-accent-foreground ml-2 flex-shrink-0">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-text-secondary mb-1">
                      {d.class_name || 'Unknown Class'}
                      {d.term ? <>, {d.term}</> : ''}
                      {d.exam_type ? <> · {d.exam_type}</> : ''}
                    </p>
                    <p className="flex items-center gap-1 text-[12px] text-text-tertiary">
                      {isNew ? (
                        <>
                          <Clock className="w-3 h-3" />
                          Released {relativeTime(d.released_at)}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3 h-3 text-[hsl(var(--status-completed))]" />
                          <span className="text-[hsl(var(--status-completed))]">
                            Downloaded {d.downloaded_at ? relativeTime(d.downloaded_at) : ''}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Right actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDownload(d)}
                      disabled={isDownloading}
                      className={cn(
                        'h-10 px-5 rounded-[10px] text-[14px] font-medium transition-all flex items-center gap-2',
                        'bg-accent text-accent-foreground hover:brightness-95',
                        'disabled:opacity-40 disabled:cursor-not-allowed',
                      )}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      {isDownloading ? 'Downloading…' : 'Download PDF'}
                    </button>
                    {error && (
                      <p className="text-[12px] text-status-rejected">{error}</p>
                    )}
                    {!isNew && (
                      <button
                        onClick={() => handleDownload(d)}
                        className="text-[13px] text-accent bg-transparent border-none cursor-pointer hover:underline"
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
        /* Empty states */
        <div className="bg-surface shadow-card rounded-[16px] py-16 text-center">
          {activeTab === 'new' ? (
            <>
              <CheckCircle className="w-10 h-10 text-[hsl(var(--status-completed))] mx-auto mb-4" />
              <p className="text-[17px] font-medium text-text-primary mb-1">You're all caught up</p>
              <p className="text-[14px] text-text-secondary">No new documents to download.</p>
            </>
          ) : activeTab === 'downloaded' ? (
            <>
              <Download className="w-10 h-10 text-text-tertiary mx-auto mb-4" />
              <p className="text-[17px] font-medium text-text-primary mb-1">No downloads yet</p>
              <p className="text-[14px] text-text-secondary">Documents you download will appear here.</p>
            </>
          ) : (
            <>
              <FolderOpen className="w-10 h-10 text-text-tertiary mx-auto mb-4" />
              <p className="text-[17px] font-medium text-text-primary mb-1">No documents available yet</p>
              <p className="text-[14px] text-text-secondary">
                Your administrator will release exam PDFs here once they've been processed.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
