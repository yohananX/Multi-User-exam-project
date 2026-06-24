import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MessageSquare, Send, ChevronLeft, Search, Paperclip,
  BookOpen, Image as ImageIcon, FolderOpen, Loader2, X, Users,
  GraduationCap,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { messagesApi, dashboardApi } from '@/api/endpoints'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Message, Conversation } from '@/types'

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

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDateSeparator(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'A'
}

const isAdminRole = (role?: string) => role === 'super_admin' || role === 'school_admin'

/* ─── Custom styles for bubble tails and left-slide animation ─── */
const ANIM_STYLES = `
.bubble-sent::after {
  content: '';
  position: absolute;
  bottom: 0;
  right: -7px;
  width: 14px;
  height: 14px;
  background: hsl(var(--accent));
  clip-path: polygon(0 0, 100% 100%, 0 100%);
  border-radius: 0 0 4px 0;
}
.bubble-received::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: -7px;
  width: 14px;
  height: 14px;
  background: hsl(var(--background-secondary));
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
  border-radius: 0 0 0 4px;
}
.bubble-sent,
.bubble-received {
  position: relative;
}
.animate-slide-in-left {
  animation: slideInLeft 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
}
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}
`

export default function MessagesPage() {
  const { user: authUser } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null)
  const [partnerNames, setPartnerNames] = useState<Record<string, string>>({})
  const [partnerRoles, setPartnerRoles] = useState<Record<string, string>>({})
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [showRefPicker, setShowRefPicker] = useState(false)
  const [subjectRef, setSubjectRef] = useState<{ id: number; name: string; class_name: string } | null>(null)
  const [imageRef, setImageRef] = useState<{ id: number; title: string } | null>(null)
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([])
  const [availableImages, setAvailableImages] = useState<any[]>([])
  const [availableTeachers, setAvailableTeachers] = useState<any[]>([])
  const [availableClasses, setAvailableClasses] = useState<any[]>([])
  const [teacherRef, setTeacherRef] = useState<{ id: number; name: string } | null>(null)
  const [classRef, setClassRef] = useState<{ id: number; name: string } | null>(null)
  const [refTab, setRefTab] = useState<'subjects' | 'images' | 'teachers' | 'classes'>('subjects')
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState<'list' | 'thread'>('list')
  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [teacherClassCount, setTeacherClassCount] = useState<Record<string, number>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  const userId = authUser?.auth_id
  const userRole = authUser?.role
  const isAdmin = isAdminRole(userRole)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  const autoGrowTextarea = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }, [])

  // ─── Real-time subscription ──────────────────────────────────────

  useEffect(() => {
    if (!userId) return
    const name = `messages-${userId}`
    const existing = supabase.getChannels().find((c: any) => c.topic === name)
    if (existing) supabase.removeChannel(existing)
    const channel = supabase
      .channel(name)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${userId}` },
        (payload) => setMessages(prev => [...prev, payload.new as Message]),
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${userId}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ─── Fetch data on mount ─────────────────────────────────────────

  useEffect(() => {
    if (!userId) return
    setLoading(true)

    const load = async () => {
      const [msgRes, subjRes] = await Promise.all([
        messagesApi.list(),
        dashboardApi.teacher(),
      ])

      const msgs = (msgRes.data || []) as Message[]
      setMessages(msgs)
      setAvailableSubjects(subjRes.data?.subjects || [])

      // Fetch all users with roles
      const ids = new Set<string>()
      msgs.forEach(m => {
        if (m.sender_id !== userId) ids.add(m.sender_id)
        if (m.recipient_id !== userId) ids.add(m.recipient_id)
      })

      if (ids.size > 0) {
        try {
          const { data: users } = await supabase
            .from('users')
            .select('auth_id, full_name, role')
            .in('auth_id', Array.from(ids))
          if (users) {
            const nameMap: Record<string, string> = {}
            const roleMap: Record<string, string> = {}
            users.forEach(u => { nameMap[u.auth_id] = u.full_name; roleMap[u.auth_id] = u.role })
            setPartnerNames(prev => ({ ...prev, ...nameMap }))
            setPartnerRoles(prev => ({ ...prev, ...roleMap }))
          }
        } catch { /* ignore */ }
      }

      // For teachers: fetch admin users they can message
      // For admins: fetch teacher class counts
      try {
        if (!isAdmin) {
          const { data: admins } = await supabase
            .from('users')
            .select('auth_id, full_name, email')
            .in('role', ['super_admin', 'school_admin'])
          if (admins) setAdminUsers(admins)
        } else {
          const { data: users } = await supabase
            .from('users')
            .select('auth_id, id')
            .eq('role', 'teacher')
          if (users) {
            const { data: assignments } = await supabase
              .from('teacher_assignments')
              .select('teacher_id')
            if (assignments) {
              const counts: Record<number, number> = {}
              assignments.forEach((a: any) => { counts[a.teacher_id] = (counts[a.teacher_id] || 0) + 1 })
              const map: Record<string, number> = {}
              users.forEach((u: any) => {
                if (counts[u.id]) map[u.auth_id] = counts[u.id]
              })
              setTeacherClassCount(map)
            }
          }
        }
      } catch { /* ignore */ }

      // ─── Reference data (teachers + classes for all roles) ─────
      try {
        const { data: teachers } = await supabase
          .from('users')
          .select('id, full_name, email')
          .eq('role', 'teacher')
          .order('id')
          .limit(100)
        if (teachers) setAvailableTeachers(teachers)

        const { data: classes } = await supabase
          .from('classes')
          .select('id, name, section')
          .order('id')
        if (classes) setAvailableClasses(classes)
      } catch { /* ignore */ }

      // For admins: also load all subjects for reference
      if (isAdmin) {
        try {
          const { data: allSubj } = await supabase
            .from('subjects')
            .select('id, name, class_id, classes(name)')
            .order('id')
            .limit(200)
          if (allSubj) {
            setAvailableSubjects(allSubj.map((s: any) => ({
              subject_id: s.id,
              subject_name: s.name,
              class_id: s.class_id,
              class_name: s.classes?.name || '',
            })))
          }
        } catch { /* ignore */ }
      }

      setLoading(false)
    }

    load().catch(() => setLoading(false))
  }, [userId, isAdmin])

  // ─── Build conversations from messages ───────────────────────────

  useEffect(() => {
    if (!userId) return
    const groups = new Map<string, Message[]>()
    messages.forEach(m => {
      const pid = m.sender_id === userId ? m.recipient_id : m.sender_id
      if (!groups.has(pid)) groups.set(pid, [])
      groups.get(pid)!.push(m)
    })
    const convos: Conversation[] = []
    groups.forEach((msgs, pid) => {
      // Teachers: only show conversations with admins
      if (!isAdmin && !isAdminRole(partnerRoles[pid])) return
      msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const last = msgs[0]
      const unread = msgs.filter(m => m.recipient_id === userId && !m.read).length
      convos.push({
        partner_id: pid,
        partner_name: partnerNames[pid] || (pid === userId ? 'Drafts' : 'Admin'),
        last_message: last,
        unread_count: unread,
      })
    })
    convos.sort((a, b) => new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime())
    setConversations(convos)
  }, [messages, partnerNames, partnerRoles, userId, isAdmin])

  // ─── Auto-select first conversation ──────────────────────────────

  useEffect(() => {
    if (!loading && !selectedPartner && conversations.length > 0) {
      setSelectedPartner(conversations[0].partner_id)
      setView('thread')
    }
  }, [loading, selectedPartner, conversations])

  // ─── Thread messages ─────────────────────────────────────────────

  const threadMessages = userId && selectedPartner
    ? messages
        .filter(m =>
          (m.sender_id === userId && m.recipient_id === selectedPartner) ||
          (m.sender_id === selectedPartner && m.recipient_id === userId),
        )
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : []

  useEffect(() => { scrollToBottom() }, [threadMessages.length, scrollToBottom])

  // ─── Mark as read ────────────────────────────────────────────────

  useEffect(() => {
    if (selectedPartner && userId) {
      const unreadIds = messages
        .filter(m => m.recipient_id === userId && m.sender_id === selectedPartner && !m.read)
        .map(m => m.id)
      if (unreadIds.length > 0) {
        messagesApi.markRead(unreadIds)
        setMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, read: true } : m))
      }
    }
  }, [selectedPartner, messages, userId])

  // ─── Click outside to close picker ────────────────────────────────

  useEffect(() => {
    if (!showRefPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowRefPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showRefPicker])

  // ─── Start a new conversation (for teachers) ──────────────────────

  const handleStartConversation = async (adminAuthId: string) => {
    setSelectedPartner(adminAuthId)
    setView('thread')
    if (!partnerNames[adminAuthId]) {
      const admin = adminUsers.find(a => a.auth_id === adminAuthId)
      if (admin) setPartnerNames(prev => ({ ...prev, [adminAuthId]: admin.full_name }))
    }
  }

  // ─── Send message (optimistic) ────────────────────────────────────

  const handleSend = async () => {
    if (!inputText.trim() || !userId || sending) return
    const recipient = selectedPartner || userId
    setSending(true)
    setSendError('')

    const text = inputText.trim()
    const optimisticId = Date.now()
    const optimistic: Message = {
      id: optimisticId,
      sender_id: userId,
      recipient_id: recipient,
      body: text,
      read: false,
      created_at: new Date().toISOString(),
      subject_id: null,
      image_id: null,
      class_id: null,
      teacher_ref_id: null,
    }

    setMessages(prev => [...prev, optimistic])
    setInputText('')
    setSubjectRef(null)
    setImageRef(null)
    setTeacherRef(null)
    setClassRef(null)
    setShowRefPicker(false)
    if (!selectedPartner) {
      setSelectedPartner(recipient)
      setView('thread')
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      const refs: any = {}
      if (subjectRef) refs.subject_id = subjectRef.id
      if (imageRef) refs.image_id = imageRef.id
      if (teacherRef) refs.teacher_ref_id = teacherRef.id
      if (classRef) refs.class_id = classRef.id
      const { data: real } = await messagesApi.send(recipient, text, Object.keys(refs).length ? refs : undefined)
      if (real) {
        setMessages(prev => prev.map(m => m.id === optimisticId ? real : m))
      }
    } catch (e: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setSendError(e?.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSend() }
  }

  // ─── Reference picker ────────────────────────────────────────────

  const openRefPicker = () => {
    if (!showRefPicker && userId) {
      // Load images for reference if not loaded yet
      if (availableImages.length === 0) {
        const q = supabase
          .from('images')
          .select('id, title, subject_id')
          .order('created_at', { ascending: false })
          .limit(50)
        if (!isAdmin) q.eq('uploaded_by', userId)
        q.then(({ data }) => setAvailableImages(data || []))
      }
    }
    setShowRefPicker(!showRefPicker)
  }

  const selectSubjectRef = (s: any) => {
    setSubjectRef({ id: s.subject_id, name: s.subject_name, class_name: s.class_name })
    setImageRef(null); setTeacherRef(null); setClassRef(null); setShowRefPicker(false); textareaRef.current?.focus()
  }

  const selectImageRef = (img: any) => {
    setImageRef({ id: img.id, title: img.title })
    setSubjectRef(null); setTeacherRef(null); setClassRef(null); setShowRefPicker(false); textareaRef.current?.focus()
  }

  const selectTeacherRef = (t: any) => {
    setTeacherRef({ id: t.id, name: t.full_name })
    setSubjectRef(null); setImageRef(null); setClassRef(null); setShowRefPicker(false); textareaRef.current?.focus()
  }

  const selectClassRef = (c: any) => {
    setClassRef({ id: c.id, name: c.name + (c.section ? ` · ${c.section}` : '') })
    setSubjectRef(null); setImageRef(null); setTeacherRef(null); setShowRefPicker(false); textareaRef.current?.focus()
  }

  const removeRef = () => { setSubjectRef(null); setImageRef(null); setTeacherRef(null); setClassRef(null) }

  // ─── Derived state ───────────────────────────────────────────────

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unread_count, 0)
  const filteredConvos = conversations.filter(c =>
    c.partner_name.toLowerCase().includes(searchQuery.toLowerCase()),
  )
  const selectedConvo = conversations.find(c => c.partner_id === selectedPartner)
  const threadPartnerRole = partnerRoles[selectedPartner || '']
  const threadPartnerName = selectedConvo?.partner_name || partnerNames[selectedPartner || ''] || 'Admin'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    )
  }

  return (
    <>
      <style>{ANIM_STYLES}</style>

      <div className="h-[calc(100vh-52px-40px)] lg:h-[calc(100vh-52px-64px)] flex bg-surface rounded-2xl shadow-card overflow-hidden animate-fade-in">
        {/* ── Conversation List ── */}
        <div className={cn(
          'w-full lg:w-[320px] flex-shrink-0 border-r border-border flex flex-col',
          view === 'thread' && 'hidden lg:flex',
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 h-14 border-b border-border flex-shrink-0 bg-surface">
            <h2 className="text-[17px] font-semibold text-text-primary tracking-tight">Messages</h2>
            {unreadTotal > 0 && (
              <div className="flex items-center gap-1.5 bg-accent/10 text-accent text-[11px] font-semibold px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span>{unreadTotal} unread</span>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="px-4 pt-3 pb-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-[11px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-[32px] pl-8 pr-3 text-[13px] bg-background-secondary border border-border rounded-full text-text-primary placeholder:text-text-tertiary outline-none transition-shadow duration-fast focus:border-accent focus:shadow-[0_0_0_3px_hsl(var(--accent)/0.1)]"
              />
            </div>
          </div>

          {/* Admin list (for teachers with no convos) */}
          {!isAdmin && adminUsers.length > 0 && conversations.length === 0 && (
            <div className="px-4 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary mb-2 px-3">
                Administrators
              </p>
              {adminUsers.map(admin => (
                <button
                  key={admin.auth_id}
                  onClick={() => handleStartConversation(admin.auth_id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-background-secondary transition-all duration-fast group"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-[12px] font-semibold text-white">{getInitials(admin.full_name)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-text-primary truncate group-hover:text-accent transition-colors duration-fast">{admin.full_name}</p>
                    <p className="text-[11px] text-text-tertiary truncate">{admin.email}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold flex-shrink-0 border border-purple-500/15">Admin</span>
                </button>
              ))}
            </div>
          )}

          {/* Conversation items */}
          <div className="flex-1 overflow-y-auto [&>*:last-child>div:last-child]:hidden">
            {filteredConvos.length > 0 ? (
              filteredConvos.map((c, idx) => {
                const isActive = c.partner_id === selectedPartner
                const hasUnread = c.unread_count > 0
                const lastMsg = c.last_message
                const partnerRole = partnerRoles[c.partner_id]
                const isPartnerAdmin = isAdminRole(partnerRole)
                const classCount = teacherClassCount[c.partner_id]
                return (
                  <div key={c.partner_id} style={{ animationDelay: `${idx * 30}ms` }} className="animate-fade-in">
                    <button
                      onClick={() => { setSelectedPartner(c.partner_id); setView('thread') }}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 text-left transition-all duration-fast relative',
                        'border-l-[3px]',
                        isActive
                          ? 'bg-accent/8 border-l-accent'
                          : 'border-l-transparent hover:bg-background-secondary/60',
                      )}
                      style={{ minHeight: '68px' }}
                    >
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm',
                        isPartnerAdmin
                          ? 'bg-gradient-to-br from-purple-500 to-purple-700'
                          : 'bg-gradient-to-br from-accent to-blue-600',
                      )}>
                        <span className="text-[12px] font-semibold text-white leading-none">
                          {getInitials(c.partner_name)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 self-center pt-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={cn(
                              'text-[14px] truncate leading-tight',
                              hasUnread ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary',
                            )}>
                              {c.partner_name}
                            </span>
                            {isPartnerAdmin && (
                              <span className="text-[9px] px-1.5 py-[2px] rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold flex-shrink-0 border border-purple-500/15 leading-none">Admin</span>
                            )}
                          </div>
                          <span className="text-[11px] text-text-tertiary flex-shrink-0 leading-none">{formatRelativeTime(lastMsg.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <p className={cn(
                            'text-[12.5px] truncate flex-1 max-w-[180px] leading-normal',
                            hasUnread ? 'text-text-secondary font-medium' : 'text-text-tertiary',
                          )}>
                            {lastMsg.sender_id === userId && (
                              <span className="text-accent/80 font-medium">You: </span>
                            )}
                            {lastMsg.body}
                          </p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isAdmin && classCount !== undefined && (
                              <span className="text-[10px] text-text-tertiary font-medium px-1 bg-background-tertiary/50 rounded">{classCount}c</span>
                            )}
                            {hasUnread && (
                              <span className="min-w-[19px] h-[19px] rounded-full bg-accent flex items-center justify-center px-1 shadow-sm">
                                <span className="text-[10px] font-bold text-accent-foreground leading-none tracking-tight">
                                  {c.unread_count > 99 ? '99+' : c.unread_count}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                    {idx < filteredConvos.length - 1 && (
                      <div className="h-px bg-border/60 mx-4" />
                    )}
                  </div>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <div className="w-14 h-14 rounded-full bg-background-secondary flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-7 h-7 text-text-tertiary" />
                </div>
                <p className="text-[15px] font-medium text-text-secondary mb-1.5">
                  {searchQuery ? 'No conversations found' : 'No messages yet'}
                </p>
                <p className="text-[13px] text-text-tertiary max-w-[220px]">
                  {searchQuery ? 'Try a different search term' : isAdmin ? 'Messages from teachers will appear here' : 'Admins will appear above to start a conversation'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Message Thread ── */}
        <div className={cn(
          'flex-1 flex flex-col min-w-0 bg-surface',
          view === 'list' && 'hidden lg:flex',
        )}>
          {/* Thread Header */}
          {selectedPartner ? (
            <div className="flex items-center gap-3 px-4 h-14 border-b border-border flex-shrink-0 bg-surface">
              <button
                onClick={() => setView('list')}
                className="lg:hidden w-8 h-8 flex items-center justify-center rounded-full text-text-secondary hover:bg-background-secondary transition-all duration-fast active:scale-90"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm',
                isAdminRole(threadPartnerRole)
                  ? 'bg-gradient-to-br from-purple-500 to-purple-700'
                  : 'bg-gradient-to-br from-accent to-blue-600',
              )}>
                <span className="text-[12px] font-semibold text-white leading-none">{getInitials(threadPartnerName)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[14px] font-semibold text-text-primary truncate">{threadPartnerName}</p>
                  {isAdminRole(threadPartnerRole) && (
                    <span className="text-[9px] px-1.5 py-[2px] rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold border border-purple-500/15">Admin</span>
                  )}
                </div>
                {isAdminRole(threadPartnerRole) && (
                  <p className="text-[11px] text-text-tertiary leading-none mt-0.5">Administrator</p>
                )}
              </div>
            </div>
          ) : (
            <div className="hidden lg:flex items-center px-5 h-14 border-b border-border flex-shrink-0 bg-surface">
              <p className="text-[14px] font-medium text-text-secondary">
                {conversations.length > 0 ? 'Select a conversation' : 'New Message'}
              </p>
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scroll-smooth">
            {selectedPartner && threadMessages.length > 0 ? (
              threadMessages.map((m, idx) => {
                const isMine = m.sender_id === userId
                const showDate = idx === 0 || new Date(m.created_at).toDateString() !== new Date(threadMessages[idx - 1].created_at).toDateString()
                const hasRef = m.subject_id || m.image_id || m.class_id || m.teacher_ref_id
                return (
                  <div key={m.id} className={cn(isMine ? 'animate-slide-in-right' : 'animate-slide-in-left')}>
                    {showDate && (
                      <div className="flex items-center gap-3 my-5 animate-fade-in">
                        <div className="flex-1 h-px bg-border/50" />
                        <span className="text-[12px] font-medium text-text-tertiary tracking-wide flex-shrink-0 px-1">
                          {formatDateSeparator(m.created_at)}
                        </span>
                        <div className="flex-1 h-px bg-border/50" />
                      </div>
                    )}
                    <div className={cn('flex', isMine ? 'justify-end' : 'justify-start', 'mb-0.5')}>
                      <div className="max-w-[72%] md:max-w-[65%]">
                        {/* Bubble */}
                        <div
                          className={cn(
                            'px-[14px] py-[10px] text-[15px] leading-snug whitespace-pre-wrap break-words',
                            'shadow-sm',
                            isMine
                              ? 'bubble-sent bg-accent text-white rounded-[18px_18px_4px_18px]'
                              : 'bubble-received bg-background-secondary text-text-primary rounded-[18px_18px_18px_4px]',
                          )}
                        >
                          {hasRef && (
                            <div className={cn(
                              'rounded-xl p-2.5 text-[13px] mb-2 space-y-1.5',
                              isMine ? 'bg-white/12' : 'bg-background-tertiary/70',
                            )}>
                              {m.subject_id && (
                                <button onClick={() => navigate(isAdmin ? `/admin/subjects/${m.subject_id}` : `/subjects/${m.subject_id}`)}
                                  className="flex items-center gap-2 hover:underline w-full group">
                                  <div className={cn(
                                    'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0',
                                    isMine ? 'bg-white/15' : 'bg-accent/10',
                                  )}>
                                    <BookOpen className={cn('w-3 h-3', isMine ? 'text-white/80' : 'text-accent')} />
                                  </div>
                                  <span className="font-medium truncate group-hover:opacity-80 transition-opacity">{m.subject_name || 'Subject'}</span>
                                </button>
                              )}
                              {m.image_id && (
                                <button onClick={() => navigate(isAdmin ? `/admin/subjects/${m.subject_id || ''}` : `/subjects/${m.subject_id || ''}`)}
                                  className="flex items-center gap-2 hover:underline w-full group">
                                  <div className={cn(
                                    'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0',
                                    isMine ? 'bg-white/15' : 'bg-amber-500/10',
                                  )}>
                                    <ImageIcon className={cn('w-3 h-3', isMine ? 'text-white/80' : 'text-amber-600 dark:text-amber-400')} />
                                  </div>
                                  <span className="font-medium truncate group-hover:opacity-80 transition-opacity">{m.image_title || 'Image'}</span>
                                </button>
                              )}
                              {m.class_id && (
                                <button onClick={() => navigate(isAdmin ? '/admin/classes' : '/uploads')}
                                  className="flex items-center gap-2 hover:underline w-full group">
                                  <div className={cn(
                                    'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0',
                                    isMine ? 'bg-white/15' : 'bg-accent/10',
                                  )}>
                                    <GraduationCap className={cn('w-3 h-3', isMine ? 'text-white/80' : 'text-accent')} />
                                  </div>
                                  <span className="font-medium truncate group-hover:opacity-80 transition-opacity">{m.class_name || 'Class'}</span>
                                </button>
                              )}
                              {m.teacher_ref_id && (
                                <button onClick={() => navigate('/admin/teachers')}
                                  className="flex items-center gap-2 hover:underline w-full group">
                                  <div className={cn(
                                    'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0',
                                    isMine ? 'bg-white/15' : 'bg-emerald-500/10',
                                  )}>
                                    <Users className={cn('w-3 h-3', isMine ? 'text-white/80' : 'text-emerald-600 dark:text-emerald-400')} />
                                  </div>
                                  <span className="font-medium truncate group-hover:opacity-80 transition-opacity">{m.teacher_ref_name || 'Teacher'}</span>
                                </button>
                              )}
                            </div>
                          )}
                          {m.body}
                        </div>

                        {/* Timestamp + Read receipt */}
                        <div className={cn(
                          'flex items-center gap-1 mt-[3px]',
                          isMine ? 'justify-end mr-0.5' : 'justify-start ml-1',
                        )}>
                          <span className={cn(
                            'text-[10px] leading-none',
                            isMine ? 'text-text-tertiary' : 'text-text-tertiary',
                          )}>
                            {formatMessageTime(m.created_at)}
                          </span>
                          {isMine && (
                            <span className="inline-flex items-center">
                              <svg width="13" height="9" viewBox="0 0 13 9" fill="none">
                                {m.read ? (
                                  <>
                                    <path d="M1.5 4.5L3.5 6.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent" />
                                    <path d="M7 4.5L9 6.5L12.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent" />
                                  </>
                                ) : (
                                  <path d="M1.5 4.5L3.5 6.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary" />
                                )}
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : selectedPartner ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-background-secondary flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-text-tertiary" />
                </div>
                <p className="text-[15px] font-medium text-text-secondary">No messages yet</p>
                <p className="text-[13px] text-text-tertiary mt-1">Type a message below to start the conversation</p>
              </div>
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center h-full text-center px-6 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-background-secondary flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-text-tertiary" />
                </div>
                <p className="text-[17px] font-medium text-text-secondary">Select a conversation</p>
                <p className="text-[14px] text-text-tertiary mt-1">Choose from your conversations on the left</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Send error */}
          {sendError && (
            <div className="mx-4 mb-2 px-3 py-2 text-[11px] text-status-rejected bg-status-rejected-bg border border-status-rejected/20 rounded-lg animate-slide-down">
              {sendError}
            </div>
          )}

          {/* ── Compose Area ── */}
          <div className="flex-shrink-0 border-t border-border bg-surface">
            {/* Reference chips */}
            {(subjectRef || imageRef || teacherRef || classRef) && (
              <div className="flex items-center gap-1.5 px-4 pt-2.5 pb-1 flex-wrap">
                {subjectRef && (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium bg-accent/10 text-accent px-3 py-1 rounded-full border border-accent/15 animate-scale-in">
                    <BookOpen className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[110px]">{subjectRef.name}</span>
                    <button onClick={removeRef} className="ml-0.5 hover:bg-accent/10 rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
                  </div>
                )}
                {imageRef && (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full border border-amber-500/15 animate-scale-in">
                    <ImageIcon className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[110px]">{imageRef.title}</span>
                    <button onClick={removeRef} className="ml-0.5 hover:bg-amber-500/10 rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
                  </div>
                )}
                {teacherRef && (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/15 animate-scale-in">
                    <Users className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[110px]">{teacherRef.name}</span>
                    <button onClick={removeRef} className="ml-0.5 hover:bg-emerald-500/10 rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
                  </div>
                )}
                {classRef && (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium bg-accent/10 text-accent px-3 py-1 rounded-full border border-accent/15 animate-scale-in">
                    <GraduationCap className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[110px]">{classRef.name}</span>
                    <button onClick={removeRef} className="ml-0.5 hover:bg-accent/10 rounded-full p-0.5 transition-colors"><X className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-end gap-2 px-4 py-3">
              {/* Attachment button */}
              <div ref={pickerRef} className="relative">
                <button
                  onClick={openRefPicker}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-text-tertiary hover:text-accent hover:bg-accent/8 transition-all duration-fast active:scale-90 flex-shrink-0"
                >
                  <Paperclip className="w-5 h-5" />
                </button>

                {/* Reference picker */}
                {showRefPicker && (
                  <div className="absolute bottom-full mb-2 left-0 w-[320px] bg-surface border border-border rounded-2xl shadow-lg max-h-[300px] overflow-y-auto z-50 animate-scale-in origin-bottom-left">
                    {/* Tabs */}
                    <div className="grid grid-cols-4 gap-1 p-2 bg-background-secondary mx-3 mt-3 rounded-xl">
                      {(['subjects', 'images', 'teachers', 'classes'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setRefTab(tab)}
                          className={cn(
                            'text-[11px] font-semibold py-1.5 rounded-lg transition-all duration-fast capitalize tracking-tight',
                            refTab === tab
                              ? 'bg-surface text-text-primary shadow-sm border border-border/50'
                              : 'text-text-tertiary hover:text-text-secondary',
                          )}
                        >
                          {tab === 'images' ? 'Uploads' : tab}
                        </button>
                      ))}
                    </div>
                    {/* List */}
                    <div className="py-1">
                      {refTab === 'subjects' && (
                        availableSubjects.length > 0 ? availableSubjects.map(s => (
                          <button key={s.subject_id} onClick={() => selectSubjectRef(s)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-background-secondary transition-colors group"
                            style={{ minHeight: '44px' }}>
                            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-4 h-4 text-accent" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-text-primary truncate group-hover:text-accent transition-colors">{s.subject_name}</p>
                              <p className="text-[11px] text-text-tertiary">{s.class_name}</p>
                            </div>
                          </button>
                        )) : <p className="text-[13px] text-text-tertiary text-center py-10">No subjects available</p>
                      )}
                      {refTab === 'images' && (
                        availableImages.length > 0 ? availableImages.map(img => (
                          <button key={img.id} onClick={() => selectImageRef(img)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-background-secondary transition-colors group"
                            style={{ minHeight: '44px' }}>
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-text-primary truncate group-hover:text-accent transition-colors">{img.title}</p>
                              <p className="text-[11px] text-text-tertiary">Image #{img.id}</p>
                            </div>
                          </button>
                        )) : <p className="text-[13px] text-text-tertiary text-center py-10">No images available</p>
                      )}
                      {refTab === 'teachers' && (
                        availableTeachers.length > 0 ? availableTeachers.map(t => (
                          <button key={t.id} onClick={() => selectTeacherRef(t)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-background-secondary transition-colors group"
                            style={{ minHeight: '44px' }}>
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                              <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-text-primary truncate group-hover:text-accent transition-colors">{t.full_name}</p>
                              <p className="text-[11px] text-text-tertiary">{t.email}</p>
                            </div>
                          </button>
                        )) : <p className="text-[13px] text-text-tertiary text-center py-10">No teachers found</p>
                      )}
                      {refTab === 'classes' && (
                        availableClasses.length > 0 ? availableClasses.map(c => (
                          <button key={c.id} onClick={() => selectClassRef(c)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-background-secondary transition-colors group"
                            style={{ minHeight: '44px' }}>
                            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                              <GraduationCap className="w-4 h-4 text-accent" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-text-primary truncate group-hover:text-accent transition-colors">{c.name}</p>
                              {c.section && <p className="text-[11px] text-text-tertiary">Section {c.section}</p>}
                            </div>
                          </button>
                        )) : <p className="text-[13px] text-text-tertiary text-center py-10">No classes found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Text input */}
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={e => { setInputText(e.target.value); autoGrowTextarea() }}
                  onKeyDown={handleKeyDown}
                  placeholder="Message\u2026"
                  rows={1}
                  className="w-full py-[10px] px-4 text-[15px] bg-background-secondary border border-border rounded-2xl text-text-primary placeholder:text-text-tertiary outline-none transition-shadow duration-fast focus:border-accent focus:shadow-[0_0_0_3px_hsl(var(--accent)/0.1)] resize-none overflow-y-auto leading-snug"
                  style={{ maxHeight: '120px' }}
                />
              </div>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
                className="w-9 h-9 flex items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-fast active:scale-90 flex-shrink-0 shadow-sm"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
