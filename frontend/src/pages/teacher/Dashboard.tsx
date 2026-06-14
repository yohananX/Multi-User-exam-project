import { useEffect, useState, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  BookOpen, Clock, CheckCircle, MessageSquare, Zap, XCircle,
  Upload, FolderOpen, FileText, ChevronRight, Bell, Check, Eye,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { dashboardApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

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
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  if (!date) return ''
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  pending: { icon: Clock, color: 'text-status-pending', bg: 'bg-status-pending-bg', label: 'Pending' },
  processing: { icon: Zap, color: 'text-status-processing', bg: 'bg-status-processing-bg', label: 'Processing' },
  completed: { icon: CheckCircle, color: 'text-status-completed', bg: 'bg-status-completed-bg', label: 'Completed' },
  rejected: { icon: XCircle, color: 'text-status-rejected', bg: 'bg-status-rejected-bg', label: 'Rejected' },
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

export default function TeacherDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const greeting = useGreeting()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [notifications, setNotifications] = useState<any[]>([])
  const [loadingNotifications, setLoadingNotifications] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await dashboardApi.teacher()
      setData(res.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const fetchNotifications = useCallback(async () => {
    if (!user?.auth_id) return
    setLoadingNotifications(true)
    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id, body, created_at, read')
        .eq('recipient_id', user.auth_id)
        .order('created_at', { ascending: false })
        .limit(6)

      const items: any[] = []
      if (msgs) {
        for (const m of msgs) {
          let name = 'Admin'
          try {
            const { data: sender } = await supabase
              .from('users')
              .select('full_name')
              .eq('auth_id', m.sender_id)
              .single()
            if (sender) name = sender.full_name
          } catch { /* ignore */ }

          items.push({
            id: m.id,
            type: 'message',
            title: `New message from ${name}`,
            description: m.body,
            created_at: m.created_at,
            read: m.read,
          })
        }
      }
      setNotifications(items)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingNotifications(false)
    }
  }, [user?.auth_id])

  const markAsRead = async (msgId: number) => {
    try {
      await supabase.from('messages').update({ read: true }).eq('id', msgId)
      setNotifications(prev => prev.map(n => n.id === msgId ? { ...n, read: true } : n))
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (!user?.auth_id) return
    const name = `db-notifications-${user.auth_id}`
    const existing = supabase.getChannels().find((c: any) => c.topic === name)
    if (existing) supabase.removeChannel(existing)
    const channel = supabase
      .channel(name)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${user.auth_id}` },
        () => fetchNotifications(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.auth_id, fetchNotifications])

  // Realtime subscription: refetch dashboard data when teacher_assignments change
  useEffect(() => {
    if (!user?.id) return
    const name = `db-assignments-${user.id}`
    const existing = supabase.getChannels().find((c: any) => c.topic === name)
    if (existing) supabase.removeChannel(existing)
    const channel = supabase
      .channel(name)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'teacher_assignments', filter: `teacher_id=eq.${user.id}` },
        () => fetchData(),
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const firstName = user?.full_name?.split(' ')[0] || 'Teacher'
  const subjects = (data?.subjects || []).slice().sort(
    (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  )
  const images = data?.images || { total: 0, pending: 0, completed: 0 }
  const stats = data?.stats || {}
  const totalSubjects = stats.total_subjects || subjects.length
  const unreadMessages = notifications.filter(n => !n.read).length
  const recentActivity = data?.recent_uploads || []
  const DateStr = useMemo(() => formatDate(), [])

  const statCards = [
    {
      icon: BookOpen, value: totalSubjects, label: 'Subjects',
      iconBg: 'bg-accent-subtle', iconColor: 'text-accent',
    },
    {
      icon: FileText, value: images.total, label: 'Scripts Uploaded',
      iconBg: 'bg-status-pending-bg', iconColor: 'text-status-pending',
    },
    {
      icon: CheckCircle, value: images.completed, label: 'Completed',
      iconBg: 'bg-status-completed-bg', iconColor: 'text-status-completed',
    },
    {
      icon: MessageSquare, value: unreadMessages, label: 'Unread Messages',
      iconBg: undefined as string | undefined, iconColor: undefined,
    },
  ]

  const quickActions = [
    { label: 'Upload Exam', icon: Upload, href: '/upload', primary: true },
    { label: 'My Uploads', icon: FolderOpen, href: '/uploads', primary: false },
    { label: 'Messages', icon: MessageSquare, href: '/messages', primary: false },
  ]

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-status-pending-bg text-status-pending'
      case 'processing': return 'bg-status-processing-bg text-status-processing'
      case 'completed': return 'bg-status-completed-bg text-status-completed'
      case 'rejected': return 'bg-status-rejected-bg text-status-rejected'
      default: return 'bg-background-tertiary text-text-secondary'
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-[15px] text-text-secondary">Couldn't load your dashboard. Try refreshing.</p>
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
      {/* Section 1 — Greeting + date */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">
          {greeting}, {firstName}
        </h1>
        <p className="text-[15px] text-text-secondary mt-1">{DateStr}</p>
      </div>

      {/* Section 2 — Stat strip */}
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
            const isPurple = i === 3
            const colors = [
              { bg: 'bg-accent-subtle', icon: 'text-accent', inline: undefined },
              { bg: 'bg-status-pending-bg', icon: 'text-status-pending', inline: undefined },
              { bg: 'bg-status-completed-bg', icon: 'text-status-completed', inline: undefined },
              { bg: undefined, icon: undefined, inline: { bg: 'hsl(262 80% 97%)', icon: 'hsl(262 80% 58%)' } },
            ]
            const c = colors[i]
            return (
              <div
                key={stat.label}
                className="bg-surface rounded-[16px] p-5 shadow-card transition-all duration-200 ease-apple hover:-translate-y-[2px] hover:shadow-lg animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div
                  className={cn('w-9 h-9 rounded-sm flex items-center justify-center mb-4', c.bg)}
                  style={c.inline ? { backgroundColor: c.inline.bg } : undefined}
                >
                  <Icon
                    className={cn('w-5 h-5', c.icon)}
                    style={c.inline ? { color: c.inline.icon } : undefined}
                  />
                </div>
                <p className="text-[32px] font-bold tracking-tight text-text-primary leading-none mb-1">
                  {stat.value}
                </p>
                <p className="text-[13px] text-text-secondary font-normal">{stat.label}</p>
              </div>
            )
          })
        )}
      </div>

      {/* Section 3 — Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT COLUMN — Recent Activity & Live Notifications */}
        <div className="lg:col-span-3 space-y-6">
          {/* Recent Uploads Feed */}
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-semibold text-text-primary">Recent Uploads</h2>
                {recentActivity.length > 0 && (
                  <span className="text-[11px] text-text-tertiary bg-background-secondary rounded-full px-2 py-0.5">
                    {recentActivity.length} items
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/uploads')}
                className="text-[13px] text-accent font-medium hover:underline"
              >
                View all
              </button>
            </div>

            {loading ? (
              <div className="space-y-1">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-background-tertiary shimmer flex-shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="w-32 h-3 rounded bg-background-tertiary shimmer" />
                      <div className="w-20 h-2.5 rounded bg-background-tertiary shimmer" />
                    </div>
                    <div className="w-10 h-2.5 rounded bg-background-tertiary shimmer" />
                  </div>
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="bg-surface rounded-[16px] shadow-card p-4 space-y-1">
                {recentActivity.map((item: any, idx: number) => {
                  const config = statusConfig[item.status] || statusConfig.pending
                  const Icon = config.icon
                  return (
                    <div key={item.id}>
                      <div
                        onClick={() => navigate(`/subjects/${item.subject_id}`)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-sm hover:bg-background-secondary transition-all duration-fast cursor-pointer animate-fade-in"
                        style={{ animationDelay: `${idx * 40}ms` }}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-background-secondary">
                          <Icon className={cn('w-4 h-4', config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium text-text-primary truncate">
                            {item.subject_name}
                          </p>
                          <p className="text-[13px] text-text-secondary">
                            {item.class_name} <span className="text-text-tertiary">·</span> Page {item.number}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className={cn(
                            'rounded-full text-[11px] font-medium px-2 py-0.5',
                            getStatusStyle(item.status),
                          )}>
                            {config.label}
                          </span>
                          <p className="text-xs text-text-tertiary">
                            {item.created_at ? formatRelativeTime(item.created_at) : ''}
                          </p>
                        </div>
                      </div>
                      {idx < recentActivity.length - 1 && (
                        <div className="ml-11 h-px bg-border" />
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 bg-surface rounded-[16px] shadow-card">
                <FolderOpen className="w-10 h-10 text-text-tertiary mb-3" />
                <p className="text-[15px] text-text-secondary mb-1">No uploads yet</p>
                <p className="text-[13px] text-text-tertiary">Upload your first exam to get started</p>
              </div>
            )}
          </div>

          {/* Notifications Card */}
          <div className="bg-surface rounded-[16px] shadow-card p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Bell className="w-4 h-4 text-accent" />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-status-rejected animate-pulse" />
                  )}
                </div>
                <h3 className="text-[15px] font-semibold text-text-primary">Notifications & Messages</h3>
                {unreadMessages > 0 && (
                  <span className="text-[11px] font-semibold text-accent-foreground bg-accent rounded-full px-1.5 min-w-[18px] h-[18px] flex items-center justify-center">
                    {unreadMessages}
                  </span>
                )}
              </div>
              <button
                onClick={() => navigate('/messages')}
                className="text-[13px] text-accent font-medium hover:underline"
              >
                Open Inbox
              </button>
            </div>

            {loadingNotifications ? (
              <div className="space-y-3 py-3 animate-pulse">
                <div className="h-[68px] bg-background-secondary rounded-[12px]" />
                <div className="h-[68px] bg-background-secondary rounded-[12px]" />
              </div>
            ) : notifications.length > 0 ? (
              <div className="space-y-2">
                {notifications.map((n, idx) => (
                  <div
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-[12px] border transition-all duration-fast animate-fade-in",
                      n.read
                        ? "bg-surface border-border/50"
                        : "bg-accent/4 border-accent/20 shadow-[0_0_0_1px_hsl(var(--accent)/0.08)_inset]",
                    )}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                      n.read ? "bg-background-secondary" : "bg-accent/10",
                    )}>
                      <MessageSquare className={cn("w-4 h-4", n.read ? "text-text-tertiary" : "text-accent")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-[13px] truncate", n.read ? "text-text-secondary" : "text-text-primary font-semibold")}>
                          {n.title}
                        </p>
                        <span className="text-[11px] text-text-tertiary flex-shrink-0">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>
                      <p className="text-[12px] text-text-secondary mt-0.5 leading-snug line-clamp-2">{n.description}</p>

                      {!n.read && (
                        <div className="flex gap-3 mt-2">
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="flex items-center gap-1 text-[11px] font-medium text-accent hover:opacity-80 transition-opacity"
                          >
                            <Check className="w-3 h-3" />
                            Mark read
                          </button>
                          <button
                            onClick={() => navigate('/messages')}
                            className="flex items-center gap-1 text-[11px] font-medium text-text-secondary hover:text-text-primary transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            Reply
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="w-8 h-8 text-text-tertiary mb-2" />
                <p className="text-[14px] text-text-secondary">All caught up!</p>
                <p className="text-[12px] text-text-tertiary mt-0.5">No new notifications or messages.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-2 space-y-4">
          {/* CARD A — Quick Actions */}
          {!loading && (
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
                    <div
                      className={cn(
                        'w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0 transition-colors duration-fast',
                        action.primary
                          ? 'bg-accent-subtle group-hover:bg-accent-subtle'
                          : 'bg-background-secondary',
                      )}
                    >
                      <action.icon
                        className={cn(
                          'w-4 h-4',
                          action.primary ? 'text-accent' : 'text-text-secondary',
                        )}
                      />
                    </div>
                    <span className="text-[14px] text-text-primary flex-1">{action.label}</span>
                    <ChevronRight className="w-4 h-4 text-text-tertiary" />
                  </div>
                  {idx < quickActions.length - 1 && <div className="mx-5 h-px bg-border" />}
                </div>
              ))}
            </div>
          )}

          {/* CARD B — Subjects Overview */}
          {!loading && (
            <div className="bg-surface rounded-[16px] shadow-card">
              <div className="p-5 pb-0">
                <h3 className="text-[15px] font-semibold text-text-primary">Your Subjects</h3>
              </div>
              {subjects.length > 0 ? (
                <div className="p-5 pt-3">
                  {subjects.slice(0, 5).map((s: any, idx: number) => (
                    <div key={s.subject_id} className={cn(idx > 0 && 'mt-3')}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="text-[14px] text-text-primary truncate">{s.subject_name}</p>
                          <p className="text-[13px] text-text-tertiary truncate">{s.class_name}</p>
                        </div>
                        <span className={cn(
                          'rounded-full text-[11px] font-medium px-2 py-0.5 flex-shrink-0',
                          getStatusStyle(s.status),
                        )}>
                          {statusConfig[s.status]?.label || s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {subjects.length > 5 && (
                    <button
                      onClick={() => navigate('/uploads')}
                      className="text-[13px] text-accent font-medium mt-3 block hover:underline"
                    >
                      See all {subjects.length} subjects
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[13px] text-text-tertiary text-center py-6">No subjects assigned yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
