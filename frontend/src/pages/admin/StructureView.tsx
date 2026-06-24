import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, ChevronRight, BookOpen, Plus, X, Loader2 } from 'lucide-react';
import { dashboardApi, subjectsApi } from '../../api/endpoints';
import { cn } from '@/lib/utils';

const STATUS_DOT_COLORS: Record<string, string> = {
  active: 'bg-status-completed',
  pending: 'bg-status-pending',
  completed: 'bg-accent',
  rejected: 'bg-status-rejected',
}

const STATUS_LABELS = [
  { key: 'active', label: 'Active', color: 'bg-status-completed' },
  { key: 'pending', label: 'Pending', color: 'bg-status-pending' },
  { key: 'completed', label: 'Completed', color: 'bg-accent' },
  { key: 'rejected', label: 'Rejected', color: 'bg-status-rejected' },
]

export default function AdminStructureView() {
  const navigate = useNavigate();
  const [structure, setStructure] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingSubject, setAddingSubject] = useState<number | null>(null);
  const [newSubjectName, setNewSubjectName] = useState('');

  useEffect(() => {
    setLoading(true);
    dashboardApi.structure()
      .then(res => setStructure(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAddSubject = async (classId: number) => {
    if (!newSubjectName.trim()) return;
    try {
      await subjectsApi.create({ name: newSubjectName.trim(), class_id: classId });
      setNewSubjectName('');
      setAddingSubject(null);
      const res = await dashboardApi.structure();
      setStructure(res.data);
    } catch { /* ignore */ }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="badge-completed">Completed</span>;
      case 'ocr_pending':
      case 'docx_pending':
      case 'impose_pending':
        return <span className="badge-processing">Processing</span>;
      default:
        return <span className="inline-flex items-center px-3 py-0.5 text-[11px] font-medium rounded-full bg-[hsl(var(--background-tertiary))] text-[hsl(var(--text-tertiary))] border border-border/40">{status || 'Active'}</span>;
    }
  };

  const dotColor = (subj: any) => {
    if (STATUS_DOT_COLORS[subj.status]) return STATUS_DOT_COLORS[subj.status];
    if (subj.imposed_pdf_path) return 'bg-accent';
    if (subj.docx_path) return 'bg-accent';
    if (subj.ocr_text) return 'bg-status-processing';
    return 'bg-status-completed';
  };

  const classGradient = (name: string) => {
    const colors = [
      'from-accent/10 to-blue-500/5',
      'from-emerald-500/10 to-teal-500/5',
      'from-orange-500/10 to-rose-500/5',
      'from-violet-500/10 to-purple-500/5',
      'from-cyan-500/10 to-blue-500/5',
      'from-pink-500/10 to-rose-500/5',
    ];
    const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto px-0">
      <div className="flex items-center justify-center min-h-[320px]">
        <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-0 animate-fade-in">
      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[32px] font-bold tracking-tight text-text-primary">Exam Structure</h1>
            <p className="text-[15px] text-text-secondary mt-1.5">Browse all classes and subjects across the school</p>
          </div>
          <div className="flex items-center gap-5 bg-background-secondary/60 px-4 py-2.5 rounded-xl border border-border/40">
            {STATUS_LABELS.map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full ring-2 ring-offset-1 ring-offset-background', s.color, s.color.replace('bg-', 'ring-') + '/20')} />
                <span className="text-[12px] font-medium text-text-tertiary">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Class Cards ── */}
      <div className="space-y-5">
        {structure.length === 0 ? (
          <div className="glass-card p-14 text-center animate-slide-up">
            <div className="w-16 h-16 rounded-2xl bg-background-secondary flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8 text-text-tertiary" />
            </div>
            <p className="text-[16px] font-semibold text-text-secondary">No classes configured yet</p>
            <p className="text-[13px] text-text-tertiary mt-1.5">Add classes in the Classes section to get started</p>
          </div>
        ) : structure.map((cls, idx) => (
          <div
            key={cls.id}
            className="glass-card overflow-hidden animate-slide-up"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            {/* ── Class Header ── */}
            <div className={cn(
              'px-6 py-5 flex items-center gap-4 border-b border-border/40 bg-gradient-to-r',
              classGradient(cls.name || ''),
            )}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center shadow-sm flex-shrink-0">
                <FolderOpen className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="text-[16px] font-semibold text-text-primary">{cls.name}</span>
                  {cls.section && (
                    <span className="text-[11px] text-text-tertiary font-medium bg-background-secondary/80 px-2.5 py-0.5 rounded-md border border-border/40">
                      Section {cls.section}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[13px] text-text-tertiary font-medium flex items-center gap-1.5 flex-shrink-0">
                <BookOpen className="w-3.5 h-3.5" />
                {cls.subjects?.length || 0} subject{(cls.subjects?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>

            {/* ── Subject List ── */}
            {(!cls.subjects || cls.subjects.length === 0) ? (
              <div className="px-6 py-8 text-center">
                <BookOpen className="w-6 h-6 text-text-tertiary mx-auto mb-2" />
                <p className="text-[13px] text-text-tertiary">No subjects in this class</p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {cls.subjects.map((subj: any, sIdx: number) => (
                  <div
                    key={subj.id}
                    onClick={() => navigate(`/admin/subjects/${subj.id}`)}
                    className={cn(
                      'flex items-center justify-between px-6 py-3.5 cursor-pointer transition-all duration-200 group animate-fade-in',
                      'hover:bg-background-secondary/60 hover:pl-7',
                    )}
                    style={{ animationDelay: `${idx * 60 + sIdx * 30}ms` }}
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <div className={cn(
                        'w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-surface transition-all duration-200 group-hover:scale-110',
                        dotColor(subj),
                        dotColor(subj).replace('bg-', 'ring-') + '/20',
                      )} />
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-text-primary truncate group-hover:text-accent transition-colors duration-200">{subj.name}</p>
                        <p className="text-[12px] text-text-tertiary mt-0.5 flex items-center gap-2">
                          <span>{subj.image_count || 0} image{(subj.image_count || 0) !== 1 ? 's' : ''}</span>
                          {subj.images && (
                            <>
                              <span className="w-1 h-1 rounded-full bg-border/60" />
                              <span className="text-status-pending">{subj.images.pending || 0} pending</span>
                              <span className="w-1 h-1 rounded-full bg-border/60" />
                              <span className="text-status-completed">{subj.images.completed || 0} done</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {statusBadge(subj.status || 'active')}
                      <ChevronRight className="w-4 h-4 text-text-tertiary transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-accent" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Inline Add Subject ── */}
            <div className="border-t border-border/40 px-6 py-3 bg-background-secondary/20">
              {addingSubject === cls.id ? (
                <div className="flex items-center gap-2.5 animate-slide-down">
                  <input
                    value={newSubjectName}
                    onChange={e => setNewSubjectName(e.target.value)}
                    placeholder="Subject name..."
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSubject(cls.id) }}
                    className="flex-1 h-10 px-4 rounded-xl bg-background-secondary/80 border border-border/60 text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all"
                  />
                  <button
                    onClick={() => handleAddSubject(cls.id)}
                    disabled={!newSubjectName.trim()}
                    className="h-10 px-4 rounded-xl bg-accent text-accent-foreground text-[13px] font-semibold hover:bg-accent-hover active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingSubject(null); setNewSubjectName('') }}
                    className="h-10 w-10 flex items-center justify-center rounded-xl text-text-tertiary hover:text-text-secondary hover:bg-background-secondary/80 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSubject(cls.id)}
                  className="flex items-center gap-2 text-[13px] text-accent hover:text-accent-hover font-medium transition-all bg-transparent border-none p-0 cursor-pointer group"
                >
                  <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-all">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                  Add Subject
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
