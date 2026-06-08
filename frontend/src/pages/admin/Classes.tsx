import { useEffect, useState } from 'react';
import { Plus, Trash2, BookOpen } from 'lucide-react';
import { classesApi, subjectsApi } from '../../api/endpoints';

export default function AdminClasses() {
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [newClass, setNewClass] = useState('');
  const [newSubject, setNewSubject] = useState({ name: '', class_id: '' });

  const fetchData = () => {
    classesApi.list().then(r => setClasses(r.data));
    subjectsApi.list().then(r => setSubjects(r.data));
  };

  useEffect(() => { fetchData(); }, []);

  const addClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClass) return;
    await classesApi.create({ name: newClass, school_id: 1 });
    setNewClass('');
    fetchData();
  };

  const deleteClass = async (id: number) => {
    if (!confirm('Delete this class and all its subjects/images?')) return;
    await classesApi.delete(id);
    fetchData();
  };

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.name || !newSubject.class_id) return;
    await subjectsApi.create({ name: newSubject.name, class_id: Number(newSubject.class_id) });
    setNewSubject({ name: '', class_id: '' });
    fetchData();
  };

  const deleteSubject = async (id: number) => {
    if (!confirm('Delete this subject?')) return;
    await subjectsApi.delete(id);
    fetchData();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Classes & Subjects</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage the school academic structure</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Classes</h2>
          <form onSubmit={addClass} className="flex gap-2 mb-4">
            <input value={newClass} onChange={e => setNewClass(e.target.value)} placeholder="Class name"
              className="input-dark flex-1 text-sm" required />
            <button type="submit" className="btn-primary p-2"><Plus className="w-4 h-4" /></button>
          </form>
          <div className="space-y-1.5">
            {classes.map(c => (
              <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                <button onClick={() => deleteClass(c.id)} className="p-1 rounded hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>Subjects</h2>
          <form onSubmit={addSubject} className="flex gap-2 mb-4">
            <select value={newSubject.class_id} onChange={e => setNewSubject({ ...newSubject, class_id: e.target.value })}
              className="input-dark text-sm" required>
              <option value="">Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={newSubject.name} onChange={e => setNewSubject({ ...newSubject, name: e.target.value })} placeholder="Subject"
              className="input-dark flex-1 text-sm" required />
            <button type="submit" className="btn-primary p-2"><Plus className="w-4 h-4" /></button>
          </form>
          <div className="space-y-1.5">
            {classes.map(c => {
              const subjs = subjects.filter(s => s.class_id === c.id);
              if (!subjs.length) return null;
              return (
                <div key={c.id} className="p-2.5 rounded-lg" style={{ background: 'var(--surface-hover)' }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>{c.name}</p>
                  {subjs.map(s => (
                    <div key={s.id} className="flex items-center justify-between py-1.5 pl-2">
                      <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        <BookOpen className="w-3 h-3" style={{ color: 'var(--accent)' }} /> {s.name}
                      </span>
                      <button onClick={() => deleteSubject(s.id)} className="p-0.5 rounded hover:bg-red-500/10"><Trash2 className="w-3 h-3" style={{ color: '#ef4444' }} /></button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
