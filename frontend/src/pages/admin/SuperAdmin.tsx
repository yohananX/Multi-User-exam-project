import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, GraduationCap, BookOpen, Plus, Trash2, X, Check, Search,
  ChevronDown, ChevronRight, Shield, ShieldAlert, ShieldCheck, Loader2,
  UserPlus, School, ChevronUp, Eye,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { usersApi, classesApi, subjectsApi } from '@/api/endpoints'
import { cn } from '@/lib/utils'
import type { User } from '@/types'

const ROLE_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  super_admin: { label: 'Super Admin', bg: 'bg-[hsl(262_80%_97%)]', color: 'text-[hsl(262_80%_58%)]' },
  school_admin: { label: 'School Admin', bg: 'bg-accent-subtle', color: 'text-accent' },
  teacher: { label: 'Teacher', bg: 'bg-status-completed-bg', color: 'text-status-completed' },
}

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let pw = ''
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

export default function SuperAdmin() {
  const { user: authUser } = useAuth()
  const navigate = useNavigate()

  if (authUser?.role !== 'super_admin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <ShieldAlert className="w-10 h-10 text-status-rejected" />
        <p className="text-[15px] text-text-secondary">Super Admin access only.</p>
      </div>
    )
  }

  return <SuperAdminPanel />
}

