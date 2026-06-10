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
        return <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-completed-bg text-status-completed font-medium">Completed</span>;
      case 'ocr_pending':
      case 'docx_pending':
      case 'impose_pending':
        return <span className="text-[11px] px-2 py-0.5 rounded-full bg-status-processing-bg text-status-processing font-medium">Processing</span>;
      default:
        return <span className="text-[11px] px-2 py-0.5 rounded-full bg-background-tertiary text-text-tertiary font-medium">{status || 'Active'}</span>;
    }
  };

  const dotColor = (subj: any) => {
    if (STATUS_DOT_COLORS[subj.status]) return STATUS_DOT_COLORS[subj.status];
    if (subj.imposed_pdf_path) return 'bg-accent';
    if (subj.docx_path) return 'bg-accent';
    if (subj.ocr_text) return 'bg-status-processing';
    return 'bg-status-completed';
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
    </div>
  );

  return (
    <div className="max-w-4xl animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Exam Structure</h1>
          <p className="text-[15px] text-text-secondary mt-1">Browse all classes and subjects</p>
        </div>
        <div className="flex items-center gap-4">
          {STATUS_LABELS.map(s => (
            <div key={s.key} className="flex items-center gap-1.5">
              <div className={cn('w-[6px] h-[6px] rounded-full', s.color)} />
              <span className="text-[11px] text-text-tertiary">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {structure.length === 0 ? (
          <div className="bg-surface rounded-[16px] shadow-card p-12 text-center">
            <FolderOpen className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
            <p className="text-[15px] text-text-secondary">No classes configured yet</p>
            <p className="text-[12px] text-text-tertiary mt-1">Add classes in the Classes section</p>
          </div>
        ) : structure.map(cls => (
          <div key={cls.id} className="bg-surface rounded-[16px] shadow-card overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3 border-b border-border">
              <div className="w-9 h-9 rounded-[10px] bg-accent-subtle flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-accent" />
              </div>
              <div>
                <span className="text-[15px] font-semibold text-text-primary">{cls.name}</span>
                {cls.section && (
                  <span className="ml-2 text-[12px] text-text-tertiary">Section {cls.section}</span>
                )}
              </div>
              <span className="ml-auto text-[12px] text-text-tertiary">
                {cls.subjects?.length || 0} subject{(cls.subjects?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>
            {(!cls.subjects || cls.subjects.length === 0) ? (
              <div className="px-5 py-6 text-center">
                <BookOpen className="w-6 h-6 text-text-tertiary mx-auto mb-2" />
                <p className="text-[13px] text-text-tertiary">No subjects in this class</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cls.subjects.map((subj: any) => (
                  <div
                    key={subj.id}
                    onClick={() => navigate(`/admin/subjects/${subj.id}`)}
                    className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-background-secondary transition-colors duration-fast group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', dotColor(subj))} />
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-text-primary truncate">{subj.name}</p>
                        <p className="text-[11px] text-text-tertiary mt-0.5 flex items-center gap-1">
                          <span>{subj.image_count || 0} image{(subj.image_count || 0) !== 1 ? 's' : ''}</span>
                          {subj.images && (
                            <>
                              <span className="text-text-tertiary">·</span>
                              <span>{subj.images.pending || 0} pending</span>
                              <span className="text-text-tertiary">·</span>
                              <span>{subj.images.completed || 0} done</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {statusBadge(subj.status || 'active')}
                      <ChevronRight className="w-4 h-4 text-text-tertiary" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-border px-5 py-2.5">
              {addingSubject === cls.id ? (
                <div className="flex items-center gap-2">
                  <input
                    value={newSubjectName}
                    onChange={e => setNewSubjectName(e.target.value)}
                    placeholder="Subject name..."
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleAddSubject(cls.id) }}
                    className="flex-1 h-8 px-3 rounded-[8px] bg-background-secondary border border-border text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/10 transition-all"
                  />
                  <button
                    onClick={() => handleAddSubject(cls.id)}
                    disabled={!newSubjectName.trim()}
                    className="h-8 px-3 rounded-[8px] bg-accent text-accent-foreground text-[12px] font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setAddingSubject(null); setNewSubjectName('') }}
                    className="h-8 w-8 flex items-center justify-center rounded-[8px] text-text-tertiary hover:text-text-secondary hover:bg-background-secondary transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingSubject(cls.id)}
                  className="flex items-center gap-1.5 text-[12px] text-accent hover:text-accent-hover transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
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
