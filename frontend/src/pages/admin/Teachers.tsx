import { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Trash2, Loader2, Users, UserPlus, X, Clipboard, CheckCircle } from 'lucide-react';
import { adminApi, classesApi, subjectsApi, assignmentsApi } from '../../api/endpoints';
import { cn } from '@/lib/utils';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selected, setSelected] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const selectedTeacher = teachers.find(t => t.id === selected);

  // Create teacher modal
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [copied, setCopied] = useState(false);

  // Delete teacher (inline)
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Add assignment (single)
  const [newClassId, setNewClassId] = useState('');
  const [newSubjectId, setNewSubjectId] = useState('');
  const [addingAssignment, setAddingAssignment] = useState(false);
  const [addError, setAddError] = useState('');
  const [duplicateError, setDuplicateError] = useState('');

  // Batch mode
  const [batchMode, setBatchMode] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<number>>(new Set());
  const [batchAdding, setBatchAdding] = useState(false);

  // On-demand subjects
  const [availableSubjects, setAvailableSubjects] = useState<any[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subjectsLoadRef = useRef<number | null>(null);

  // ── Data loading ─────────────────────────────────────────────────

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      adminApi.teachers(),
      classesApi.list(),
    ]).then(([t, c]) => {
      setTeachers(t.data);
      setClasses(c.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const loadSubjects = useCallback(async (classId: number) => {
    if (subjectsLoadRef.current === classId) return;
    subjectsLoadRef.current = classId;
    setLoadingSubjects(true);
    try {
      const res = await subjectsApi.list(classId);
      setAvailableSubjects(res.data);
    } catch {
      setAvailableSubjects([]);
    }
    setLoadingSubjects(false);
  }, []);

  const selectTeacher = async (id: number) => {
    setSelected(id);
    setNewClassId('');
    setNewSubjectId('');
    setSelectedSubjects(new Set());
    setBatchMode(false);
    setAvailableSubjects([]);
    setLoadingAssignments(true);
    const res = await adminApi.teacherAssignments(id);
    setAssignments(res.data.map((a: any) => ({
      ...a,
      class_name: a.classes?.name || '',
      subject_name: a.subjects?.name || '',
    })));
    setLoadingAssignments(false);
  };

  // ── Password generation ──────────────────────────────────────────

  const handleGeneratePassword = () => {
    const pwd = generatePassword();
    setGeneratedPassword(pwd);
    setForm(f => ({ ...f, password: pwd }));
    setCopied(false);
  };

  const handleCopyPassword = async () => {
    if (generatedPassword) {
      try {
        await navigator.clipboard.writeText(generatedPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* ignore */ }
    }
  };

  // ── Create teacher ────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    try {
      const res = await adminApi.createTeacher({
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: 'teacher',
        username: form.email.split('@')[0],
        school_id: null,
      });
      setTeachers(prev => [res.data, ...prev]);
      setCreateSuccess('Teacher account created. They\'ll receive a confirmation email.');
      setForm({ full_name: '', email: '', password: '' });
      setGeneratedPassword('');
      setTimeout(() => {
        setShowForm(false);
        setCreateSuccess('');
      }, 1500);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('already registered') || msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('already in use')) {
        setCreateError('An account with this email already exists.');
      } else {
        setCreateError(msg || 'Failed to create teacher');
      }
    }
    setCreating(false);
  };

  // ── Delete teacher ────────────────────────────────────────────────

  const handleDeleteTeacher = async (id: number) => {
    try {
      setDeleteError('');
      await adminApi.deleteTeacher(id);
      if (selected === id) { setSelected(null); setAssignments([]); }
      setTeachers(prev => prev.filter(t => t.id !== id));
      setDeletingId(null);
    } catch {
      setDeleteError('Failed to delete');
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = setTimeout(() => {
        setDeleteError('');
        setDeletingId(null);
      }, 2000);
    }
  };

  // ── Remove assignment ─────────────────────────────────────────────

  const handleRemoveAssignment = async (id: number) => {
    const prev = assignments;
    setAssignments(prev => prev.filter(a => a.id !== id));
    try {
      await assignmentsApi.delete(id);
    } catch {
      setAddError('Failed to remove assignment');
      if (selected) {
        const res = await adminApi.teacherAssignments(selected);
        setAssignments(res.data.map((a: any) => ({
          ...a,
          class_name: a.classes?.name || '',
          subject_name: a.subjects?.name || '',
        })));
      } else {
        setAssignments(prev);
      }
    }
  };

  // ── Add single assignment ─────────────────────────────────────────

  const handleAddSingle = async () => {
    if (!selected || !newClassId || !newSubjectId) return;
    const exists = assignments.some(
      a => a.class_id === Number(newClassId) && a.subject_id === Number(newSubjectId)
    );
    if (exists) {
      setDuplicateError('Already assigned to this subject.');
      setTimeout(() => setDuplicateError(''), 3000);
      return;
    }
    setAddingAssignment(true);
    setAddError('');
    setDuplicateError('');
    try {
      const res = await assignmentsApi.create({
        teacher_id: selected,
        class_id: Number(newClassId),
        subject_id: Number(newSubjectId),
      });
      const cls = classes.find(c => c.id === Number(newClassId));
      const subj = availableSubjects.find(s => s.id === Number(newSubjectId));
      setAssignments(prev => [...prev, { ...res.data, class_name: cls?.name || '', subject_name: subj?.name || '' }]);
      setNewSubjectId('');
    } catch (err: any) {
      setAddError(err?.message || 'Failed to add assignment');
    }
    setAddingAssignment(false);
  };

  // ── Batch add assignments ─────────────────────────────────────────

  const handleBatchAdd = async () => {
    if (!selected || !newClassId || selectedSubjects.size === 0) return;
    setBatchAdding(true);
    setAddError('');
    try {
      const subjectIds = Array.from(selectedSubjects);
      const results = await Promise.all(
        subjectIds.map(subjectId =>
          assignmentsApi.create({
            teacher_id: selected,
            class_id: Number(newClassId),
            subject_id: subjectId,
          }).then(r => {
            const cls = classes.find(c => c.id === Number(newClassId));
            const subj = availableSubjects.find(s => s.id === subjectId);
            return { ...r.data, class_name: cls?.name || '', subject_name: subj?.name || '' };
          })
        )
      );
      setAssignments(prev => [...prev, ...results]);
      setNewClassId('');
      setNewSubjectId('');
      setSelectedSubjects(new Set());
      setAvailableSubjects([]);
      setBatchMode(false);
    } catch (err: any) {
      setAddError(err?.message || 'Failed to add assignments');
    }
    setBatchAdding(false);
  };

  // ── Class change handler ──────────────────────────────────────────

  const handleClassChange = (value: string) => {
    setNewClassId(value);
    setNewSubjectId('');
    setSelectedSubjects(new Set());
    if (value) {
      loadSubjects(Number(value));
    } else {
      setAvailableSubjects([]);
    }
  };

  const assignedSubjectIds = new Set(assignments.map(a => a.subject_id));

  const toggleSubject = (id: number) => {
    setSelectedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const avatarGradient = (name: string) => {
    const colors = [
      'from-accent to-purple-500',
      'from-blue-500 to-cyan-500',
      'from-orange-500 to-rose-500',
      'from-emerald-500 to-teal-500',
      'from-violet-500 to-pink-500',
      'from-amber-500 to-orange-500',
    ];
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[320px]">
      <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-0 animate-fade-in">
      {/* ── Header ── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-text-primary">Teachers</h1>
          <p className="text-[15px] text-text-secondary mt-1.5">{teachers.length} teacher{teachers.length !== 1 ? 's' : ''} across the school</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="h-11 px-5 rounded-xl bg-accent text-accent-foreground text-[14px] font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all duration-fast flex items-center gap-2 shadow-sm hover:shadow-md"
        >
          <UserPlus className="w-4 h-4" />
          Add Teacher
        </button>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Teachers List (glass card) ── */}
        <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="px-6 py-5 border-b border-border/60">
            <h2 className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
              All Teachers
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-accent/10 text-accent text-[11px] font-semibold">
                {teachers.length}
              </span>
            </h2>
          </div>
          <div className="divide-y divide-border/40">
            {teachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-background-secondary flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-text-tertiary" />
                </div>
                <p className="text-[15px] font-medium text-text-secondary">No teachers yet</p>
                <p className="text-[13px] text-text-tertiary mt-1">Add your first teacher to get started</p>
              </div>
            ) : teachers.map((t, idx) => (
              <div
                key={t.id}
                onClick={() => { if (deletingId !== t.id) selectTeacher(t.id) }}
                className={cn(
                  'group flex items-center justify-between px-6 py-4 cursor-pointer transition-all duration-200 animate-fade-in',
                  selected === t.id
                    ? 'bg-gradient-to-r from-accent/[0.07] to-transparent border-l-[3px] border-l-accent'
                    : 'hover:bg-background-secondary/60 border-l-[3px] border-l-transparent',
                )}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {deletingId === t.id ? (
                  <div className="flex items-center gap-3 w-full py-0.5">
                    <span className="text-[14px] text-text-primary font-medium">Delete {t.full_name}?</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTeacher(t.id) }}
                      className="text-[13px] text-status-rejected underline underline-offset-2 cursor-pointer bg-transparent border-none p-0 font-medium hover:text-status-rejected/80 transition-colors"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(null); setDeleteError('') }}
                      className="text-[13px] text-text-secondary underline underline-offset-2 cursor-pointer bg-transparent border-none p-0 hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                    {deleteError && <span className="text-[12px] text-status-rejected ml-1">{deleteError}</span>}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={cn(
                        'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-[15px] font-bold text-white flex-shrink-0 shadow-sm',
                        avatarGradient(t.full_name || ''),
                        selected === t.id && 'ring-2 ring-accent/30 ring-offset-2 ring-offset-surface',
                      )}>
                        {t.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary truncate">{t.full_name}</p>
                        <p className="text-[12px] text-text-tertiary truncate flex items-center gap-1.5 mt-0.5">
                          <span>@{t.username}</span>
                          <span className="w-1 h-1 rounded-full bg-border" />
                          <span>{t.email}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setDeletingId(t.id) }}
                      className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-status-rejected hover:bg-status-rejected/10 transition-all duration-fast flex-shrink-0 -mr-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Assignments Panel (glass card) ── */}
        <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '80ms' }}>
          {selected && selectedTeacher ? (
            <>
              <div className="px-6 py-5 border-b border-border/60">
                <div className="flex items-center gap-3.5">
                  <div className={cn(
                    'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center text-[15px] font-bold text-white flex-shrink-0 shadow-sm',
                    avatarGradient(selectedTeacher.full_name || ''),
                  )}>
                    {selectedTeacher.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[16px] font-semibold text-text-primary truncate">{selectedTeacher.full_name}</h2>
                    <p className="text-[13px] text-text-secondary truncate">{selectedTeacher.email}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-5">
                {loadingAssignments ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-12 rounded-xl bg-background-secondary animate-pulse" />
                    ))}
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-background-secondary flex items-center justify-center mb-3">
                      <Users className="w-6 h-6 text-text-tertiary" />
                    </div>
                    <p className="text-[14px] text-text-secondary font-medium">No subjects assigned yet</p>
                    <p className="text-[12px] text-text-tertiary mt-1">Assign a class and subject below</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary mb-3 flex items-center gap-2">
                      Teaching Assignments
                      <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-background-secondary text-text-tertiary text-[10px] font-semibold">
                        {assignments.length}
                      </span>
                    </p>
                    {assignments.map(a => (
                      <div key={a.id} className="group flex items-center justify-between px-4 py-3 rounded-xl bg-background-secondary/80 hover:bg-background-secondary transition-all duration-200">
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-semibold text-text-primary">{a.class_name}</span>
                          <span className="text-[13px] text-text-tertiary ml-1.5">· {a.subject_name}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveAssignment(a.id)}
                          className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-status-rejected hover:bg-status-rejected/10 transition-all duration-fast flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-5 border-t border-border/60 space-y-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary flex items-center gap-2">
                    {batchMode ? 'Batch Add Assignments' : 'Add Assignment'}
                    {!batchMode && (
                      <button
                        onClick={() => { setBatchMode(true); setNewSubjectId('') }}
                        className="text-[11px] font-normal normal-case text-accent hover:text-accent-hover bg-transparent border-none p-0 cursor-pointer tracking-normal"
                      >
                        Switch to batch
                      </button>
                    )}
                    {batchMode && (
                      <button
                        onClick={() => { setBatchMode(false); setSelectedSubjects(new Set()); setAvailableSubjects([]) }}
                        className="text-[11px] font-normal normal-case text-accent hover:text-accent-hover bg-transparent border-none p-0 cursor-pointer tracking-normal"
                      >
                        Switch to single
                      </button>
                    )}
                  </p>

                  {duplicateError && (
                    <div className="px-4 py-2.5 rounded-xl bg-status-pending/10 border border-status-pending/20 text-[13px] text-status-pending font-medium">
                      {duplicateError}
                    </div>
                  )}

                  {!batchMode ? (
                    <>
                      <div className="flex gap-2.5">
                        <select
                          value={newClassId}
                          onChange={e => handleClassChange(e.target.value)}
                          className="flex-1 h-10 px-3.5 rounded-xl bg-background-secondary border border-border/60 text-[13px] text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10"
                        >
                          <option value="">Select class...</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select
                          value={newSubjectId}
                          onChange={e => setNewSubjectId(e.target.value)}
                          disabled={!newClassId || loadingSubjects}
                          className="flex-1 h-10 px-3.5 rounded-xl bg-background-secondary border border-border/60 text-[13px] text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast disabled:opacity-40 disabled:cursor-not-allowed appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10"
                        >
                          <option value="">
                            {loadingSubjects ? 'Loading...' : 'Select subject...'}
                          </option>
                          {availableSubjects.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddSingle}
                          disabled={!newClassId || !newSubjectId || addingAssignment}
                          className="h-10 px-5 rounded-xl bg-accent text-accent-foreground text-[13px] font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all duration-fast disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-1.5 shadow-sm"
                        >
                          {addingAssignment ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          Assign
                        </button>
                      </div>
                      {addError && <p className="text-[13px] text-status-rejected font-medium">{addError}</p>}
                    </>
                  ) : (
                    <>
                      <select
                        value={newClassId}
                        onChange={e => handleClassChange(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl bg-background-secondary border border-border/60 text-[13px] text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23999%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10"
                      >
                        <option value="">Select a class...</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>

                      {newClassId && (
                        <>
                          <div className="flex items-center justify-between bg-background-secondary/60 rounded-xl px-4 py-2.5">
                            <p className="text-[13px] text-text-secondary font-medium">Subjects:</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedSubjects(new Set(availableSubjects.map(s => s.id)))}
                                className="text-[11px] px-3 py-1.5 rounded-lg bg-accent/10 text-accent font-semibold hover:bg-accent/20 active:scale-95 transition-all"
                              >
                                Select All
                              </button>
                              <button
                                onClick={() => setSelectedSubjects(new Set())}
                                className="text-[11px] px-3 py-1.5 rounded-lg bg-background-secondary text-text-tertiary font-medium hover:text-text-secondary hover:bg-background-tertiary active:scale-95 transition-all"
                              >
                                None
                              </button>
                            </div>
                          </div>

                          {loadingSubjects ? (
                            <div className="flex flex-wrap gap-2">
                              {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-9 w-28 rounded-xl bg-background-secondary animate-pulse" />
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {availableSubjects.length === 0 ? (
                                <p className="text-[13px] text-text-tertiary py-4 text-center w-full">No subjects in this class</p>
                              ) : availableSubjects.map(s => {
                                const isAssigned = assignedSubjectIds.has(s.id);
                                const isSelected = selectedSubjects.has(s.id);
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    disabled={isAssigned}
                                    onClick={() => !isAssigned && toggleSubject(s.id)}
                                    className={cn(
                                      'h-9 px-3.5 rounded-xl text-[13px] font-medium transition-all duration-fast border',
                                      isAssigned && 'opacity-40 cursor-not-allowed bg-background-secondary text-text-tertiary border-border/40',
                                      !isAssigned && isSelected && 'bg-accent text-accent-foreground border-accent shadow-sm',
                                      !isAssigned && !isSelected && 'bg-background-secondary text-text-secondary border-border/60 hover:bg-border/50 hover:border-accent/30',
                                    )}
                                  >
                                    {s.name}
                                    {isAssigned && ' (assigned)'}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <button
                            onClick={handleBatchAdd}
                            disabled={selectedSubjects.size === 0 || batchAdding}
                            className={cn(
                              'w-full h-10 rounded-xl text-[13px] font-semibold transition-all duration-fast flex items-center justify-center gap-1.5 active:scale-[0.98]',
                              selectedSubjects.size > 0 && !batchAdding
                                ? 'bg-accent text-accent-foreground hover:bg-accent-hover shadow-sm'
                                : 'bg-background-secondary text-text-tertiary cursor-not-allowed',
                            )}
                          >
                            {batchAdding ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Adding...
                              </>
                            ) : (
                              <>
                                <Plus className="w-4 h-4" />
                                Add All ({selectedSubjects.size})
                              </>
                            )}
                          </button>
                        </>
                      )}

                      {addError && <p className="text-[13px] text-status-rejected font-medium">{addError}</p>}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-background-secondary flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-text-tertiary" />
              </div>
              <p className="text-[16px] font-semibold text-text-secondary">Select a teacher</p>
              <p className="text-[13px] text-text-tertiary mt-1.5 max-w-[220px]">Click on a teacher to manage their class assignments</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Add Teacher Modal ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
          <div className="glass-dark rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-7 h-16 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-[17px] font-semibold text-text-primary">New Teacher</h2>
                  <p className="text-[12px] text-text-tertiary">Create a teacher account</p>
                </div>
              </div>
              <button
                onClick={() => { setShowForm(false); setCreateError(''); setCreateSuccess(''); setGeneratedPassword('') }}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-text-tertiary hover:bg-background-secondary/80 hover:text-text-secondary transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-7 space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Full Name</label>
                <input
                  placeholder="e.g. John Doe"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  disabled={creating}
                  className="w-full h-11 px-4 rounded-xl bg-background-secondary/80 border border-border/60 text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast disabled:opacity-50"
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Email</label>
                <input
                  type="email"
                  placeholder="e.g. john@school.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  disabled={creating}
                  className="w-full h-11 px-4 rounded-xl bg-background-secondary/80 border border-border/60 text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast disabled:opacity-50"
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Password</label>
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    placeholder="Set initial password"
                    value={form.password}
                    onChange={e => { setForm({ ...form, password: e.target.value }); setGeneratedPassword('') }}
                    disabled={creating}
                    className="flex-1 h-11 px-4 rounded-xl bg-background-secondary/80 border border-border/60 text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast disabled:opacity-50"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    disabled={creating}
                    className="h-11 px-4 rounded-xl bg-background-secondary/80 border border-border/60 text-[13px] text-accent font-semibold hover:bg-background-secondary hover:border-accent/30 transition-all duration-fast disabled:opacity-50 flex items-center gap-1.5 active:scale-[0.97]"
                  >
                    Generate
                  </button>
                </div>
                {generatedPassword && (
                  <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-background-secondary/80 border border-border/40">
                    <code className="text-[14px] text-text-primary font-mono font-medium flex-1 select-all tracking-wide">{generatedPassword}</code>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="flex items-center gap-1.5 text-[12px] text-accent hover:text-accent-hover font-semibold transition-colors bg-transparent border-none p-0 cursor-pointer"
                    >
                      {copied ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-status-completed" />
                          <span className="text-status-completed">Copied</span>
                        </>
                      ) : (
                        <>
                          <Clipboard className="w-4 h-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {createSuccess && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-status-completed/10 border border-status-completed/20 text-[13px] font-medium text-status-completed">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{createSuccess}</span>
                </div>
              )}
              {createError && (
                <div className="px-4 py-3 rounded-xl bg-status-rejected/10 border border-status-rejected/20 text-[13px] font-medium text-status-rejected">
                  {createError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setCreateError(''); setCreateSuccess(''); setGeneratedPassword('') }}
                  disabled={creating}
                  className="flex-1 h-11 rounded-xl bg-background-secondary/80 text-text-secondary text-[14px] font-semibold hover:bg-background-secondary active:scale-[0.98] transition-all duration-fast disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 h-11 rounded-xl bg-accent text-accent-foreground text-[14px] font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all duration-fast disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {creating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </span>
                  ) : 'Create Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
