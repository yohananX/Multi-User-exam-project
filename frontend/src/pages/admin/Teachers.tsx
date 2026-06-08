import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, CheckSquare } from 'lucide-react';
import { adminApi, classesApi, subjectsApi } from '../../api/endpoints';

export default function AdminTeachers() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', full_name: '' });
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [newClassId, setNewClassId] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<Set<number>>(new Set());

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      adminApi.teachers(),
      classesApi.list(),
      subjectsApi.list(),
    ]).then(([t, c, s]) => {
      setTeachers(t.data);
      setClasses(c.data);
      setSubjects(s.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const selectTeacher = async (id: number) => {
    setSelected(id);
    setNewClassId('');
    setSelectedSubjects(new Set());
    const res = await adminApi.teacherAssignments(id);
    setAssignments(res.data);
  };

  const handleAddAssignments = async () => {
    if (!selected || !newClassId || selectedSubjects.size === 0) return;
    try {
      await adminApi.addAssignmentsBatch(selected, Number(newClassId), Array.from(selectedSubjects));
      setNewClassId('');
      setSelectedSubjects(new Set());
      const res = await adminApi.teacherAssignments(selected);
      setAssignments(res.data);
    } catch (e: any) {
      setError(extractError(e));
    }
  };

  const handleRemoveAssignment = async (id: number) => {
    try {
      await adminApi.removeAssignment(id);
      if (selected) {
        const res = await adminApi.teacherAssignments(selected);
        setAssignments(res.data);
      }
    } catch { setError('Failed to remove'); }
  };

  const handleDeleteTeacher = async (id: number) => {
    if (!confirm('Delete this teacher and all their assignments?')) return;
    try {
      await adminApi.deleteTeacher(id);
      if (selected === id) {
        setSelected(null);
        setAssignments([]);
      }
      fetchAll();
    } catch { setError('Failed to delete'); }
  };

  const extractError = (err: any): string => {
    const detail = err?.response?.data?.detail;
    if (!detail) return 'Failed';
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map((d: any) => d.msg || String(d)).join('; ');
    return String(detail);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createTeacher({ ...form, role: 'teacher', school_id: null as any });
      setShowForm(false);
      setForm({ username: '', email: '', password: '', full_name: '' });
      fetchAll();
    } catch (e: any) {
      setError(extractError(e));
    }
  };

  const filteredSubjects = subjects.filter(s => s.class_id === Number(newClassId));

  const toggleSubject = (id: number) => {
    setSelectedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllSubjects = () => {
    setSelectedSubjects(new Set(filteredSubjects.map(s => s.id)));
  };

  const deselectAllSubjects = () => {
    setSelectedSubjects(new Set());
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Teachers</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage teachers and their subject assignments</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 py-2 px-4 text-sm">
          <Plus className="w-4 h-4" /> Add Teacher
        </button>
      </div>

      {error && <div className="text-sm px-4 py-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          {teachers.map(t => (
            <div key={t.id} onClick={() => selectTeacher(t.id)}
              className={`card p-4 cursor-pointer card-hover flex items-center justify-between ${selected === t.id ? 'border-accent' : ''}`}>
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t.full_name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  @{t.username} · {t.total_assignments} subjects · {t.total_images} images
                </p>
              </div>
              <button onClick={e => { e.stopPropagation(); handleDeleteTeacher(t.id); }}
                className="p-1.5 rounded-lg hover:bg-red-500/10">
                <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
              </button>
            </div>
          ))}
        </div>

        <div className="card p-5">
          {selected ? (
            <div className="space-y-4">
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                Current Assignments
              </p>

              {assignments.length === 0 ? (
                <p className="text-xs py-3" style={{ color: 'var(--text-tertiary)' }}>No subjects assigned yet</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {assignments.map(a => {
                    const alreadyAssigned = new Set(assignments.map(x => `${x.class_id}-${x.subject_id}`));
                    return (
                      <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
                        <div>
                          <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{a.subject_name}</p>
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{a.class_name}</p>
                        </div>
                        <button onClick={() => handleRemoveAssignment(a.id)} className="p-1 rounded hover:bg-red-500/10">
                          <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="pt-3 border-t border-border space-y-3">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>Add New Assignments</p>

                <select value={newClassId} onChange={e => { setNewClassId(e.target.value); setSelectedSubjects(new Set()); }}
                  className="input-dark w-full text-xs">
                  <option value="">Select a class...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                {newClassId && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Subjects in this class:</p>
                      <div className="flex gap-2">
                        <button onClick={selectAllSubjects} className="text-xs flex items-center gap-1 px-2 py-1 rounded" style={{ color: 'var(--accent)', background: 'var(--accent-muted)' }}>
                          <CheckSquare className="w-3 h-3" /> All
                        </button>
                        <button onClick={deselectAllSubjects} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-tertiary)', background: 'var(--surface-hover)' }}>
                          None
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {filteredSubjects.map(s => {
                        const alreadyAssigned = assignments.some(a => a.subject_id === s.id);
                        return (
                          <label key={s.id} className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer text-xs ${alreadyAssigned ? 'opacity-40' : 'hover:bg-surface-hover'}`}>
                            <input type="checkbox" checked={selectedSubjects.has(s.id)} disabled={alreadyAssigned}
                              onChange={() => toggleSubject(s.id)}
                              className="accent-accent w-3.5 h-3.5" />
                            <span style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                            {alreadyAssigned && <span className="ml-auto text-xs" style={{ color: 'var(--text-tertiary)' }}>already assigned</span>}
                          </label>
                        );
                      })}
                    </div>

                    <button onClick={handleAddAssignments} disabled={selectedSubjects.size === 0}
                      className="btn-primary text-xs py-2 px-4 w-full disabled:opacity-50">
                      Assign Selected ({selectedSubjects.size})
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-center py-12" style={{ color: 'var(--text-tertiary)' }}>Select a teacher to manage their assignments</p>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="card p-6 w-full max-w-sm">
            <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>New Teacher</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <input placeholder="Full Name" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="input-dark w-full text-sm" required />
              <input placeholder="Username" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })}
                className="input-dark w-full text-sm" required />
              <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="input-dark w-full text-sm" required />
              <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                className="input-dark w-full text-sm" required />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2 rounded-lg text-sm border border-border" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
                <button type="submit" className="btn-primary flex-1 py-2 text-sm">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
