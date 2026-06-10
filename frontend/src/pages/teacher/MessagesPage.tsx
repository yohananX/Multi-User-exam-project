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
    <div className="h-[calc(100vh-52px-40px)] lg:h-[calc(100vh-52px-64px)] flex bg-surface rounded-[16px] shadow-card overflow-hidden animate-fade-in">
      {/* ── Conversation List ── */}
      <div className={cn(
        'w-full lg:w-[320px] flex-shrink-0 border-r border-border flex flex-col bg-background',
        view === 'thread' && 'hidden lg:flex',
      )}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-border flex-shrink-0">
          <h2 className="text-[17px] font-semibold text-text-primary">Messages</h2>
          {unreadTotal > 0 && (
            <span className="text-xs text-accent font-medium">{unreadTotal} unread</span>
          )}
        </div>
        <div className="px-4 pt-3 pb-2 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-[10px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-[30px] pl-8 pr-3 text-sm bg-background-secondary border border-border rounded-full text-text-primary placeholder:text-text-tertiary outline-none transition-shadow duration-fast focus:border-accent focus:shadow-[0_0_0_3px_hsl(var(--accent)/0.1)]"
            />
          </div>
        </div>

        {!isAdmin && adminUsers.length > 0 && conversations.length === 0 && (
          <div className="px-4 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary mb-2">
              Administrators
            </p>
            {adminUsers.map(admin => (
              <button
                key={admin.auth_id}
                onClick={() => handleStartConversation(admin.auth_id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-left hover:bg-background-secondary transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-[hsl(262_80%_58%)] flex items-center justify-center flex-shrink-0">
                  <span className="text-[12px] font-semibold text-white">{getInitials(admin.full_name)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-text-primary truncate">{admin.full_name}</p>
                  <p className="text-[11px] text-text-tertiary">{admin.email}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(262_80%_58%/0.12)] text-[hsl(262_80%_58%)] font-medium">Admin</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredConvos.length > 0 ? (
            filteredConvos.map(c => {
              const isActive = c.partner_id === selectedPartner
              const hasUnread = c.unread_count > 0
              const lastMsg = c.last_message
              const partnerRole = partnerRoles[c.partner_id]
              const isPartnerAdmin = isAdminRole(partnerRole)
              const classCount = teacherClassCount[c.partner_id]
              return (
                <button
                  key={c.partner_id}
                  onClick={() => { setSelectedPartner(c.partner_id); setView('thread') }}
                  className={cn(
                    'w-full flex items-center gap-3 px-5 text-left transition-colors duration-150',
                    'border-l-2',
                    isActive
                      ? 'bg-[hsl(var(--accent)/0.08)] border-l-accent'
                      : 'border-l-transparent hover:bg-background-secondary',
                  )}
                  style={{ height: '68px' }}
                >
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                    isPartnerAdmin ? 'bg-[hsl(262_80%_58%)]' : 'bg-accent',
                  )}>
                    <span className="text-[12px] font-semibold text-accent-foreground">
                      {getInitials(c.partner_name)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0 self-center">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={cn(
                          'text-[14px] truncate',
                          hasUnread ? 'font-semibold text-text-primary' : 'font-medium text-text-secondary',
                        )}>
                          {c.partner_name}
                        </span>
                        {isPartnerAdmin && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(262_80%_58%/0.12)] text-[hsl(262_80%_58%)] font-medium flex-shrink-0">Admin</span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-tertiary flex-shrink-0">{formatRelativeTime(lastMsg.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={cn(
                        'text-[13px] truncate flex-1 max-w-[180px]',
                        hasUnread ? 'text-text-secondary' : 'text-text-tertiary',
                      )}>
                        {lastMsg.sender_id === userId ? 'You: ' : ''}{lastMsg.body}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isAdmin && classCount !== undefined && (
                          <span className="text-[11px] text-text-tertiary">{classCount} class{classCount !== 1 ? 'es' : ''}</span>
                        )}
                        {hasUnread && (
                          <span className="min-w-[18px] h-[18px] rounded-full bg-accent flex items-center justify-center px-1">
                            <span className="text-[11px] font-semibold text-accent-foreground leading-none">
                              {c.unread_count > 99 ? '99+' : c.unread_count}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <MessageSquare className="w-10 h-10 text-text-tertiary mb-3" />
              <p className="text-[15px] text-text-secondary mb-1">
                {searchQuery ? 'No conversations found' : 'No messages yet'}
              </p>
              <p className="text-[13px] text-text-tertiary">
                {searchQuery ? 'Try a different search term' : isAdmin ? 'Messages from teachers will appear here' : 'Admins will appear above to start a conversation'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Message Thread ── */}
      <div className={cn(
        'flex-1 flex flex-col min-w-0',
        view === 'list' && 'hidden lg:flex',
      )}>
        {/* Thread Header */}
        {selectedPartner ? (
          <div className="flex items-center gap-3 px-4 h-14 border-b border-border flex-shrink-0">
            <button
              onClick={() => setView('list')}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-sm text-text-secondary hover:bg-background-secondary transition-colors duration-fast"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
              isAdminRole(threadPartnerRole) ? 'bg-[hsl(262_80%_58%)]' : 'bg-accent',
            )}>
              <span className="text-[12px] font-semibold text-accent-foreground">{getInitials(threadPartnerName)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] font-medium text-text-primary truncate">{threadPartnerName}</p>
                {isAdminRole(threadPartnerRole) && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(262_80%_58%/0.12)] text-[hsl(262_80%_58%)] font-medium">Admin</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex items-center px-5 h-14 border-b border-border flex-shrink-0">
            <p className="text-[14px] font-medium text-text-secondary">{conversations.length > 0 ? 'Select a conversation' : 'New Message'}</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {selectedPartner && threadMessages.length > 0 ? (
            threadMessages.map((m, idx) => {
              const isMine = m.sender_id === userId
              const showDate = idx === 0 || new Date(m.created_at).toDateString() !== new Date(threadMessages[idx - 1].created_at).toDateString()
              const hasRef = m.subject_id || m.image_id || m.class_id || m.teacher_ref_id
              return (
                <div key={m.id}>
                  {showDate && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[13px] text-text-tertiary flex-shrink-0">{formatDateSeparator(m.created_at)}</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <div className={cn('flex', isMine ? 'justify-end' : 'justify-start', 'mb-1')}>
                    <div className="max-w-[70%]">
                      <div className={cn(
                        'px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap break-words',
                        isMine
                          ? 'bg-[hsl(var(--accent))] text-white rounded-[18px_18px_4px_18px]'
                          : 'bg-[hsl(var(--background-secondary))] text-text-primary rounded-[18px_18px_18px_4px]',
                      )}>
                        {hasRef && (
                          <div className={cn(
                            'rounded-lg p-2 text-[13px] mb-1.5 space-y-1',
                            isMine ? 'bg-white/15' : 'bg-background-tertiary',
                          )}>
                            {m.subject_id && (
                              <button onClick={() => navigate(isAdmin ? `/admin/subjects/${m.subject_id}` : `/subjects/${m.subject_id}`)}
                                className="flex items-center gap-2 hover:underline w-full">
                                <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="font-medium truncate">{m.subject_name || 'Subject'}</span>
                              </button>
                            )}
                            {m.image_id && (
                              <button onClick={() => navigate(isAdmin ? `/admin/subjects/${m.subject_id || ''}` : `/subjects/${m.subject_id || ''}`)}
                                className="flex items-center gap-2 hover:underline w-full">
                                <ImageIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="font-medium truncate">{m.image_title || 'Image'}</span>
                              </button>
                            )}
                            {m.class_id && (
                              <button onClick={() => navigate(isAdmin ? '/admin/classes' : '/uploads')}
                                className="flex items-center gap-2 hover:underline w-full">
                                <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="font-medium truncate">{m.class_name || 'Class'}</span>
                              </button>
                            )}
                            {m.teacher_ref_id && (
                              <button onClick={() => navigate('/admin/teachers')}
                                className="flex items-center gap-2 hover:underline w-full">
                                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="font-medium truncate">{m.teacher_ref_name || 'Teacher'}</span>
                              </button>
                            )}
                          </div>
                        )}
                        {m.body}
                      </div>
                      <div className={cn(
                        'flex items-center gap-1 mt-0.5',
                        isMine ? 'justify-end' : 'justify-start',
                      )}>
                        <span className="text-[11px] text-text-tertiary">{formatMessageTime(m.created_at)}</span>
                        {isMine && (
                          <span className="inline-flex items-center">
                            <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                              {m.read ? (
                                <>
                                  <path d="M1 4l2 2L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent" />
                                  <path d="M6 4l2 2L11 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent" />
                                </>
                              ) : (
                                <path d="M1 4l2 2L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary" />
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
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-14 h-14 rounded-full bg-background-secondary flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-7 h-7 text-text-tertiary" />
              </div>
              <p className="text-[15px] text-text-secondary max-w-[280px]">No messages yet</p>
              <p className="text-[13px] text-text-tertiary mt-1 max-w-[280px]">Type a message below</p>
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-full text-center px-6">
              <MessageSquare className="w-12 h-12 text-text-tertiary mb-3" />
              <p className="text-[17px] font-medium text-text-secondary">Select a conversation</p>
              <p className="text-[14px] text-text-tertiary mt-1">Or start a new one</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Send error */}
        {sendError && (
          <div className="px-4 py-2 text-xs text-status-rejected bg-status-rejected-bg">{sendError}</div>
        )}

        {/* Compose Area */}
        <div className="flex-shrink-0 border-t border-border bg-surface relative">
          {/* Reference chips */}
          {(subjectRef || imageRef || teacherRef || classRef) && (
            <div className="flex items-center gap-1.5 px-4 pt-2 pb-0 flex-wrap">
              {subjectRef && (
                <div className="flex items-center gap-1 text-[12px] bg-accent-subtle text-accent px-2.5 py-0.5 rounded-full h-7">
                  <BookOpen className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">{subjectRef.name.length > 20 ? subjectRef.name.slice(0, 20) + '...' : subjectRef.name}</span>
                  <button onClick={removeRef} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
                </div>
              )}
              {imageRef && (
                <div className="flex items-center gap-1 text-[12px] bg-accent-subtle text-accent px-2.5 py-0.5 rounded-full h-7">
                  <ImageIcon className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">{imageRef.title.length > 20 ? imageRef.title.slice(0, 20) + '...' : imageRef.title}</span>
                  <button onClick={removeRef} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
                </div>
              )}
              {teacherRef && (
                <div className="flex items-center gap-1 text-[12px] bg-status-completed-bg text-status-completed px-2.5 py-0.5 rounded-full h-7">
                  <Users className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">{teacherRef.name.length > 20 ? teacherRef.name.slice(0, 20) + '...' : teacherRef.name}</span>
                  <button onClick={removeRef} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
                </div>
              )}
              {classRef && (
                <div className="flex items-center gap-1 text-[12px] bg-accent-subtle text-accent px-2.5 py-0.5 rounded-full h-7">
                  <GraduationCap className="w-3 h-3" />
                  <span className="truncate max-w-[120px]">{classRef.name.length > 20 ? classRef.name.slice(0, 20) + '...' : classRef.name}</span>
                  <button onClick={removeRef} className="ml-0.5 hover:opacity-70"><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-end gap-2 px-4 py-3 relative">
            {/* Reference picker trigger */}
            <div ref={pickerRef}>
              <button
                onClick={openRefPicker}
                className="w-9 h-9 flex items-center justify-center rounded-full text-text-tertiary hover:bg-background-secondary transition-colors duration-fast"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {showRefPicker && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-surface border border-border rounded-[16px] shadow-lg max-h-[280px] overflow-y-auto z-50">
                  {/* Tabs */}
                  <div className="grid grid-cols-4 p-1.5 gap-1 bg-background-secondary mx-3 mt-3 rounded-[10px]">
                    {(['subjects', 'images', 'teachers', 'classes'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setRefTab(tab)}
                        className={cn(
                          'text-[11px] font-medium py-1.5 rounded-[8px] transition-all duration-fast capitalize',
                          refTab === tab ? 'bg-surface text-text-primary shadow-sm' : 'text-text-tertiary',
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
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-background-secondary transition-colors"
                          style={{ minHeight: '44px' }}>
                          <BookOpen className="w-4 h-4 text-accent flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-text-primary truncate">{s.subject_name}</p>
                            <p className="text-[11px] text-text-tertiary">{s.class_name}</p>
                          </div>
                        </button>
                      )) : <p className="text-[13px] text-text-tertiary text-center py-6">No subjects available</p>
                    )}
                    {refTab === 'images' && (
                      availableImages.length > 0 ? availableImages.map(img => (
                        <button key={img.id} onClick={() => selectImageRef(img)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-background-secondary transition-colors"
                          style={{ minHeight: '44px' }}>
                          <ImageIcon className="w-4 h-4 text-status-pending flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-text-primary truncate">{img.title}</p>
                            <p className="text-[11px] text-text-tertiary">Image #{img.id}</p>
                          </div>
                        </button>
                      )) : <p className="text-[13px] text-text-tertiary text-center py-6">No images available</p>
                    )}
                    {refTab === 'teachers' && (
                      availableTeachers.length > 0 ? availableTeachers.map(t => (
                        <button key={t.id} onClick={() => selectTeacherRef(t)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-background-secondary transition-colors"
                          style={{ minHeight: '44px' }}>
                          <Users className="w-4 h-4 text-status-completed flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-text-primary truncate">{t.full_name}</p>
                            <p className="text-[11px] text-text-tertiary">{t.email}</p>
                          </div>
                        </button>
                      )) : <p className="text-[13px] text-text-tertiary text-center py-6">No teachers found</p>
                    )}
                    {refTab === 'classes' && (
                      availableClasses.length > 0 ? availableClasses.map(c => (
                        <button key={c.id} onClick={() => selectClassRef(c)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-background-secondary transition-colors"
                          style={{ minHeight: '44px' }}>
                          <GraduationCap className="w-4 h-4 text-accent flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] text-text-primary truncate">{c.name}</p>
                            {c.section && <p className="text-[11px] text-text-tertiary">Section {c.section}</p>}
                          </div>
                        </button>
                      )) : <p className="text-[13px] text-text-tertiary text-center py-6">No classes found</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={e => { setInputText(e.target.value); autoGrowTextarea() }}
                onKeyDown={handleKeyDown}
                placeholder="Message\u2026"
                rows={1}
                className="w-full py-2.5 px-4 text-[15px] bg-background-secondary border border-border rounded-full text-text-primary placeholder:text-text-tertiary outline-none transition-shadow duration-fast focus:border-accent focus:shadow-[0_0_0_3px_hsl(var(--accent)/0.1)] resize-none overflow-y-auto"
                style={{ maxHeight: '120px' }}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-accent text-accent-foreground hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-fast flex-shrink-0"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
