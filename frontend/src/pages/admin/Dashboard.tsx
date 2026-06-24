import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Users, Clock, CheckCircle, Eye, Loader2,
  ScanText, Grid3x3, Zap, Upload, FolderOpen,
  ChevronRight, FileText, XCircle, Download,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardApi, imagesApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'

const nextStage: Record<string, string> = {
  needs_ocr: 'needs_impose',
  needs_impose: 'completed',
}

const defaultImposeSettings = {
  cols: 3,
  rows: 2,
  margin_mm: 5,
  gap_mm: 3,
  page_margin_cm: 1,
  split_mode: 'Auto',
  header_pg2: false,
}

function useGreeting() {
  return useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])
}

function formatDate() {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return ''
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  if (!date) return ''
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  if (hours < 48) return 'Yesterday'
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const pipelineTabs = ['needs_ocr', 'needs_impose', 'completed'] as const

const pipelineConfig: Record<string, { icon: React.ElementType; label: string; color: string; bg: string; action: string }> = {
  needs_ocr: {
    icon: ScanText, label: 'Needs OCR', color: 'text-status-pending',
    bg: 'bg-status-pending-bg', action: 'Run OCR',
  },
  needs_impose: {
    icon: Grid3x3, label: 'Needs Impose', color: 'text-accent',
    bg: 'bg-accent-subtle', action: 'Run Impose',
  },
  completed: {
    icon: CheckCircle, label: 'Completed', color: 'text-status-completed',
    bg: 'bg-status-completed-bg', action: '',
  },
}

function StatCardSkeleton() {
  return (
    <div className="bg-surface rounded-2xl p-6 shadow-card animate-pulse">
      <div className="w-9 h-9 rounded-xl bg-background-tertiary skeleton mb-4" />
      <div className="w-16 h-8 rounded-lg bg-background-tertiary skeleton mb-2" />
      <div className="w-20 h-3 rounded bg-background-tertiary skeleton" />
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const greeting = useGreeting()
  const DateStr = useMemo(() => formatDate(), [])
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pipelineTab, setPipelineTab] = useState<string>('needs_ocr')
  const [pipelineData, setPipelineData] = useState<Record<string, any[]>>({
    needs_ocr: [],
    needs_impose: [],
    completed: [],
  })
  const [actionLoading, setActionLoading] = useState<Record<number, boolean>>({})
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})

  const fetchData = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await dashboardApi.admin()
      setData(res.data)
      setPipelineData(res.data.pipeline)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const firstName = user?.full_name?.split(' ')[0] || 'Admin'

  const currentItems = pipelineData[pipelineTab] || []

  const statCards = [
    {
      icon: BookOpen, value: data?.total_subjects || 0, label: 'Subjects',
      desc: `${(pipelineData.completed || []).length} completed`,
      iconBg: 'bg-accent-subtle', iconColor: 'text-accent',
    },
    {
      icon: Clock, value: data?.pending || 0, label: 'Pending Images',
      desc: 'Awaiting review',
      iconBg: 'bg-status-pending-bg', iconColor: 'text-status-pending',
    },
    {
      icon: Eye, value: data?.in_review || 0, label: 'In Review',
      desc: 'Currently processing',
      iconBg: 'bg-status-processing-bg', iconColor: 'text-status-processing',
    },
    {
      icon: Users, value: data?.total_teachers || 0, label: 'Teachers',
      desc: 'Registered staff',
      iconBg: 'bg-background-tertiary', iconColor: 'text-text-secondary',
    },
  ]

  const handlePipelineAction = async (item: any, stage: string) => {
    const targetStage = nextStage[stage]
    if (!targetStage) return

    setPipelineData(prev => {
      const from = [...(prev[stage] || [])]
      const to = [...(prev[targetStage] || [])]
      const idx = from.findIndex(i => i.id === item.id)
      if (idx === -1) return prev
      const [moved] = from.splice(idx, 1)
      to.unshift(moved)
      return { ...prev, [stage]: from, [targetStage]: to }
    })

    setActionLoading(prev => ({ ...prev, [item.id]: true }))

    try {
      if (stage === 'needs_ocr') {
        await imagesApi.ocr(item.id)
      } else if (stage === 'needs_impose') {
        await imagesApi.impose(item.id, defaultImposeSettings)
      }
    } catch (e: any) {
      setPipelineData(prev => {
        const from = [...(prev[targetStage] || [])]
        const to = [...(prev[stage] || [])]
        const idx = from.findIndex(i => i.id === item.id)
        if (idx === -1) {
          fetchData()
          return prev
        }
        const [moved] = from.splice(idx, 1)
        to.unshift(moved)
        return { ...prev, [targetStage]: from, [stage]: to }
      })

      const msg = e?.message || 'Something went wrong'
      setRowErrors(prev => ({ ...prev, [item.id]: msg }))
      setTimeout(() => {
        setRowErrors(prev => {
          const next = { ...prev }
          delete next[item.id]
          return next
        })
      }, 3000)
    } finally {
      setActionLoading(prev => ({ ...prev, [item.id]: false }))
    }
  }

  const config = pipelineConfig[pipelineTab] || pipelineConfig.needs_ocr
  const TabIcon = config.icon

  const totalPipelineCount = useMemo(
    () => pipelineTabs.reduce((sum, t) => sum + (pipelineData[t]?.length || 0), 0),
    [pipelineData]
  )

  const quickActions = [
    { label: 'Teachers', icon: Users, href: '/admin/teachers' },
    { label: 'Classes', icon: BookOpen, href: '/admin/classes' },
    { label: 'Structure', icon: FolderOpen, href: '/admin/structure' },
  ]

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
        <div className="w-14 h-14 rounded-2xl bg-status-rejected-bg flex items-center justify-center">
          <XCircle className="w-7 h-7 text-status-rejected" />
        </div>
        <p className="text-[15px] text-text-secondary">Couldn't load dashboard. Try refreshing.</p>
        <button
          onClick={fetchData}
          className="text-sm text-accent font-medium px-5 py-2 rounded-xl border border-border hover:bg-accent-subtle hover:border-accent/30 transition-all duration-fast"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* ── Greeting ── */}
      <div className="mb-10">
        <div className="animate-fade-in">
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">
            {greeting}, {firstName}
          </h1>
          <p className="text-[15px] text-text-secondary mt-1.5">{DateStr}</p>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          statCards.map((stat, i) => {
            const Icon = stat.icon
            return (
              <div
                key={stat.label}
                className={cn(
                  'bg-surface rounded-2xl p-6 shadow-card',
                  'transition-all duration-fast ease-spring hover-lift',
                  'animate-fade-in',
                )}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center mb-4',
                    'shadow-sm ring-1 ring-black/[0.03]',
                    stat.iconBg,
                  )}
                >
                  <Icon className={cn('w-5 h-5', stat.iconColor)} />
                </div>
                <p className="text-[32px] font-bold tracking-tight text-text-primary leading-none mb-1">
                  {stat.value}
                </p>
                <p className="text-[13px] text-text-secondary font-medium">{stat.label}</p>
                <p className="text-[11px] text-text-tertiary mt-1 leading-snug">{stat.desc}</p>
              </div>
            )
          })
        )}
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ─── LEFT: Pipeline ─── */}
        <div className="lg:col-span-3 animate-fade-in" style={{ animationDelay: '360ms' }}>
          <div className="bg-surface rounded-2xl shadow-card overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-border/80">
              {pipelineTabs.map(tab => {
                const cfg = pipelineConfig[tab]
                const Icon = cfg.icon
                const count = (pipelineData[tab] || []).length
                const isActive = pipelineTab === tab
                return (
                  <button
                    key={tab}
                    onClick={() => setPipelineTab(tab)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 h-12 text-[13px] font-medium',
                      'transition-all duration-fast ease-standard',
                      isActive
                        ? 'text-accent border-b-2 border-accent bg-accent/5'
                        : 'text-text-tertiary hover:text-text-secondary hover:bg-background-secondary',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{cfg.label}</span>
                    <span
                      className={cn(
                        'text-[11px] font-medium rounded-full px-1.5 min-w-[20px] h-[20px] flex items-center justify-center',
                        'transition-all duration-fast',
                        isActive
                          ? 'bg-accent text-accent-foreground shadow-sm'
                          : 'bg-background-tertiary text-text-tertiary',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* List */}
            <div className="p-1">
              {loading ? (
                <div className="space-y-0.5 py-5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5 animate-pulse">
                      <div className="w-8 h-8 rounded-xl bg-background-tertiary skeleton flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="w-40 h-3.5 rounded bg-background-tertiary skeleton" />
                        <div className="w-24 h-2.5 rounded bg-background-tertiary skeleton" />
                      </div>
                      <div className="w-20 h-8 rounded-xl bg-background-tertiary skeleton" />
                    </div>
                  ))}
                </div>
              ) : currentItems.length > 0 ? (
                <div key={pipelineTab} className="divide-y divide-border/50">
                  {currentItems.map((item: any, idx: number) => {
                    const isBusy = actionLoading[item.id]
                    const errorMsg = rowErrors[item.id]
                    const isCompleted = pipelineTab === 'completed'
                    return (
                      <div key={item.id} className="animate-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
                        <div
                          className={cn(
                            'flex items-center gap-3 px-4 py-3.5 transition-all duration-fast',
                            errorMsg ? 'bg-status-rejected-bg/30' : '',
                          )}
                        >
                          <div
                            className={cn(
                              'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0',
                              'shadow-sm ring-1 ring-black/[0.03]',
                              config.bg,
                            )}
                          >
                            <TabIcon className={cn('w-4 h-4', config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-text-primary truncate leading-snug">
                              {item.name}
                            </p>
                            <p className="text-[12px] text-text-tertiary mt-0.5">
                              {item.class_name}
                              {item.image_count > 0 && (
                                <span> · {item.image_count} image{item.image_count !== 1 ? 's' : ''}</span>
                              )}
                            </p>
                            {errorMsg && (
                              <p className="text-[11px] text-status-rejected flex items-center gap-1 mt-1.5">
                                <XCircle className="w-3 h-3 flex-shrink-0" />
                                <span>{errorMsg}</span>
                              </p>
                            )}
                          </div>

                          {!isCompleted && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePipelineAction(item, pipelineTab) }}
                              disabled={isBusy}
                              className={cn(
                                'h-[32px] px-3.5 rounded-xl text-[13px] font-medium',
                                'transition-all duration-fast ease-spring',
                                'flex items-center gap-1.5 flex-shrink-0',
                                'bg-accent text-accent-foreground',
                                'hover:bg-accent-hover active:scale-[0.97]',
                                'shadow-sm hover:shadow-md',
                                'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
                              )}
                            >
                              {isBusy ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Zap className="w-3.5 h-3.5" />
                              )}
                              {isBusy ? 'Running…' : config.action}
                            </button>
                          )}

                          {isCompleted && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/admin/subjects/${item.id}`) }}
                                className={cn(
                                  'h-[32px] px-3.5 rounded-xl text-[13px] font-medium',
                                  'transition-all duration-fast ease-spring',
                                  'flex items-center gap-1.5',
                                  'bg-background-secondary text-text-primary',
                                  'hover:bg-background-tertiary active:scale-[0.97]',
                                )}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  try {
                                    await imagesApi.downloadImposed(item.id)
                                  } catch { /* handled by method */ }
                                }}
                                className={cn(
                                  'h-[32px] px-3.5 rounded-xl text-[13px] font-medium',
                                  'transition-all duration-fast ease-spring',
                                  'flex items-center gap-1.5',
                                  'bg-accent text-accent-foreground',
                                  'hover:bg-accent-hover active:scale-[0.97]',
                                  'shadow-sm hover:shadow-md',
                                )}
                              >
                                <Download className="w-3.5 h-3.5" />
                                Download
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div key={pipelineTab} className="flex flex-col items-center justify-center py-14 text-center animate-fade-in">
                  <div className="w-14 h-14 rounded-2xl bg-background-secondary flex items-center justify-center mb-4">
                    <CheckCircle className="w-7 h-7 text-status-completed" />
                  </div>
                  <p className="text-[14px] text-text-secondary font-medium">
                    {totalPipelineCount > 0 ? `${totalPipelineCount} subjects in pipeline` : 'Nothing here yet'}
                  </p>
                  <p className="text-[12px] text-text-tertiary mt-1">
                    {totalPipelineCount > 0 ? 'Switch tabs to view the list' : 'Upload scripts to get started'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── RIGHT ─── */}
        <div className="lg:col-span-2 space-y-5">
          {/* Quick Actions */}
          <div className="bg-surface rounded-2xl shadow-card overflow-hidden animate-fade-in" style={{ animationDelay: '120ms' }}>
            <div className="px-6 pt-5 pb-3">
              <h3 className="text-[15px] font-semibold text-text-primary">Quick Actions</h3>
            </div>
            {quickActions.map((action, idx) => (
              <div key={action.label}>
                <div
                  onClick={() => navigate(action.href)}
                  className={cn(
                    'flex items-center gap-3 h-12 px-6 cursor-pointer',
                    'transition-all duration-fast ease-standard',
                    'hover:bg-background-secondary group',
                  )}
                >
                  <div className="w-8 h-8 rounded-xl bg-background-secondary flex items-center justify-center flex-shrink-0 group-hover:bg-background-tertiary transition-colors duration-fast">
                    <action.icon className="w-4 h-4 text-text-secondary" />
                  </div>
                  <span className="text-[14px] text-text-primary flex-1 font-medium">{action.label}</span>
                  <ChevronRight className="w-4 h-4 text-text-tertiary group-hover:text-text-secondary transition-colors duration-fast" />
                </div>
                {idx < quickActions.length - 1 && <div className="mx-6 h-px bg-border/60" />}
              </div>
            ))}
          </div>

          {/* Recent Uploads */}
          <div className="bg-surface rounded-2xl shadow-card p-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[15px] font-semibold text-text-primary">Recent Uploads</h3>
              {data?.recent_uploads?.length > 0 && (
                <span className="text-[11px] font-medium text-text-tertiary bg-background-secondary rounded-full px-2.5 py-0.5">
                  {data.recent_uploads.length}
                </span>
              )}
            </div>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-14 bg-background-secondary rounded-xl skeleton" />
                ))}
              </div>
            ) : (data?.recent_uploads || []).length > 0 ? (
              <div className="space-y-0.5">
                {data.recent_uploads.slice(0, 5).map((u: any, idx: number) => (
                  <div key={u.id} className="animate-slide-up" style={{ animationDelay: `${idx * 60}ms` }}>
                    <div
                      onClick={() => navigate(`/admin/subjects/${u.subject_id}`)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                        'transition-all duration-fast ease-standard',
                        'hover:bg-background-secondary cursor-pointer group',
                      )}
                    >
                      <div className="w-8 h-8 rounded-xl bg-accent-subtle flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-text-primary truncate leading-snug">
                          {u.title}
                        </p>
                        <p className="text-[11px] text-text-tertiary truncate mt-0.5">
                          {u.subject_name || u.class_name}
                        </p>
                      </div>
                      <span className="text-[11px] text-text-tertiary flex-shrink-0">
                        {formatRelativeTime(u.created_at)}
                      </span>
                    </div>
                    {idx < Math.min(data.recent_uploads.length, 5) - 1 && (
                      <div className="ml-14 h-px bg-border/50" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-background-secondary flex items-center justify-center mb-3">
                  <Upload className="w-6 h-6 text-text-tertiary" />
                </div>
                <p className="text-[14px] font-medium text-text-secondary">No uploads yet</p>
                <p className="text-[12px] text-text-tertiary mt-1">Teachers haven't uploaded any scripts</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
