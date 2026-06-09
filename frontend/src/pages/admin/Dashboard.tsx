import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image, Clock, CheckCircle, Eye, Users, BookOpen, Upload } from 'lucide-react';
import { dashboardApi } from '../../api/endpoints';

const statusIcons: Record<string, any> = { pending: Clock, in_review: Eye, completed: CheckCircle };
const statusLabels: Record<string, string> = { pending: 'Pending', in_review: 'In Review', completed: 'Completed' };

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    dashboardApi.admin().then(res => setData(res.data)).catch(() => {});
  }, []);

  if (!data) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  const stats = [
    { label: 'Total Images', value: data.total_images, icon: Image },
    { label: 'Pending Review', value: data.pending, icon: Clock },
    { label: 'In Review', value: data.in_review, icon: Eye },
    { label: 'PDFs Generated', value: data.completed, icon: CheckCircle },
    { label: 'Teachers', value: data.total_teachers, icon: Users },
    { label: 'Subjects', value: data.total_subjects, icon: BookOpen },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>School-wide overview</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg" style={{ background: 'var(--accent-muted)' }}>
                  <Icon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                </div>
              </div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
            </div>
          );
        })}
      </div>

      {data.recent_uploads?.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Recent Uploads</h2>
          <div className="space-y-1">
            {data.recent_uploads.map((u: any) => {
              const StatIcon = statusIcons[u.status] || Clock;
              return (
                <div
                  key={u.id}
                  onClick={() => navigate(`/admin/subjects/${u.subject_id}`)}
                  className="card p-3 card-hover flex items-center gap-3 cursor-pointer"
                >
                  <div className="p-1.5 rounded-lg" style={{ background: 'var(--accent-muted)' }}>
                    <Upload className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{u.title}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {u.class_name} · {u.subject_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border" style={{ color: 'var(--text-secondary)' }}>
                    <StatIcon className="w-3 h-3" />
                    {statusLabels[u.status] || u.status}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
