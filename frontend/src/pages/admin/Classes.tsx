import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, BookOpen, FolderOpen, X, ExternalLink, Loader2 } from 'lucide-react';
import { classesApi, subjectsApi } from '../../api/endpoints';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '@/lib/utils';

export default function AdminClasses() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Class selection
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const selectedClass = classes.find(c => c.id === selectedClassId);

  // Create class (inline form)
  const [newClassName, setNewClassName] = useState('');
  const [newClassSection, setNewClassSection] = useState('');
  const [classError, setClassError] = useState('');

  // Delete class (inline)
  const [deletingClassId, setDeletingClassId] = useState<number | null>(null);

  // Create subject (modal)
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [subjectError, setSubjectError] = useState('');

  // Delete subject (inline)
  const [deletingSubjectId, setDeletingSubjectId] = useState<number | null>(null);

  // ── Data loading ─────────────────────────────────────────────────

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      classesApi.list(),
      subjectsApi.list(),
    ]).then(([c, s]) => {
      setClasses(c.data);
      setSubjects(s.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  const selectClass = async (id: number) => {
    setSelectedClassId(id);
    setLoadingSubjects(true);
    try {
      const res = await subjectsApi.list(id);
      setSubjects(res.data);
    } catch {
      setSubjects([]);
    }
    setLoadingSubjects(false);
  };

  // ── Create class ──────────────────────────────────────────────────

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassError('');
    if (!newClassName.trim()) return;
    const exists = classes.some(
      c => c.name === newClassName.trim() && (newClassSection ? c.section === newClassSection : !c.section)
    );
    if (exists) {
      setClassError('This class already exists.');
      return;
    }
    try {
      const res = await classesApi.create({
        name: newClassName.trim(),
        section: newClassSection.trim() || undefined,
        school_id: user?.school_id || 1,
      });
      setClasses(prev => [...prev, res.data]);
      setNewClassName('');
      setNewClassSection('');
      selectClass(res.data.id);
    } catch {
      setClassError('Failed to create class.');
    }
  };

  // ── Delete class ──────────────────────────────────────────────────

  const handleDeleteClass = async (id: number) => {
    try {
      await classesApi.delete(id);
      if (selectedClassId === id) { setSelectedClassId(null); setSubjects([]); }
      setClasses(prev => prev.filter(c => c.id !== id));
      setSubjects(prev => prev.filter(s => s.class_id !== id));
      setDeletingClassId(null);
    } catch { /* ignore */ }
  };

  // ── Create subject ────────────────────────────────────────────────

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubjectError('');
    if (!newSubjectName.trim() || !selectedClassId) return;
    const exists = subjects.some(s => s.name === newSubjectName.trim() && s.class_id === selectedClassId);
    if (exists) {
      setSubjectError('A subject with this name already exists in this class.');
      return;
    }
    setCreatingSubject(true);
    try {
      const res = await subjectsApi.create({ name: newSubjectName.trim(), class_id: selectedClassId });
      setSubjects(prev => [...prev, res.data]);
      setShowSubjectForm(false);
      setNewSubjectName('');
    } catch {
      setSubjectError('Failed to create subject.');
    }
    setCreatingSubject(false);
  };

  // ── Delete subject ────────────────────────────────────────────────

  const handleDeleteSubject = async (id: number) => {
    try {
      await subjectsApi.delete(id);
      setSubjects(prev => prev.filter(s => s.id !== id));
      setDeletingSubjectId(null);
    } catch { /* ignore */ }
  };

  const subjectCountForClass = (classId: number) => subjects.filter(s => s.class_id === classId).length;

  const classIconGradient = (name: string) => {
    const colors = [
      'from-accent to-blue-600',
      'from-emerald-500 to-teal-500',
      'from-orange-500 to-rose-500',
      'from-violet-500 to-purple-500',
      'from-cyan-500 to-blue-500',
      'from-pink-500 to-rose-500',
    ];
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[320px]">
      <div className="space-y-3 w-full max-w-lg">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-14 rounded-xl skeleton" />
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-0 animate-fade-in">
      {/* ── Header ── */}
      <div className="mb-8">
        <h1 className="text-[32px] font-bold tracking-tight text-text-primary">Classes & Subjects</h1>
        <p className="text-[15px] text-text-secondary mt-1.5">Manage the school's academic structure</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── Classes Column (glass card) ── */}
        <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '0ms' }}>
          <div className="px-6 py-5 border-b border-border/60">
            <h2 className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
              Classes
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-accent/10 text-accent text-[11px] font-semibold">
                {classes.length}
              </span>
            </h2>
          </div>

          {/* ── Inline create form ── */}
          <div className="p-5 border-b border-border/40 space-y-3 bg-background-secondary/30">
            <form onSubmit={handleCreateClass} className="flex gap-2.5">
              <div className="flex-1 relative">
                <input
                  value={newClassName}
                  onChange={e => { setNewClassName(e.target.value); setClassError('') }}
                  placeholder="e.g. SS 1"
                  className="w-full h-10 px-4 rounded-xl bg-background-secondary/80 border border-border/60 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast"
                  required
                />
              </div>
              <button
                type="submit"
                className="h-10 w-10 flex items-center justify-center rounded-xl bg-accent text-accent-foreground hover:bg-accent-hover active:scale-[0.95] transition-all duration-fast flex-shrink-0 shadow-sm"
              >
                <Plus className="w-4.5 h-4.5" />
              </button>
            </form>
            <input
              value={newClassSection}
              onChange={e => setNewClassSection(e.target.value)}
              placeholder="Section (optional, e.g. A)"
              className="w-full h-10 px-4 rounded-xl bg-background-secondary/80 border border-border/60 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast"
            />
            {classError && (
              <div className="px-4 py-2.5 rounded-xl bg-status-pending/10 border border-status-pending/20 text-[12px] text-status-pending font-medium">
                {classError}
              </div>
            )}
          </div>

          {/* ── Class list ── */}
          <div className="divide-y divide-border/40 max-h-[460px] overflow-y-auto">
            {classes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-background-secondary flex items-center justify-center mb-4">
                  <FolderOpen className="w-7 h-7 text-text-tertiary" />
                </div>
                <p className="text-[15px] font-medium text-text-secondary">No classes yet</p>
                <p className="text-[13px] text-text-tertiary mt-1">Add your first class above</p>
              </div>
            ) : classes.map((c, idx) => (
              <div
                key={c.id}
                onClick={() => { if (deletingClassId !== c.id) selectClass(c.id) }}
                className={cn(
                  'group flex items-center justify-between px-6 py-4 cursor-pointer transition-all duration-200 animate-fade-in',
                  selectedClassId === c.id
                    ? 'bg-gradient-to-r from-accent/[0.07] to-transparent border-l-[3px] border-l-accent'
                    : 'hover:bg-background-secondary/60 border-l-[3px] border-l-transparent',
                )}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {deletingClassId === c.id ? (
                  <div className="flex items-center gap-3 w-full py-0.5">
                    <span className="text-[14px] text-text-primary font-medium">Delete {c.name}?</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteClass(c.id) }}
                      className="text-[13px] text-status-rejected underline underline-offset-2 cursor-pointer bg-transparent border-none p-0 font-medium hover:text-status-rejected/80 transition-colors"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingClassId(null) }}
                      className="text-[13px] text-text-secondary underline underline-offset-2 cursor-pointer bg-transparent border-none p-0 hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={cn(
                        'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-sm',
                        classIconGradient(c.name || ''),
                      )}>
                        <FolderOpen className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary truncate flex items-center gap-2">
                          {c.name}
                          {c.section && (
                            <span className="text-[11px] text-text-tertiary font-normal bg-background-secondary/80 px-2 py-0.5 rounded-md">
                              Section {c.section}
                            </span>
                          )}
                        </p>
                        <p className="text-[12px] text-text-tertiary mt-0.5">
                          {subjectCountForClass(c.id)} subject{subjectCountForClass(c.id) !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingClassId(c.id) }}
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

        {/* ── Subjects Column (glass card) ── */}
        <div className="glass-card overflow-hidden animate-slide-up" style={{ animationDelay: '80ms' }}>
          <div className="px-6 py-5 border-b border-border/60 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-text-primary flex items-center gap-2">
              {selectedClass ? (
                <>
                  <div className={cn(
                    'w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm',
                    classIconGradient(selectedClass.name || ''),
                  )}>
                    <FolderOpen className="w-4 h-4 text-white" />
                  </div>
                  {selectedClass.name}
                  {selectedClass.section && (
                    <span className="text-[11px] text-text-tertiary font-normal bg-background-secondary/80 px-2 py-0.5 rounded-md">
                      S {selectedClass.section}
                    </span>
                  )}
                </>
              ) : (
                'Subjects'
              )}
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-accent/10 text-accent text-[11px] font-semibold">
                {selectedClass ? subjectCountForClass(selectedClass.id) : 0}
              </span>
            </h2>
            <button
              onClick={() => setShowSubjectForm(true)}
              disabled={!selectedClassId}
              title={!selectedClassId ? 'Select a class first' : ''}
              className="h-9 px-4 rounded-xl bg-accent text-accent-foreground text-[12px] font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all duration-fast flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              New Subject
            </button>
          </div>

          <div className="divide-y divide-border/40 max-h-[520px] overflow-y-auto">
            {!selectedClassId ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-background-secondary flex items-center justify-center mb-4">
                  <FolderOpen className="w-8 h-8 text-text-tertiary" />
                </div>
                <p className="text-[16px] font-semibold text-text-secondary">Select a class</p>
                <p className="text-[13px] text-text-tertiary mt-1.5 max-w-[220px]">Click on a class to manage its subjects</p>
              </div>
            ) : loadingSubjects ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 rounded-xl skeleton" />
                ))}
              </div>
            ) : subjectCountForClass(selectedClassId) === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-background-secondary flex items-center justify-center mb-4">
                  <BookOpen className="w-7 h-7 text-text-tertiary" />
                </div>
                <p className="text-[15px] font-medium text-text-secondary">No subjects in this class</p>
                <p className="text-[13px] text-text-tertiary mt-1">Add a subject using the button above</p>
              </div>
            ) : (
              subjects.filter(s => s.class_id === selectedClassId).map((s, idx) => (
                <div
                  key={s.id}
                  className={cn(
                    'group flex items-center justify-between px-6 py-3.5 transition-all duration-200 animate-fade-in',
                    deletingSubjectId === s.id ? 'opacity-0 h-0 py-0 overflow-hidden' : 'opacity-100 h-auto',
                    'hover:bg-background-secondary/60',
                  )}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  {deletingSubjectId === s.id ? (
                    <div className="flex items-center gap-3 w-full py-2">
                      <span className="text-[14px] text-text-primary font-medium">Delete {s.name}?</span>
                      <button
                        onClick={() => handleDeleteSubject(s.id)}
                        className="text-[13px] text-status-rejected underline underline-offset-2 cursor-pointer bg-transparent border-none p-0 font-medium hover:text-status-rejected/80 transition-colors"
                      >
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setDeletingSubjectId(null)}
                        className="text-[13px] text-text-secondary underline underline-offset-2 cursor-pointer bg-transparent border-none p-0 hover:text-text-primary transition-colors"
                      >
                        Cancel
                      </button>
                      <span className="text-[11px] text-text-tertiary ml-1">Linked scripts will also be removed.</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-surface',
                          s.status === 'completed' ? 'bg-status-completed ring-status-completed/20' :
                          s.status === 'pending' ? 'bg-status-pending ring-status-pending/20' :
                          s.status === 'rejected' ? 'bg-status-rejected ring-status-rejected/20' :
                          'bg-accent ring-accent/20',
                        )} title={s.status || 'active'} />
                        <div className="w-8 h-8 rounded-lg bg-accent-subtle flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-4 h-4 text-accent" />
                        </div>
                        <span className="text-[14px] font-medium text-text-primary truncate">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <button
                          onClick={() => navigate(`/admin/subjects/${s.id}`)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-accent hover:bg-accent/10 transition-all duration-fast"
                          title="View subject"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingSubjectId(s.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-status-rejected hover:bg-status-rejected/10 transition-all duration-fast"
                          title="Delete subject"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Add Subject Modal ── */}
      {showSubjectForm && selectedClassId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
          <div className="glass-dark rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-7 h-16 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-[17px] font-semibold text-text-primary">
                    New Subject
                  </h2>
                  <p className="text-[12px] text-text-tertiary">in {selectedClass?.name}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowSubjectForm(false); setSubjectError(''); setNewSubjectName('') }}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-text-tertiary hover:bg-background-secondary/80 hover:text-text-secondary transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubject} className="p-7 space-y-5">
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Subject Name</label>
                <input
                  value={newSubjectName}
                  onChange={e => { setNewSubjectName(e.target.value); setSubjectError('') }}
                  placeholder="e.g. Mathematics"
                  disabled={creatingSubject}
                  className="w-full h-11 px-4 rounded-xl bg-background-secondary/80 border border-border/60 text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast disabled:opacity-50"
                  required
                />
              </div>
              {subjectError && (
                <div className="px-4 py-3 rounded-xl bg-status-rejected/10 border border-status-rejected/20 text-[13px] font-medium text-status-rejected">
                  {subjectError}
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowSubjectForm(false); setSubjectError(''); setNewSubjectName('') }}
                  disabled={creatingSubject}
                  className="flex-1 h-11 rounded-xl bg-background-secondary/80 text-text-secondary text-[14px] font-semibold hover:bg-background-secondary active:scale-[0.98] transition-all duration-fast disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSubject || !newSubjectName.trim()}
                  className="flex-1 h-11 rounded-xl bg-accent text-accent-foreground text-[14px] font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all duration-fast disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {creatingSubject ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </span>
                  ) : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