function SuperAdminPanel() {
  const navigate = useNavigate()

  // ─── Users ──────────────────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userSearch, setUserSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set())
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ full_name: '', email: '', role: 'teacher' as string })
  const [newUserPassword, setNewUserPassword] = useState(generatePassword())
  const [creating, setCreating] = useState(false)
  const [deletingUsers, setDeletingUsers] = useState<Set<number>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [userError, setUserError] = useState('')
  const [userSuccess, setUserSuccess] = useState('')
  const [usersOpen, setUsersOpen] = useState(true)

  // ─── Classes ────────────────────────────────────────────────────────
  const [classes, setClasses] = useState<any[]>([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [showAddClass, setShowAddClass] = useState(false)
  const [newClass, setNewClass] = useState({ name: '', section: '' })
  const [creatingClass, setCreatingClass] = useState(false)
  const [deletingClasses, setDeletingClasses] = useState<Set<number>>(new Set())
  const [expandedClasses, setExpandedClasses] = useState<Set<number>>(new Set())
  const [classError, setClassError] = useState('')
  const [classesOpen, setClassesOpen] = useState(true)

  // ─── Subjects (per expanded class) ─────────────────────────────────
  const [subjectsMap, setSubjectsMap] = useState<Record<number, any[]>>({})
  const [subjectsLoading, setSubjectsLoading] = useState<Set<number>>(new Set())
  const [showAddSubject, setShowAddSubject] = useState<Record<number, boolean>>({})
  const [newSubjectName, setNewSubjectName] = useState('')
  const [creatingSubject, setCreatingSubject] = useState<Record<number, boolean>>({})
  const [deletingSubjects, setDeletingSubjects] = useState<Set<number>>(new Set())

  // ─── Load users ────────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await usersApi.list()
      setUsers(res.data)
    } catch { /* ignore */ }
    setUsersLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  // ─── Load classes ──────────────────────────────────────────────────
  const loadClasses = useCallback(async () => {
    setClassesLoading(true)
    try {
      const res = await classesApi.list()
      setClasses(res.data)
    } catch { /* ignore */ }
    setClassesLoading(false)
  }, [])

  useEffect(() => { loadClasses() }, [loadClasses])

  // ─── Load subjects for a class ─────────────────────────────────────
  const loadSubjects = useCallback(async (classId: number) => {
    setSubjectsLoading(prev => new Set(prev).add(classId))
    try {
      const res = await subjectsApi.list(classId)
      setSubjectsMap(prev => ({ ...prev, [classId]: res.data }))
    } catch { /* ignore */ }
    setSubjectsLoading(prev => { const n = new Set(prev); n.delete(classId); return n })
  }, [])

  // ─── Filtered users ────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users
    const q = userSearch.toLowerCase()
    return users.filter(u =>
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    )
  }, [users, userSearch])

  // ─── Toggle user select ────────────────────────────────────────────
  const toggleUser = (id: number) => {
    setSelectedUsers(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const toggleAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)))
    }
  }

  // ─── Create user ───────────────────────────────────────────────────
  const handleCreateUser = async () => {
    if (!newUser.full_name.trim() || !newUser.email.trim()) {
      setUserError('Name and email required')
      return
    }
    setCreating(true)
    setUserError('')
    try {
      await usersApi.create({
        full_name: newUser.full_name,
        email: newUser.email,
        username: newUser.email.split('@')[0],
        role: newUser.role as any,
        password: newUserPassword,
      })
      setUserSuccess(`Created ${newUser.full_name} as ${newUser.role.replace('_', ' ')}`)
      setNewUser({ full_name: '', email: '', role: 'teacher' })
      setNewUserPassword(generatePassword())
      setShowAddUser(false)
      loadUsers()
      setTimeout(() => setUserSuccess(''), 3000)
    } catch (e: any) {
      setUserError(e?.message || 'Failed to create user')
    }
    setCreating(false)
  }

  // ─── Delete user ───────────────────────────────────────────────────
  const handleDeleteUser = async (id: number) => {
    setDeletingUsers(prev => new Set(prev).add(id))
    try {
      await usersApi.delete(id)
      setUsers(prev => prev.filter(u => u.id !== id))
      setSelectedUsers(prev => { const n = new Set(prev); n.delete(id); return n })
    } catch { /* ignore */ }
    setDeletingUsers(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  // ─── Bulk delete users ─────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedUsers.size === 0) return
    setBulkDeleting(true)
    try {
      await Promise.all(Array.from(selectedUsers).map(id => usersApi.delete(id)))
      setUsers(prev => prev.filter(u => !selectedUsers.has(u.id)))
      setSelectedUsers(new Set())
    } catch { /* ignore */ }
    setBulkDeleting(false)
  }

  // ─── Create class ──────────────────────────────────────────────────
  const handleCreateClass = async () => {
    if (!newClass.name.trim()) {
      setClassError('Class name required')
      return
    }
    setCreatingClass(true)
    setClassError('')
    try {
      await classesApi.create({ name: newClass.name, section: newClass.section || undefined, school_id: 0 })
      setNewClass({ name: '', section: '' })
      setShowAddClass(false)
      loadClasses()
    } catch (e: any) {
      setClassError(e?.message || 'Failed to create class')
    }
    setCreatingClass(false)
  }

  // ─── Delete class ──────────────────────────────────────────────────
  const handleDeleteClass = async (id: number) => {
    setDeletingClasses(prev => new Set(prev).add(id))
    try {
      await classesApi.delete(id)
      setClasses(prev => prev.filter(c => c.id !== id))
    } catch { /* ignore */ }
    setDeletingClasses(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  // ─── Toggle class expand ──────────────────────────────────────────
  const toggleClass = (id: number) => {
    setExpandedClasses(prev => {
      const n = new Set(prev)
      if (n.has(id)) { n.delete(id); return n }
      n.add(id)
      return n
    })
    if (!subjectsMap[id]) loadSubjects(id)
  }

  // ─── Create subject ────────────────────────────────────────────────
  const handleCreateSubject = async (classId: number) => {
    if (!newSubjectName.trim()) return
    setCreatingSubject(prev => ({ ...prev, [classId]: true }))
    try {
      await subjectsApi.create({ name: newSubjectName, class_id: classId })
      setNewSubjectName('')
      setShowAddSubject(prev => ({ ...prev, [classId]: false }))
      loadSubjects(classId)
    } catch { /* ignore */ }
    setCreatingSubject(prev => ({ ...prev, [classId]: false }))
  }

  // ─── Delete subject ────────────────────────────────────────────────
  const handleDeleteSubject = async (classId: number, subjectId: number) => {
    setDeletingSubjects(prev => new Set(prev).add(subjectId))
    try {
      await subjectsApi.delete(subjectId)
      setSubjectsMap(prev => ({
        ...prev,
        [classId]: (prev[classId] || []).filter((s: any) => s.id !== subjectId),
      }))
    } catch { /* ignore */ }
    setDeletingSubjects(prev => { const n = new Set(prev); n.delete(subjectId); return n })
  }

  return (
    <div className="max-w-5xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Super Admin</h1>
        <p className="text-[15px] text-text-secondary mt-1">Manage users, classes, and subjects</p>
      </div>

      <div className="space-y-6">
        {/* ──────── USERS SECTION ──────── */}
        <section className="bg-surface rounded-[16px] shadow-card overflow-hidden">
          <button
            onClick={() => setUsersOpen(v => !v)}
            className="flex items-center gap-3 w-full px-6 h-12 hover:bg-background-secondary transition-colors duration-fast"
          >
            <Users className="w-5 h-5 text-accent" />
            <span className="text-[15px] font-semibold text-text-primary flex-1 text-left">
              Users <span className="text-text-tertiary font-normal">({users.length})</span>
            </span>
            {usersOpen ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
          </button>

          {usersOpen && (
            <div className="px-6 pb-5">
              {/* Success/Error messages */}
              {userSuccess && (
                <div className="flex items-center gap-2 mb-4 text-[13px] text-status-completed bg-status-completed-bg rounded-[8px] px-3 py-2">
                  <Check className="w-3.5 h-3.5" /> {userSuccess}
                </div>
              )}
              {userError && (
                <div className="flex items-center gap-2 mb-4 text-[13px] text-status-rejected bg-status-rejected/10 rounded-[8px] px-3 py-2">
                  <X className="w-3.5 h-3.5" /> {userError}
                </div>
              )}

              {/* Toolbar */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary" />
                  <input
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full h-9 pl-8 pr-3 rounded-[8px] bg-background-secondary border border-border text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
                  />
                </div>
                <button
                  onClick={() => { setShowAddUser(v => !v); setUserError('') }}
                  className="h-9 px-3 rounded-[8px] text-[13px] font-medium bg-accent text-accent-foreground hover:bg-accent-hover transition-colors flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Add User
                </button>
                {selectedUsers.size > 0 && (
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="h-9 px-3 rounded-[8px] text-[13px] font-medium bg-status-rejected text-white hover:bg-red-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete {selectedUsers.size}
                  </button>
                )}
              </div>

              {/* Add User inline form */}
              {showAddUser && (
                <div className="mb-4 p-4 rounded-[12px] bg-background-secondary border border-border space-y-3 animate-slide-up">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-text-tertiary mb-1">Full Name</label>
                      <input
                        value={newUser.full_name}
                        onChange={e => setNewUser(f => ({ ...f, full_name: e.target.value }))}
                        placeholder="e.g. Jane Doe"
                        className="w-full h-9 px-3 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-text-tertiary mb-1">Email</label>
                      <input
                        value={newUser.email}
                        onChange={e => setNewUser(f => ({ ...f, email: e.target.value }))}
                        placeholder="e.g. jane@school.com"
                        className="w-full h-9 px-3 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-text-tertiary mb-1">Role</label>
                      <select
                        value={newUser.role}
                        onChange={e => setNewUser(f => ({ ...f, role: e.target.value }))}
                        className="w-full h-9 px-3 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary outline-none focus:border-accent transition-colors"
                      >
                        <option value="teacher">Teacher</option>
                        <option value="school_admin">School Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-text-tertiary mb-1">Password</label>
                      <div className="flex gap-2">
                        <input
                          value={newUserPassword}
                          onChange={e => setNewUserPassword(e.target.value)}
                          className="flex-1 h-9 px-3 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary outline-none focus:border-accent transition-colors font-mono"
                        />
                        <button
                          onClick={() => setNewUserPassword(generatePassword())}
                          className="h-9 px-2.5 rounded-[8px] text-[11px] font-medium bg-background-tertiary text-text-secondary hover:bg-background-secondary transition-colors flex-shrink-0"
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => { setShowAddUser(false); setUserError('') }}
                      className="h-8 px-3 rounded-[8px] text-[13px] text-text-secondary hover:bg-background-secondary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateUser}
                      disabled={creating}
                      className="h-8 px-4 rounded-[8px] text-[13px] font-medium bg-accent text-accent-foreground hover:bg-accent-hover transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Create User
                    </button>
                  </div>
                </div>
              )}

              {/* Users table */}
              {usersLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-12 rounded-[8px] bg-background-secondary" />
                  ))}
                </div>
              ) : filteredUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-text-tertiary text-[11px] font-medium uppercase tracking-[0.04em]">
                        <th className="w-10 px-2 py-2 text-left">
                          <input
                            type="checkbox"
                            checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}
                            onChange={toggleAll}
                            className="rounded accent-accent"
                          />
                        </th>
                        <th className="px-2 py-2 text-left">Name</th>
                        <th className="px-2 py-2 text-left hidden sm:table-cell">Email</th>
                        <th className="px-2 py-2 text-left">Role</th>
                        <th className="w-12 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u, idx) => {
                        const rs = ROLE_STYLES[u.role] || ROLE_STYLES.teacher
                        const deleting = deletingUsers.has(u.id)
                        return (
                          <tr
                            key={u.id}
                            className={cn(
                              'border-b border-border/50 transition-colors',
                              selectedUsers.has(u.id) ? 'bg-accent/4' : 'hover:bg-background-secondary',
                              deleting && 'opacity-40',
                            )}
                          >
                            <td className="px-2 py-2.5">
                              <input
                                type="checkbox"
                                checked={selectedUsers.has(u.id)}
                                onChange={() => toggleUser(u.id)}
                                className="rounded accent-accent"
                              />
                            </td>
                            <td className="px-2 py-2.5 font-medium text-text-primary">{u.full_name}</td>
                            <td className="px-2 py-2.5 text-text-secondary hidden sm:table-cell">{u.email}</td>
                            <td className="px-2 py-2.5">
                              <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', rs.bg, rs.color)}>
                                {rs.label}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-right">
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                disabled={deleting}
                                className="p-1.5 rounded-sm text-text-tertiary hover:text-status-rejected hover:bg-status-rejected/10 transition-colors disabled:opacity-30"
                                title="Delete user"
                              >
                                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Users className="w-8 h-8 text-text-tertiary mb-2" />
                  <p className="text-[14px] text-text-secondary">No users found</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ──────── CLASSES SECTION ──────── */}
        <section className="bg-surface rounded-[16px] shadow-card overflow-hidden">
          <button
            onClick={() => setClassesOpen(v => !v)}
            className="flex items-center gap-3 w-full px-6 h-12 hover:bg-background-secondary transition-colors duration-fast"
          >
            <GraduationCap className="w-5 h-5 text-accent" />
            <span className="text-[15px] font-semibold text-text-primary flex-1 text-left">
              Classes <span className="text-text-tertiary font-normal">({classes.length})</span>
            </span>
            {classesOpen ? <ChevronUp className="w-4 h-4 text-text-tertiary" /> : <ChevronDown className="w-4 h-4 text-text-tertiary" />}
          </button>

          {classesOpen && (
            <div className="px-6 pb-5">
              {classError && (
                <div className="flex items-center gap-2 mb-4 text-[13px] text-status-rejected bg-status-rejected/10 rounded-[8px] px-3 py-2">
                  <X className="w-3.5 h-3.5" /> {classError}
                </div>
              )}

              {/* Add Class inline form */}
              {showAddClass && (
                <div className="mb-4 p-4 rounded-[12px] bg-background-secondary border border-border space-y-3 animate-slide-up">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-text-tertiary mb-1">Class Name</label>
                      <input
                        value={newClass.name}
                        onChange={e => setNewClass(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. SS 1"
                        className="w-full h-9 px-3 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-text-tertiary mb-1">Section (optional)</label>
                      <input
                        value={newClass.section}
                        onChange={e => setNewClass(f => ({ ...f, section: e.target.value }))}
                        placeholder="e.g. A"
                        className="w-full h-9 px-3 rounded-[8px] bg-surface border border-border text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => { setShowAddClass(false); setClassError('') }}
                      className="h-8 px-3 rounded-[8px] text-[13px] text-text-secondary hover:bg-background-secondary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateClass}
                      disabled={creatingClass}
                      className="h-8 px-4 rounded-[8px] text-[13px] font-medium bg-accent text-accent-foreground hover:bg-accent-hover transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {creatingClass ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Create Class
                    </button>
                  </div>
                </div>
              )}

              {!showAddClass && (
                <button
                  onClick={() => setShowAddClass(true)}
                  className="mb-4 h-9 px-3 rounded-[8px] text-[13px] font-medium bg-accent text-accent-foreground hover:bg-accent-hover transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Class
                </button>
              )}

              {/* Classes list */}
              {classesLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 rounded-[8px] bg-background-secondary" />
                  ))}
                </div>
              ) : classes.length > 0 ? (
                <div className="space-y-1">
                  {classes.map(cls => {
                    const deleting = deletingClasses.has(cls.id)
                    const expanded = expandedClasses.has(cls.id)
                    const subjects = subjectsMap[cls.id] || []
                    const subLoading = subjectsLoading.has(cls.id)
                    return (
                      <div key={cls.id} className={cn(deleting && 'opacity-40')}>
                        <div className="flex items-center gap-3 px-3 h-11 rounded-[8px] hover:bg-background-secondary transition-colors group">
                          <button
                            onClick={() => toggleClass(cls.id)}
                            className="p-1 rounded-sm text-text-tertiary hover:text-text-secondary transition-colors"
                          >
                            {subLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : expanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <GraduationCap className="w-4 h-4 text-text-secondary flex-shrink-0" />
                          <span className="text-[14px] font-medium text-text-primary flex-1 truncate">
                            {cls.name}
                            {cls.section && <span className="text-text-tertiary font-normal"> · Section {cls.section}</span>}
                          </span>
                          <span className="text-[11px] text-text-tertiary bg-background-secondary rounded-full px-2 py-0.5">
                            {subjects.length} subject{subjects.length !== 1 ? 's' : ''}
                          </span>
                          <button
                            onClick={() => handleDeleteClass(cls.id)}
                            disabled={deleting}
                            className="p-1.5 rounded-sm text-text-tertiary hover:text-status-rejected hover:bg-status-rejected/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
                            title="Delete class"
                          >
                            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Expanded subjects */}
                        {expanded && (
                          <div className="ml-8 pl-4 border-l-2 border-border/50 space-y-0.5 py-1.5">
                            {subjects.map((subj: any) => {
                              const subDeleting = deletingSubjects.has(subj.id)
                              return (
                                <div
                                  key={subj.id}
                                  className={cn(
                                    'flex items-center gap-2 px-3 h-8 rounded-[6px] hover:bg-background-secondary transition-colors group/sub',
                                    subDeleting && 'opacity-40',
                                  )}
                                >
                                  <BookOpen className="w-3.5 h-3.5 text-text-tertiary flex-shrink-0" />
                                  <span
                                    onClick={() => navigate(`/admin/subjects/${subj.id}`)}
                                    className="text-[13px] text-text-primary flex-1 truncate cursor-pointer hover:text-accent transition-colors"
                                  >
                                    {subj.name}
                                  </span>
                                  <span className={cn(
                                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                                    subj.status === 'completed' ? 'bg-status-completed' :
                                    subj.status === 'active' ? 'bg-status-pending' : 'bg-text-tertiary',
                                  )} />
                                  <button
                                    onClick={() => handleDeleteSubject(cls.id, subj.id)}
                                    disabled={subDeleting}
                                    className="p-1 rounded-sm text-text-tertiary hover:text-status-rejected hover:bg-status-rejected/10 transition-colors opacity-0 group-hover/sub:opacity-100 disabled:opacity-30"
                                    title="Delete subject"
                                  >
                                    {subDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                  </button>
                                </div>
                              )
                            })}

                            {/* Add Subject inline */}
                            {showAddSubject[cls.id] ? (
                              <div className="flex items-center gap-2 px-3 py-1.5">
                                <input
                                  value={newSubjectName}
                                  onChange={e => setNewSubjectName(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleCreateSubject(cls.id)}
                                  placeholder="Subject name..."
                                  className="flex-1 h-8 px-2.5 rounded-[6px] bg-surface border border-border text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleCreateSubject(cls.id)}
                                  disabled={creatingSubject[cls.id]}
                                  className="h-8 px-2.5 rounded-[6px] text-[12px] font-medium bg-accent text-accent-foreground hover:bg-accent-hover transition-colors disabled:opacity-50 flex items-center gap-1"
                                >
                                  {creatingSubject[cls.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                  Add
                                </button>
                                <button
                                  onClick={() => { setShowAddSubject(p => ({ ...p, [cls.id]: false })); setNewSubjectName('') }}
                                  className="h-8 px-2 rounded-[6px] text-[12px] text-text-secondary hover:bg-background-secondary transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowAddSubject(p => ({ ...p, [cls.id]: true }))}
                                className="flex items-center gap-1.5 px-3 h-7 text-[12px] text-text-tertiary hover:text-accent hover:bg-background-secondary transition-colors rounded-[6px] w-full"
                              >
                                <Plus className="w-3 h-3" /> Add Subject
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <GraduationCap className="w-8 h-8 text-text-tertiary mb-2" />
                  <p className="text-[14px] text-text-secondary">No classes yet</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
