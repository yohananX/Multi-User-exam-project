import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, ChevronRight } from 'lucide-react';
import { dashboardApi } from '../../api/endpoints';

const statusColors: Record<string, string> = {
  pending: '#f59e0b',
  in_review: '#8b5cf6',
  completed: '#10b981',
};

export default function AdminStructureView() {
  const navigate = useNavigate();
  const [structure, setStructure] = useState<any[]>([]);

  useEffect(() => {
    dashboardApi.structure().then(res => setStructure(res.data)).catch(() => {});
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Exam Structure</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Browse all classes and subjects</p>
      </div>

      <div className="space-y-3">
        {structure.map(cls => (
          <div key={cls.id} className="card overflow-hidden">
            <div className="px-5 py-3 flex items-center gap-3 border-b border-border">
              <FolderOpen className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{cls.name}</span>
              {cls.section && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Section {cls.section}</span>}
            </div>
            <div className="divide-y divide-border">
              {cls.subjects?.map((subj: any) => (
                <div
                  key={subj.id}
                  onClick={() => navigate(`/admin/subjects/${subj.id}`)}
                  className="px-5 py-3 flex items-center justify-between cursor-pointer card-hover"
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {subj.status === 'completed' && <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ background: '#22c55e' }} />}
                      {subj.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {subj.total_images} image{subj.total_images !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {subj.pending > 0 && <span className="status-pending text-xs px-2 py-0.5 rounded-full">{subj.pending} pending</span>}
                      {subj.in_review > 0 && <span className="status-in_review text-xs px-2 py-0.5 rounded-full">{subj.in_review} in review</span>}
                      {subj.completed > 0 && <span className="status-completed text-xs px-2 py-0.5 rounded-full">{subj.completed} done</span>}
                    </div>
                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {structure.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No classes configured yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
