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

  const deleteTimerRef = useRef<ReturnType<typeof setTimeout>>();
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
    </div>
  );

  return (
    <div className="max-w-6xl animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Teachers</h1>
          <p className="text-[15px] text-text-secondary mt-1">{teachers.length} teachers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="h-9 px-4 rounded-[10px] bg-accent text-accent-foreground text-[13px] font-medium hover:bg-accent-hover transition-colors duration-fast flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          Add Teacher
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teachers List */}
        <div className="bg-surface rounded-[16px] shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-[15px] font-semibold text-text-primary">
              All Teachers
              <span className="ml-2 text-[12px] text-text-tertiary font-normal">{teachers.length} total</span>
            </h2>
          </div>
          <div className="divide-y divide-border">
            {teachers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-8 h-8 text-text-tertiary mb-2" />
                <p className="text-[14px] text-text-secondary">No teachers yet</p>
              </div>
            ) : teachers.map(t => (
              <div
                key={t.id}
                onClick={() => { if (deletingId !== t.id) selectTeacher(t.id) }}
                className={cn(
                  'group flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors duration-150',
                  selected === t.id
                    ? 'bg-[hsl(var(--accent)/0.08)] border-l-2 border-l-accent'
                    : 'hover:bg-background-secondary border-l-2 border-l-transparent',
                )}
              >
                {deletingId === t.id ? (
                  <div className="flex items-center gap-2 w-full py-0.5">
                    <span className="text-[13px] text-text-primary">Delete {t.full_name}?</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTeacher(t.id) }}
                      className="text-[13px] text-status-rejected underline cursor-pointer bg-transparent border-none p-0"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingId(null); setDeleteError('') }}
                      className="text-[13px] text-text-secondary cursor-pointer bg-transparent border-none p-0"
                    >
                      Cancel
                    </button>
                    {deleteError && <span className="text-[12px] text-status-rejected ml-1">{deleteError}</span>}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-semibold flex-shrink-0',
                        selected === t.id ? 'bg-accent text-accent-foreground' : 'bg-accent-subtle text-accent',
                      )}>
                        {t.full_name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-text-primary truncate">{t.full_name}</p>
                        <p className="text-[12px] text-text-tertiary truncate">@{t.username} · {t.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); setDeletingId(t.id) }}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-sm text-text-tertiary hover:text-status-rejected hover:bg-status-rejected/10 transition-colors duration-fast flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Assignments Panel */}
        <div className="bg-surface rounded-[16px] shadow-card overflow-hidden">
          {selected && selectedTeacher ? (
            <>
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-[17px] font-semibold text-text-primary">{selectedTeacher.full_name}</h2>
                <p className="text-[13px] text-text-secondary mt-0.5">{selectedTeacher.email}</p>
              </div>
              <div className="p-5 space-y-5">
                {loadingAssignments ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-11 rounded-[10px] bg-background-secondary animate-pulse" />
                    ))}
                  </div>
                ) : assignments.length === 0 ? (
                  <p className="text-[13px] text-text-tertiary text-center py-4">No subjects assigned yet</p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary mb-2">
                      Teaching Assignments
                    </p>
                    {assignments.map(a => (
                      <div key={a.id} className="flex items-center justify-between px-3 py-2.5 rounded-[10px] bg-background-secondary">
                        <div className="flex-1 min-w-0">
                          <span className="text-[13px] font-medium text-text-primary">{a.class_name}</span>
                          <span className="text-[13px] text-text-secondary">{' \u00B7 '}{a.subject_name}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveAssignment(a.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-sm text-text-tertiary hover:text-status-rejected hover:bg-status-rejected/10 transition-colors duration-fast flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-border space-y-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-tertiary">
                    {batchMode ? 'Batch Add Assignments' : 'Add Assignment'}
                  </p>

                  {duplicateError && (
                    <p className="text-[12px] text-status-pending">{duplicateError}</p>
                  )}

                  {!batchMode ? (
                    <>
                      <div className="flex gap-2">
                        <select
                          value={newClassId}
                          onChange={e => handleClassChange(e.target.value)}
                          className="flex-1 h-9 px-3 rounded-[10px] bg-background-secondary border border-border text-[13px] text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast"
                        >
                          <option value="">Select class...</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select
                          value={newSubjectId}
                          onChange={e => setNewSubjectId(e.target.value)}
                          disabled={!newClassId || loadingSubjects}
                          className="flex-1 h-9 px-3 rounded-[10px] bg-background-secondary border border-border text-[13px] text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast disabled:opacity-40"
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
                          className="h-9 px-4 rounded-[10px] bg-accent text-accent-foreground text-[13px] font-medium hover:bg-accent-hover transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          {addingAssignment ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          Add
                        </button>
                      </div>
                      {addError && <p className="text-[12px] text-status-rejected">{addError}</p>}

                      <button
                        onClick={() => { setBatchMode(true); setNewSubjectId('') }}
                        className="text-[13px] text-accent hover:text-accent-hover transition-colors bg-transparent border-none p-0 cursor-pointer"
                      >
                        Batch add
                      </button>
                    </>
                  ) : (
                    <>
                      <select
                        value={newClassId}
                        onChange={e => handleClassChange(e.target.value)}
                        className="w-full h-9 px-3 rounded-[10px] bg-background-secondary border border-border text-[13px] text-text-primary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast"
                      >
                        <option value="">Select a class...</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>

                      {newClassId && (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] text-text-secondary font-medium">Subjects:</p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setSelectedSubjects(new Set(availableSubjects.map(s => s.id)))}
                                className="text-[11px] px-2 py-1 rounded-[6px] bg-accent/10 text-accent font-medium hover:bg-accent/20 transition-colors"
                              >
                                Select All
                              </button>
                              <button
                                onClick={() => setSelectedSubjects(new Set())}
                                className="text-[11px] px-2 py-1 rounded-[6px] bg-background-secondary text-text-tertiary hover:text-text-secondary transition-colors"
                              >
                                None
                              </button>
                            </div>
                          </div>

                          {loadingSubjects ? (
                            <div className="flex flex-wrap gap-2">
                              {[1, 2, 3, 4].map(i => (
                                <div key={i} className="h-8 w-24 rounded-[8px] bg-background-secondary animate-pulse" />
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {availableSubjects.length === 0 ? (
                                <p className="text-[12px] text-text-tertiary py-3 text-center w-full">No subjects in this class</p>
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
                                      'h-8 px-3 rounded-[8px] text-[13px] font-medium transition-all duration-fast border',
                                      isAssigned && 'opacity-40 cursor-not-allowed bg-background-secondary text-text-tertiary border-border',
                                      !isAssigned && isSelected && 'bg-accent text-accent-foreground border-accent',
                                      !isAssigned && !isSelected && 'bg-background-secondary text-text-secondary border-border hover:bg-border',
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
                              'w-full h-9 rounded-[10px] text-[13px] font-medium transition-all duration-fast flex items-center justify-center gap-1.5',
                              selectedSubjects.size > 0 && !batchAdding
                                ? 'bg-accent text-accent-foreground hover:bg-accent-hover'
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

                      <button
                        onClick={() => { setBatchMode(false); setSelectedSubjects(new Set()); setAvailableSubjects([]) }}
                        className="text-[13px] text-accent hover:text-accent-hover transition-colors bg-transparent border-none p-0 cursor-pointer"
                      >
                        Single add
                      </button>

                      {addError && <p className="text-[12px] text-status-rejected">{addError}</p>}
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Users className="w-10 h-10 text-text-tertiary mb-3" />
              <p className="text-[15px] text-text-secondary">Select a teacher</p>
              <p className="text-[12px] text-text-tertiary mt-1">Click on a teacher to manage their assignments</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Teacher Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-[20px] shadow-xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 h-14 border-b border-border">
              <h2 className="text-[17px] font-semibold text-text-primary">New Teacher</h2>
              <button
                onClick={() => { setShowForm(false); setCreateError(''); setCreateSuccess(''); setGeneratedPassword('') }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:bg-background-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Full Name</label>
                <input
                  placeholder="e.g. John Doe"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                  disabled={creating}
                  className="w-full h-10 px-3 rounded-[10px] bg-background-secondary border border-border text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast disabled:opacity-50"
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
                  className="w-full h-10 px-3 rounded-[10px] bg-background-secondary border border-border text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast disabled:opacity-50"
                  required
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Set initial password"
                    value={form.password}
                    onChange={e => { setForm({ ...form, password: e.target.value }); setGeneratedPassword('') }}
                    disabled={creating}
                    className="flex-1 h-10 px-3 rounded-[10px] bg-background-secondary border border-border text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast disabled:opacity-50"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    disabled={creating}
                    className="h-10 px-3 rounded-[10px] bg-background-secondary border border-border text-[13px] text-text-secondary font-medium hover:bg-border transition-colors duration-fast disabled:opacity-50 flex items-center gap-1"
                  >
                    Generate
                  </button>
                </div>
                {generatedPassword && (
                  <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-[8px] bg-background-secondary">
                    <code className="text-[13px] text-text-primary font-mono flex-1 select-all">{generatedPassword}</code>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="flex items-center gap-1 text-[12px] text-accent hover:text-accent-hover transition-colors bg-transparent border-none p-0 cursor-pointer"
                    >
                      {copied ? (
                        <CheckCircle className="w-3.5 h-3.5 text-status-completed" />
                      ) : (
                        <Clipboard className="w-3.5 h-3.5" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </div>

              {createSuccess && (
                <div className="flex items-center gap-1.5 text-[13px] text-status-completed">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>{createSuccess}</span>
                </div>
              )}
              {createError && (
                <p className="text-[13px] text-status-rejected">{createError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setCreateError(''); setCreateSuccess(''); setGeneratedPassword('') }}
                  disabled={creating}
                  className="flex-1 h-10 rounded-[10px] bg-background-secondary text-text-secondary text-[14px] font-medium hover:bg-border transition-colors duration-fast disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 h-10 rounded-[10px] bg-accent text-accent-foreground text-[14px] font-medium hover:bg-accent-hover transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating\u2026' : 'Create Teacher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
