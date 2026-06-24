import { useEffect, useState, useMemo } from 'react'
import { Search, Loader2, CheckCircle, XCircle, Send, Download } from 'lucide-react'
import { subjectsApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'

function SkeletonCard() {
  return (
    <div className="glass-card p-5 mb-3 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-5 h-5 rounded-[6px] bg-background-tertiary skeleton flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-3">
          <div className="h-5 w-[220px] skeleton rounded-md" />
          <div className="h-3.5 w-[160px] skeleton rounded-md" />
        </div>
        <div className="h-6 w-[72px] skeleton rounded-full" />
      </div>
    </div>
  )
}

type TabKey = 'needs_release' | 'all' | 'released'

export default function ReleaseManagement() {
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('needs_release')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [unreleasingId, setUnreleasingId] = useState<number | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'needs_release', label: 'Needs Release' },
    { key: 'all', label: 'All' },
    { key: 'released', label: 'Released' },
  ]

  const needsRelease = useMemo(() => subjects.filter(s => !s.released), [subjects])
  const released = useMemo(() => subjects.filter(s => s.released), [subjects])

  const filteredSubjects = useMemo(() => {
    let list: any[]
    if (activeTab === 'needs_release') list = needsRelease
    else if (activeTab === 'released') list = released
    else list = subjects

    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.classes?.name || '').toLowerCase().includes(q),
    )
  }, [activeTab, subjects, needsRelease, released, search])

  const groupedSubjects = useMemo(() => {
    const groups: Record<string, any[]> = {}
    filteredSubjects.forEach(s => {
      const className = s.classes?.name || 'Uncategorized'
      if (!groups[className]) groups[className] = []
      groups[className].push(s)
    })
    return groups
  }, [filteredSubjects])

  const fetchSubjects = async () => {
    setLoading(true)
    try {
      const data = await subjectsApi.listWithImposed()
      setSubjects(data || [])
    } catch {
      setToast({ message: 'Failed to load subjects', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSubjects() }, [])

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleReleaseAll = async () => {
    const ids = needsRelease.map(s => s.id)
    if (ids.length === 0) return
    setActionLoading(true)
    try {
      await subjectsApi.bulkRelease(ids)
      showToast(`Released ${ids.length} subject${ids.length !== 1 ? 's' : ''}`)
      setSelectedIds(new Set())
      await fetchSubjects()
    } catch {
      showToast('Failed to release subjects', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkRelease = async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setActionLoading(true)
    try {
      await subjectsApi.bulkRelease(ids)
      showToast(`Released ${ids.length} subject${ids.length !== 1 ? 's' : ''}`)
      setSelectedIds(new Set())
      await fetchSubjects()
    } catch {
      showToast('Failed to release subjects', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnrelease = async (id: number) => {
    setUnreleasingId(id)
    try {
      await subjectsApi.unrelease(id)
      showToast('Subject unreleased')
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      await fetchSubjects()
    } catch {
      showToast('Failed to unrelease subject', 'error')
    } finally {
      setUnreleasingId(null)
    }
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(filteredSubjects.map(s => s.id)))
  }

  const deselectAll = () => {
    setSelectedIds(new Set())
  }

  const allFilteredSelected = filteredSubjects.length > 0 && filteredSubjects.every(s => selectedIds.has(s.id))

  return (
    <div className="max-w-[1000px] mx-auto p-6">
      {/* ── Toast Notification ── */}
      {toast && (
        <div
          className={cn(
            'fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl backdrop-blur-2xl animate-slide-down',
            toast.type === 'success'
              ? 'bg-[hsl(var(--status-completed-bg))] border border-[hsl(var(--status-completed)/0.3)]'
              : 'bg-[hsl(var(--status-rejected-bg))] border border-[hsl(var(--status-rejected)/0.3)]',
          )}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-[hsl(var(--status-completed))]" />
            ) : (
              <XCircle className="w-4 h-4 text-status-rejected" />
            )}
            <span
              className={cn(
                'text-[14px] font-medium',
                toast.type === 'success' ? 'text-[hsl(var(--status-completed))]' : 'text-status-rejected',
              )}
            >
              {toast.message}
            </span>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Release Management</h1>
        <p className="text-[15px] text-text-secondary mt-1">
          {subjects.length === 0
            ? 'No subjects with imposed PDFs found'
            : `${needsRelease.length} need${needsRelease.length !== 1 ? '' : 's'} release · ${released.length} released`}
        </p>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-6 animate-slide-up">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search subjects or classes…"
          className="w-full h-10 rounded-[12px] bg-background-secondary/70 backdrop-blur-sm border border-border/20 pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all duration-200"
        />
      </div>

      {/* ── Segmented Tab Control ── */}
      <div className="mb-6 animate-slide-up">
        <div className="inline-flex items-center bg-background-secondary/70 backdrop-blur-sm rounded-[14px] p-1 gap-0 shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)]">
          {tabs.map(tab => {
            const count = tab.key === 'needs_release' ? needsRelease.length
              : tab.key === 'released' ? released.length
              : subjects.length
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSelectedIds(new Set()) }}
                className={cn(
                  'h-[34px] px-5 text-[14px] font-medium rounded-[10px] transition-all duration-200 flex items-center gap-2',
                  activeTab === tab.key
                    ? 'bg-surface text-text-primary shadow-sm'
                    : 'bg-transparent text-text-secondary hover:text-text-primary',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold',
                    activeTab === tab.key
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-background-tertiary text-text-tertiary',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Select All / Deselect All ── */}
      {activeTab !== 'released' && filteredSubjects.length > 0 && !loading && (
        <div className="flex items-center gap-3 mb-4 px-1 animate-fade-in">
          <button
            onClick={allFilteredSelected ? deselectAll : selectAll}
            className="text-[13px] font-medium text-accent hover:underline transition-all"
          >
            {allFilteredSelected ? 'Deselect All' : 'Select All'}
          </button>
          {selectedIds.size > 0 && (
            <span className="text-[13px] text-text-tertiary">{selectedIds.size} selected</span>
          )}
        </div>
      )}

      {/* ── Subject Cards ── */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredSubjects.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedSubjects).map(([className, items]) => (
            <div key={className}>
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-text-tertiary/80 px-1 mb-2">
                {className}
              </h3>
              <div className="space-y-3">
                {items.map((s, i) => {
                  const isSelected = selectedIds.has(s.id)
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        'glass-card p-5 hover:shadow-lg hover:border-accent/20 transition-all duration-200',
                        s.released && 'border-l-[3px] border-l-[hsl(var(--status-completed))]',
                        isSelected && 'border-accent/40 ring-1 ring-accent/20',
                      )}
                      style={{
                        animation: `slideUp 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94) both`,
                        animationDelay: `${i * 45}ms`,
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox (only for non-released tabs) */}
                        {activeTab !== 'released' && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(s.id)}
                            className="w-5 h-5 rounded-[6px] accent-accent cursor-pointer mt-0.5 flex-shrink-0"
                          />
                        )}

                        {/* Middle: Subject info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-1">
                            <h3 className="text-[17px] font-semibold text-text-primary truncate">
                              {s.name}
                            </h3>
                            {s.released ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold tracking-wider rounded-full bg-[hsl(var(--status-completed-bg))] text-[hsl(var(--status-completed))] uppercase flex-shrink-0">
                                RELEASED
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold tracking-wider rounded-full bg-status-pending-bg text-status-pending uppercase flex-shrink-0">
                                PENDING
                              </span>
                            )}
                          </div>
                          <p className="text-[14px] text-text-secondary">
                            {s.classes?.name || 'Unknown Class'}
                            {s.term ? <>, {s.term}</> : ''}
                            {s.exam_type ? <> · {s.exam_type}</> : ''}
                          </p>
                        </div>

                        {/* Right side: Unrelease button for released subjects */}
                        {s.released && (
                          <button
                            onClick={() => handleUnrelease(s.id)}
                            disabled={unreleasingId === s.id}
                            className="text-[13px] text-accent bg-transparent hover:underline disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0 mt-0.5"
                          >
                            {unreleasingId === s.id && (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            )}
                            {unreleasingId === s.id ? 'Unreleasing…' : 'Unrelease'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Empty States ── */
        <div className="glass-card py-20 text-center animate-scale-in">
          {activeTab === 'needs_release' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--status-completed-bg))] flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-[hsl(var(--status-completed))]" />
              </div>
              <p className="text-[17px] font-medium text-text-primary mb-1">
                All subjects have been released! 🎉
              </p>
              <p className="text-[14px] text-text-secondary">
                Switch to the Released tab to view released subjects.
              </p>
            </>
          ) : activeTab === 'released' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-background-secondary flex items-center justify-center mx-auto mb-5">
                <Download className="w-8 h-8 text-text-tertiary" />
              </div>
              <p className="text-[17px] font-medium text-text-primary mb-1">
                No subjects have been released yet
              </p>
              <p className="text-[14px] text-text-secondary">
                Release subjects from the Needs Release tab.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-background-secondary flex items-center justify-center mx-auto mb-5">
                <Search className="w-8 h-8 text-text-tertiary" />
              </div>
              <p className="text-[17px] font-medium text-text-primary mb-1">
                No subjects with imposed PDFs found
              </p>
              <p className="text-[14px] text-text-secondary">
                No subjects have imposed PDFs yet.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Sticky Bottom Action Bar ── */}
      {activeTab !== 'released' && !loading && subjects.length > 0 && (
        <div className="sticky bottom-0 mt-6 bg-surface/80 backdrop-blur-2xl border border-border/20 rounded-2xl p-4 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-medium text-text-secondary">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : `${needsRelease.length} pending`}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReleaseAll}
                disabled={actionLoading || needsRelease.length === 0}
                className="bg-background-tertiary text-text-primary px-6 h-11 rounded-[12px] font-medium hover:bg-background-tertiary/80 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading && selectedIds.size === 0 ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Release All
              </button>
              <button
                onClick={handleBulkRelease}
                disabled={actionLoading || selectedIds.size === 0}
                className="bg-accent text-accent-foreground px-6 h-11 rounded-[12px] font-medium shadow-sm hover:brightness-95 active:scale-[0.97] transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {actionLoading && selectedIds.size > 0 ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Release Selected ({selectedIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
