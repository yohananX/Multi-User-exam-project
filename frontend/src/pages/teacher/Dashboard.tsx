import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, CheckCircle, AlertCircle, Upload } from 'lucide-react';
import { dashboardApi } from '../../api/endpoints';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    dashboardApi.teacher().then(res => setData(res.data)).catch(() => {});
  }, []);

  if (!data) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  const stats = [
    { label: 'Total Subjects', value: data.total_subjects, icon: BookOpen },
    { label: 'Pending Uploads', value: data.subjects_with_pending, icon: AlertCircle },
    { label: 'All Completed', value: data.subjects_all_completed, icon: CheckCircle },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>My Dashboard</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Overview of your assigned subjects</p>
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

      <div className="card p-5">
        <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>My Subjects</h2>
        <div className="space-y-4">
          {(() => {
            const grouped: Record<string, any[]> = {};
            (data.subjects || []).forEach((s: any) => {
              const key = s.class_name;
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(s);
            });
            return Object.entries(grouped).map(([className, subs]) => (
              <div key={className}>
                <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>{className}</h3>
                <div className="space-y-1.5">
                  {subs.map((s: any) => (
                    <div
                      key={s.subject_id}
                      onClick={() => navigate(`/subjects/${s.subject_id}`)}
                      className="card-hover card p-3 flex items-center justify-between cursor-pointer"
                    >
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {s.status === 'completed' && <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ background: '#22c55e' }} />}
                        {s.subject_name}
                      </p>
                      <div className="flex items-center gap-3">
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.total_images} images</span>
                        {s.pending > 0 ? (
                          <span className="status-pending text-xs px-2.5 py-1 rounded-full">{s.pending} pending</span>
                        ) : s.completed > 0 ? (
                          <span className="status-completed text-xs px-2.5 py-1 rounded-full">Completed</span>
                        ) : null}
                        <Upload className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
          {(!data.subjects || data.subjects.length === 0) && (
            <p className="text-sm py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>No subjects assigned yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
