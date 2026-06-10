import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, BookOpen, FolderOpen, X, ExternalLink } from 'lucide-react';
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="space-y-3 w-full max-w-md">
        {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-[12px] bg-background-secondary animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl animate-fade-in space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Classes & Subjects</h1>
        <p className="text-[15px] text-text-secondary mt-1">Manage the school academic structure</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classes Column */}
        <div className="bg-surface rounded-[16px] shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-[15px] font-semibold text-text-primary">
              Classes
              <span className="ml-2 text-[12px] text-text-tertiary font-normal">{classes.length} total</span>
            </h2>
          </div>

          <div className="p-4 border-b border-border space-y-2">
            <form onSubmit={handleCreateClass} className="flex gap-2">
              <input
                value={newClassName}
                onChange={e => { setNewClassName(e.target.value); setClassError('') }}
                placeholder="e.g. SS 1"
                className="flex-1 h-9 px-3 rounded-[10px] bg-background-secondary border border-border text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast"
                required
              />
              <button
                type="submit"
                className="h-9 w-9 flex items-center justify-center rounded-[10px] bg-accent text-accent-foreground hover:bg-accent-hover transition-colors duration-fast flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
            <input
              value={newClassSection}
              onChange={e => setNewClassSection(e.target.value)}
              placeholder="Section (optional, e.g. A)"
              className="w-full h-9 px-3 rounded-[10px] bg-background-secondary border border-border text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast"
            />
            {classError && <p className="text-[12px] text-status-pending">{classError}</p>}
          </div>

          <div className="divide-y divide-border max-h-[440px] overflow-y-auto">
            {classes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <FolderOpen className="w-8 h-8 text-text-tertiary mb-2" />
                <p className="text-[14px] text-text-secondary">No classes yet</p>
                <p className="text-[12px] text-text-tertiary mt-1">Add your first class above</p>
              </div>
            ) : classes.map(c => (
              <div
                key={c.id}
                onClick={() => { if (deletingClassId !== c.id) selectClass(c.id) }}
                className={cn(
                  'group flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors duration-150',
                  selectedClassId === c.id
                    ? 'bg-[hsl(var(--accent)/0.08)] border-l-2 border-l-accent'
                    : 'hover:bg-background-secondary border-l-2 border-l-transparent',
                )}
              >
                {deletingClassId === c.id ? (
                  <div className="flex items-center gap-2 w-full py-0.5">
                    <span className="text-[13px] text-text-primary">Delete {c.name}?</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteClass(c.id) }}
                      className="text-[13px] text-status-rejected underline cursor-pointer bg-transparent border-none p-0"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingClassId(null) }}
                      className="text-[13px] text-text-secondary cursor-pointer bg-transparent border-none p-0"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-[8px] bg-accent-subtle flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="w-4 h-4 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-text-primary truncate">{c.name}</p>
                        <p className="text-[11px] text-text-tertiary">
                          {subjectCountForClass(c.id)} subject{subjectCountForClass(c.id) !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeletingClassId(c.id) }}
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

        {/* Subjects Column */}
        <div className="bg-surface rounded-[16px] shadow-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-text-primary">
              {selectedClass ? selectedClass.name : 'Subjects'}
              <span className="ml-2 text-[12px] text-text-tertiary font-normal">
                {selectedClass ? `${subjectCountForClass(selectedClass.id)} subjects` : ''}
              </span>
            </h2>
            <button
              onClick={() => setShowSubjectForm(true)}
              disabled={!selectedClassId}
              title={!selectedClassId ? 'Select a class first' : ''}
              className="h-8 px-3 rounded-[8px] bg-accent text-accent-foreground text-[12px] font-medium hover:bg-accent-hover transition-colors duration-fast flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              New Subject
            </button>
          </div>

          <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
            {!selectedClassId ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <FolderOpen className="w-10 h-10 text-text-tertiary mb-3" />
                <p className="text-[15px] text-text-secondary">Select a class</p>
                <p className="text-[12px] text-text-tertiary mt-1">Click on a class to manage its subjects</p>
              </div>
            ) : loadingSubjects ? (
              <div className="p-5 space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-11 rounded-[10px] bg-background-secondary animate-pulse" />
                ))}
              </div>
            ) : subjectCountForClass(selectedClassId) === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <BookOpen className="w-8 h-8 text-text-tertiary mb-2" />
                <p className="text-[14px] text-text-secondary">No subjects in this class</p>
                <p className="text-[12px] text-text-tertiary mt-1">Add a subject using the button above</p>
              </div>
            ) : (
              subjects.filter(s => s.class_id === selectedClassId).map(s => (
                <div
                  key={s.id}
                  className={cn(
                    'group flex items-center justify-between px-5 py-3 transition-all duration-200',
                    deletingSubjectId === s.id ? 'opacity-0 h-0 py-0 overflow-hidden' : 'opacity-100 h-auto',
                    'hover:bg-background-secondary',
                  )}
                >
                  {deletingSubjectId === s.id ? (
                    <div className="flex items-center gap-2 w-full py-2">
                      <span className="text-[13px] text-text-primary">Delete {s.name}?</span>
                      <button
                        onClick={() => handleDeleteSubject(s.id)}
                        className="text-[13px] text-status-rejected underline cursor-pointer bg-transparent border-none p-0"
                      >
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setDeletingSubjectId(null)}
                        className="text-[13px] text-text-secondary cursor-pointer bg-transparent border-none p-0"
                      >
                        Cancel
                      </button>
                      <span className="text-[11px] text-text-tertiary ml-1">Any uploaded scripts will also be removed.</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={cn(
                            'w-[6px] h-[6px] rounded-full flex-shrink-0',
                            s.status === 'completed' ? 'bg-accent' :
                            s.status === 'pending' ? 'bg-status-pending' :
                            s.status === 'rejected' ? 'bg-status-rejected' :
                            'bg-status-completed',
                          )}
                          title={s.status || 'active'}
                        />
                        <BookOpen className="w-4 h-4 text-accent flex-shrink-0" />
                        <span className="text-[13px] text-text-primary truncate">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => navigate(`/admin/subjects/${s.id}`)}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-sm text-text-tertiary hover:text-accent hover:bg-accent/10 transition-colors duration-fast"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingSubjectId(s.id)}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-sm text-text-tertiary hover:text-status-rejected hover:bg-status-rejected/10 transition-colors duration-fast"
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

      {/* Add Subject Modal */}
      {showSubjectForm && selectedClassId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface rounded-[20px] shadow-xl w-full max-w-sm overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 h-14 border-b border-border">
              <h2 className="text-[17px] font-semibold text-text-primary">
                New Subject — {selectedClass?.name}
              </h2>
              <button
                onClick={() => { setShowSubjectForm(false); setSubjectError(''); setNewSubjectName('') }}
                className="w-8 h-8 flex items-center justify-center rounded-full text-text-tertiary hover:bg-background-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubject} className="p-6 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-text-secondary mb-1.5">Subject Name</label>
                <input
                  value={newSubjectName}
                  onChange={e => { setNewSubjectName(e.target.value); setSubjectError('') }}
                  placeholder="e.g. Mathematics"
                  disabled={creatingSubject}
                  className="w-full h-10 px-3 rounded-[10px] bg-background-secondary border border-border text-[14px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all duration-fast disabled:opacity-50"
                  required
                />
              </div>
              {subjectError && <p className="text-[13px] text-status-rejected">{subjectError}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowSubjectForm(false); setSubjectError(''); setNewSubjectName('') }}
                  disabled={creatingSubject}
                  className="flex-1 h-10 rounded-[10px] bg-background-secondary text-text-secondary text-[14px] font-medium hover:bg-border transition-colors duration-fast disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSubject || !newSubjectName.trim()}
                  className="flex-1 h-10 rounded-[10px] bg-accent text-accent-foreground text-[14px] font-medium hover:bg-accent-hover transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingSubject ? 'Creating\u2026' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
