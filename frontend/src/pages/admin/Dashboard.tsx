import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen, Users, Clock, CheckCircle, Eye, Loader2,
  ScanText, FileDown, Grid3x3, Zap, Upload, FolderOpen,
  ChevronRight, FileText, XCircle,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardApi, imagesApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'

const nextStage: Record<string, string> = {
  needs_ocr: 'needs_docx',
  needs_docx: 'needs_impose',
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

const pipelineTabs = ['needs_ocr', 'needs_docx', 'needs_impose', 'completed'] as const

const pipelineConfig: Record<string, { icon: React.ElementType; label: string; color: string; bg: string; action: string }> = {
  needs_ocr: {
    icon: ScanText, label: 'Needs OCR', color: 'text-status-pending',
    bg: 'bg-status-pending-bg', action: 'Run OCR',
  },
  needs_docx: {
    icon: FileDown, label: 'Needs DOCX', color: 'text-status-processing',
    bg: 'bg-status-processing-bg', action: 'Build DOCX',
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
    <div className="bg-surface rounded-[16px] p-5 shadow-card animate-pulse">
      <div className="w-9 h-9 rounded-sm bg-background-tertiary shimmer mb-4" />
      <div className="w-16 h-8 rounded bg-background-tertiary shimmer mb-2" />
      <div className="w-20 h-3 rounded bg-background-tertiary shimmer" />
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
    needs_docx: [],
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
      } else if (stage === 'needs_docx') {
        await imagesApi.buildDocx(item.id)
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
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-[15px] text-text-secondary">Couldn't load dashboard. Try refreshing.</p>
        <button
          onClick={fetchData}
          className="text-sm text-accent font-medium px-4 py-1.5 rounded-sm border border-transparent hover:border-border transition-colors duration-fast"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl animate-fade-in">
      {/* Greeting */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">
          {greeting}, {firstName}
        </h1>
        <p className="text-[15px] text-text-secondary mt-1">{DateStr}</p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                className="bg-surface rounded-[16px] p-5 shadow-card transition-all duration-200 ease-apple hover:-translate-y-[2px] hover:shadow-lg animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className={cn('w-9 h-9 rounded-sm flex items-center justify-center mb-4', stat.iconBg)}>
                  <Icon className={cn('w-5 h-5', stat.iconColor)} />
                </div>
                <p className="text-[32px] font-bold tracking-tight text-text-primary leading-none mb-1">
                  {stat.value}
                </p>
                <p className="text-[13px] text-text-secondary font-normal">{stat.label}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5">{stat.desc}</p>
              </div>
            )
          })
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT — Pipeline */}
        <div className="lg:col-span-3 animate-fade-in">
          <div className="bg-surface rounded-[16px] shadow-card overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-border">
              {pipelineTabs.map(tab => {
                const cfg = pipelineConfig[tab]
                const Icon = cfg.icon
                const count = (pipelineData[tab] || []).length
                return (
                  <button
                    key={tab}
                    onClick={() => setPipelineTab(tab)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 h-11 text-[13px] font-medium transition-colors duration-fast',
                      pipelineTab === tab
                        ? 'text-accent border-b-2 border-accent bg-accent/4'
                        : 'text-text-tertiary hover:text-text-secondary hover:bg-background-secondary',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{cfg.label}</span>
                    <span className={cn(
                      'text-[11px] rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center',
                      pipelineTab === tab ? 'bg-accent text-accent-foreground' : 'bg-background-tertiary text-text-tertiary',
                    )}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* List */}
            <div className="p-1">
              {loading ? (
                <div className="space-y-1 py-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-background-tertiary shimmer flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="w-40 h-3 rounded bg-background-tertiary shimmer" />
                        <div className="w-24 h-2.5 rounded bg-background-tertiary shimmer" />
                      </div>
                      <div className="w-16 h-7 rounded-lg bg-background-tertiary shimmer" />
                    </div>
                  ))}
                </div>
              ) : currentItems.length > 0 ? (
                <div className="space-y-1">
                  {currentItems.map((item: any, idx: number) => {
                    const isLast = idx === currentItems.length - 1
                    const isBusy = actionLoading[item.id]
                    const errorMsg = rowErrors[item.id]
                    const isCompleted = pipelineTab === 'completed'
                    return (
                      <div key={item.id}>
                        <div className={cn(
                          'flex items-center gap-3 px-4 py-3 transition-all duration-fast',
                          errorMsg ? 'bg-red-50/40' : '',
                        )}>
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                            config.bg,
                          )}>
                            <TabIcon className={cn('w-4 h-4', config.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-text-primary truncate">{item.name}</p>
                            <p className="text-[12px] text-text-tertiary">
                              {item.class_name}
                              {item.image_count > 0 && (
                                <span> · {item.image_count} image{item.image_count !== 1 ? 's' : ''}</span>
                              )}
                            </p>
                            {errorMsg && (
                              <p className="text-[11px] text-red-500 flex items-center gap-1 mt-0.5">
                                <XCircle className="w-3 h-3" />
                                {errorMsg}
                              </p>
                            )}
                          </div>
                          {!isCompleted && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePipelineAction(item, pipelineTab) }}
                              disabled={isBusy}
                              className={cn(
                                'h-[30px] px-3 rounded-[8px] text-[13px] font-medium transition-all duration-fast flex items-center gap-1.5 flex-shrink-0',
                                'bg-accent text-accent-foreground hover:bg-accent-hover',
                                'disabled:opacity-50 disabled:cursor-not-allowed',
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
                                className="h-[30px] px-3 rounded-[8px] text-[13px] font-medium transition-all duration-fast flex items-center gap-1.5 bg-background-secondary text-text-primary hover:bg-background-tertiary"
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
                                className="h-[30px] px-3 rounded-[8px] text-[13px] font-medium transition-all duration-fast flex items-center gap-1.5 bg-accent text-accent-foreground hover:bg-accent-hover"
                              >
                                <FileDown className="w-3.5 h-3.5" />
                                Download
                              </button>
                            </div>
                          )}
                        </div>
                        {!isLast && <div className="ml-14 h-px bg-border" />}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle className="w-8 h-8 text-status-completed mb-3" />
                  <p className="text-[14px] text-text-secondary">
                    {totalPipelineCount > 0 ? `${totalPipelineCount} subjects in pipeline` : 'Nothing here yet'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-2 space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
          {/* Quick Actions */}
          <div className="bg-surface rounded-[16px] shadow-card">
            <div className="p-5 pb-0">
              <h3 className="text-[15px] font-semibold text-text-primary">Quick Actions</h3>
            </div>
            {quickActions.map((action, idx) => (
              <div key={action.label}>
                <div
                  onClick={() => navigate(action.href)}
                  className="flex items-center gap-3 h-11 px-5 cursor-pointer hover:bg-background-secondary transition-colors duration-fast"
                >
                  <div className="w-8 h-8 rounded-sm bg-background-secondary flex items-center justify-center flex-shrink-0">
                    <action.icon className="w-4 h-4 text-text-secondary" />
                  </div>
                  <span className="text-[14px] text-text-primary flex-1">{action.label}</span>
                  <ChevronRight className="w-4 h-4 text-text-tertiary" />
                </div>
                {idx < quickActions.length - 1 && <div className="mx-5 h-px bg-border" />}
              </div>
            ))}
          </div>

          {/* Recent Uploads */}
          <div className="bg-surface rounded-[16px] shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-text-primary">Recent Uploads</h3>
              {data?.recent_uploads?.length > 0 && (
                <span className="text-[11px] text-text-tertiary bg-background-secondary rounded-full px-2 py-0.5">
                  {data.recent_uploads.length}
                </span>
              )}
            </div>
            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-background-secondary rounded-lg" />
                ))}
              </div>
            ) : (data?.recent_uploads || []).length > 0 ? (
              <div className="space-y-1">
                {data.recent_uploads.slice(0, 5).map((u: any, idx: number) => (
                  <div key={u.id}>
                    <div
                      onClick={() => navigate(`/admin/subjects/${u.subject_id}`)}
                      className="flex items-center gap-3 px-2 py-2 rounded-sm hover:bg-background-secondary transition-colors duration-fast cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-sm bg-background-secondary flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3.5 h-3.5 text-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-text-primary truncate">{u.title}</p>
                        <p className="text-[11px] text-text-tertiary truncate">
                          {u.subject_name || u.class_name}
                        </p>
                      </div>
                      <span className="text-[11px] text-text-tertiary flex-shrink-0">
                        {formatRelativeTime(u.created_at)}
                      </span>
                    </div>
                    {idx < Math.min(data.recent_uploads.length, 5) - 1 && <div className="ml-9 h-px bg-border" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Upload className="w-8 h-8 text-text-tertiary mb-2" />
                <p className="text-[14px] text-text-secondary">No uploads yet</p>
                <p className="text-[12px] text-text-tertiary mt-0.5">Teachers haven't uploaded any scripts</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
