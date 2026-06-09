import { supabase } from '../lib/supabase';
import type { User, Class, Subject, School, TeacherAssignment } from '../types';

// ─── Helpers ───────────────────────────────────────────────────────

function mapUser(r: any): User {
  return { id: r.id, username: r.username || '', email: r.email, full_name: r.full_name, role: r.role, school_id: r.school_id };
}

function mapSubject(r: any): Subject {
  return { id: r.id, name: r.name, class_id: r.class_id, status: r.status, ocr_text: r.ocr_text, docx_path: r.docx_path, imposed_pdf_path: r.imposed_pdf_path };
}

// ─── Auth ──────────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),
  logout: () => supabase.auth.signOut(),
  me: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data } = await supabase.from('users').select('*').eq('auth_id', user.id).single();
    return { data: mapUser(data) };
  },
  register: async (fields: { username: string; email: string; password: string; full_name: string; school_name?: string }) => {
    let schoolId: number | null = null;
    let role = 'teacher';
    if (fields.school_name) {
      const { data: school } = await supabase.from('schools').insert({ name: fields.school_name }).select().single();
      schoolId = school.id;
      role = 'school_admin';
    }

    const { error: authError } = await supabase.auth.signUp({
      email: fields.email,
      password: fields.password,
      options: {
        data: {
          full_name: fields.full_name,
          username: fields.username,
          role,
          school_id: schoolId,
        },
      },
    });
    if (authError) throw authError;
  },
};

// ─── Users ─────────────────────────────────────────────────────────

export const usersApi = {
  list: async () => {
    const { data } = await supabase.from('users').select('*').order('id');
    return { data: (data || []).map(mapUser) };
  },
  create: async (fields: Partial<User> & { password: string }) => {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: fields.email!, password: fields.password, email_confirm: true,
    });
    if (authError) throw authError;
    const { data } = await supabase.from('users').insert({
      auth_id: authData.user!.id, email: fields.email, full_name: fields.full_name,
      username: fields.username, role: fields.role, school_id: fields.school_id,
    }).select().single();
    return { data: mapUser(data) };
  },
  delete: async (id: number) => {
    await supabase.from('users').delete().eq('id', id);
  },
};

// ─── Schools ───────────────────────────────────────────────────────

export const schoolsApi = {
  list: async () => {
    const { data } = await supabase.from('schools').select('*').order('id');
    return { data: data || [] };
  },
  create: async (fields: { name: string; address?: string }) => {
    const { data } = await supabase.from('schools').insert(fields).select().single();
    return { data };
  },
  delete: async (id: number) => {
    await supabase.from('schools').delete().eq('id', id);
  },
};

// ─── Classes ───────────────────────────────────────────────────────

const CLASS_SORT_ORDER = [
  'Reception', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
  'JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3',
];

export const classesApi = {
  list: async () => {
    const { data } = await supabase.from('classes').select('*');
    const sorted = [...(data || [])].sort((a, b) => CLASS_SORT_ORDER.indexOf(a.name) - CLASS_SORT_ORDER.indexOf(b.name));
    return { data: sorted };
  },
  create: async (fields: { name: string; section?: string; school_id: number }) => {
    const { data } = await supabase.from('classes').insert(fields).select().single();
    return { data };
  },
  delete: async (id: number) => {
    await supabase.from('classes').delete().eq('id', id);
  },
};

// ─── Subjects ──────────────────────────────────────────────────────

export const subjectsApi = {
  list: async (classId?: number) => {
    let q = supabase.from('subjects').select('*').order('id');
    if (classId) q = q.eq('class_id', classId);
    const { data } = await q;
    return { data: (data || []).map(mapSubject) };
  },
  create: async (fields: { name: string; class_id: number }) => {
    const { data } = await supabase.from('subjects').insert(fields).select().single();
    return { data: mapSubject(data) };
  },
  delete: async (id: number) => {
    await supabase.from('subjects').delete().eq('id', id);
  },
  updateStatus: async (id: number, status: string) => {
    const { data } = await supabase.from('subjects').update({ status }).eq('id', id).select().single();
    return { data: mapSubject(data) };
  },
};

// ─── Assignments ───────────────────────────────────────────────────

export const assignmentsApi = {
  list: async () => {
    const { data } = await supabase.from('teacher_assignments').select('*');
    return { data: data || [] };
  },
  create: async (fields: { teacher_id: number; class_id: number; subject_id: number }) => {
    const { data } = await supabase.from('teacher_assignments').insert(fields).select().single();
    return { data };
  },
  delete: async (id: number) => {
    await supabase.from('teacher_assignments').delete().eq('id', id);
  },
};

// ─── Images / Documents ────────────────────────────────────────────

export const imagesApi = {
  bySubject: async (subjectId: number) => {
    const { data } = await supabase.from('images').select('*').eq('subject_id', subjectId).order('number');
    return { data: data || [] };
  },
  upload: async (subjectId: number, classId: number, title: string, file: File) => {
    const ext = file.name.split('.').pop() || 'jpg';
    const storagePath = `uploads/class_${classId}/subject_${subjectId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('uploads').upload(storagePath, file);
    if (uploadError) throw uploadError;

    const { data: last } = await supabase.from('images').select('number').eq('subject_id', subjectId).order('number', { ascending: false }).limit(1);
    const nextNum = (last && last.length > 0) ? last[0].number + 1 : 1;

    const { data: user } = await supabase.auth.getUser();
    const { data } = await supabase.from('images').insert({
      title, number: nextNum, status: 'pending', file_path: storagePath,
      class_id: classId, subject_id: subjectId, uploaded_by: user.user?.id,
    }).select().single();
    return { data };
  },
  uploadMultiple: async (classId: number, subjectId: number, files: File[]) => {
    const results: any[] = [];
    for (const file of files) {
      const { data: last } = await supabase.from('images').select('number').eq('subject_id', subjectId).order('number', { ascending: false }).limit(1);
      const nextNum = (last && last.length > 0) ? last[0].number + 1 : 1;
      const ext = file.name.split('.').pop() || 'jpg';
      const storagePath = `uploads/class_${classId}/subject_${subjectId}/${nextNum.toString().padStart(3, '0')}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('uploads').upload(storagePath, file);
      if (uploadError) continue;

      const { data: user } = await supabase.auth.getUser();
      const { data } = await supabase.from('images').insert({
        title: `${subjectId} - ${nextNum.toString().padStart(3, '0')}`,
        number: nextNum, status: 'pending', file_path: storagePath,
        class_id: classId, subject_id: subjectId, uploaded_by: user.user?.id,
      }).select().single();
      if (data) results.push(data);
    }
    return { data: { message: `Uploaded ${results.length} image(s)`, images: results } };
  },
  markInReview: async (id: number) => {
    await supabase.from('images').update({ status: 'in_review' }).eq('id', id);
  },
  getOcrText: async (subjectId: number) => {
    const { data } = await supabase.from('subjects').select('ocr_text').eq('id', subjectId).single();
    return { data: { ocr_text: data?.ocr_text || '' } };
  },
  updateOcrText: async (subjectId: number, ocrText: string) => {
    await supabase.from('subjects').update({ ocr_text: ocrText }).eq('id', subjectId);
  },
  buildDocx: async (subjectId: number) => {
    const { data: subj } = await supabase.from('subjects').select('*, classes!inner(name)').eq('id', subjectId).single();
    if (!subj?.ocr_text) throw new Error('No OCR text');
    // Mark as pending processing — worker picks this up
    await supabase.from('subjects').update({ status: 'docx_pending' }).eq('id', subjectId);
    return { data: { message: 'Queued for DOCX generation', docx_path: null, previews: [] } };
  },
  exportPdf: async (_subjectId: number) => {
    // Handled by worker
    return { data: { message: 'Queued', file_path: '', page_count: 0 } };
  },
  delete: async (id: number) => {
    const { data: img } = await supabase.from('images').select('*').eq('id', id).single();
    if (img?.file_path) await supabase.storage.from('uploads').remove([img.file_path]);
    if (img?.pdf_path) await supabase.storage.from('generated').remove([img.pdf_path]);
    await supabase.from('images').delete().eq('id', id);
  },
  ocr: async (subjectId: number, _apiKey?: string, _instructions?: string) => {
    // Mark for worker
    await supabase.from('subjects').update({ status: 'ocr_pending' }).eq('id', subjectId);
    return { data: { message: 'Queued for OCR', ocr_text: '' } };
  },
  impose: async (subjectId: number, _params?: any) => {
    const { data: subj } = await supabase.from('subjects').select('*').eq('id', subjectId).single();
    if (!subj?.docx_path) throw new Error('No DOCX built yet');
    await supabase.from('subjects').update({ status: 'impose_pending' }).eq('id', subjectId);
    return { data: { message: 'Queued for imposition', file_path: '', previews: [] } };
  },
  downloadPdf: async (_subjectId: number) => {
    throw new Error('Use storage endpoint after worker completes');
  },
  downloadDocx: async (_subjectId: number) => {
    throw new Error('Use storage endpoint after worker completes');
  },
  downloadImposed: async (_subjectId: number) => {
    throw new Error('Use storage endpoint after worker completes');
  },
};

// ─── Dashboard ─────────────────────────────────────────────────────

export const dashboardApi = {
  teacher: async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { data: { subjects: [] } };
    const { data: profile } = await supabase.from('users').select('*').eq('auth_id', authUser.id).single();
    if (!profile) return { data: { subjects: [] } };
    const { data: assignments } = await supabase
      .from('teacher_assignments')
      .select('*, classes(name), subjects(name, status)')
      .eq('teacher_id', profile.id);
    const subjects = (assignments || []).map((a: any) => ({
      class_name: a.classes?.name || '', subject_name: a.subjects?.name || '',
      subject_id: a.subject_id, class_id: a.class_id, status: a.subjects?.status || 'active',
    }));
    return { data: { subjects } };
  },
  admin: async () => {
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: totalSubjects } = await supabase.from('subjects').select('*', { count: 'exact', head: true });
    const { count: totalImages } = await supabase.from('images').select('*', { count: 'exact', head: true });
    const { count: totalTeachers } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher');
    const { data: recent } = await supabase.from('images').select('*, subjects(name), classes(name)').order('created_at', { ascending: false }).limit(10);
    const totalClasses = 0; // computed from seed — constant 13
    return {
      data: {
        total_images: totalImages || 0, pending: 0, in_review: 0, completed: 0,
        total_teachers: totalTeachers || 0, total_subjects: totalSubjects || 0,
        total_classes: totalClasses, total_users: totalUsers || 0,
        recent_uploads: (recent || []).map((r: any) => ({
          ...r, subject_name: r.subjects?.name, class_name: r.classes?.name,
        })),
      },
    };
  },
  structure: async () => {
    const { data: classes } = await supabase.from('classes').select('*, subjects(*)').order('id');
    return { data: classes || [] };
  },
};

// ─── Admin ─────────────────────────────────────────────────────────

export const adminApi = {
  teachers: async () => {
    const { data } = await supabase.from('users').select('*').eq('role', 'teacher');
    return { data: (data || []).map(mapUser) };
  },
  teacherAssignments: async (id: number) => {
    const { data } = await supabase.from('teacher_assignments').select('*, classes(name), subjects(name)').eq('teacher_id', id);
    return { data: data || [] };
  },
  addAssignment: async (teacherId: number, classId: number, subjectId: number) => {
    const { data } = await supabase.from('teacher_assignments').insert({ teacher_id: teacherId, class_id: classId, subject_id: subjectId }).select().single();
    return { data };
  },
  addAssignmentsBatch: async (teacherId: number, classId: number, subjectIds: number[]) => {
    const rows = subjectIds.map(sid => ({ teacher_id: teacherId, class_id: classId, subject_id: sid }));
    const { data } = await supabase.from('teacher_assignments').insert(rows).select();
    return { data };
  },
  removeAssignment: async (id: number) => {
    await supabase.from('teacher_assignments').delete().eq('id', id);
  },
  createTeacher: async (fields: { username: string; email: string; password: string; full_name: string; role: string; school_id?: number | null }) => {
    const { error } = await supabase.auth.signUp({
      email: fields.email,
      password: fields.password,
      options: {
        data: {
          full_name: fields.full_name,
          username: fields.username,
          role: fields.role || 'teacher',
          school_id: fields.school_id,
        },
      },
    });
    if (error) throw error;
    // Wait briefly for the trigger to create the profile
    await new Promise(r => setTimeout(r, 1000));
    const { data } = await supabase.from('users').select('*').eq('email', fields.email).single();
    return { data: mapUser(data) };
  },
  deleteTeacher: async (id: number) => {
    // Get the auth_id first, then delete
    const { data: user } = await supabase.from('users').select('auth_id').eq('id', id).single();
    if (user?.auth_id) {
      await supabase.from('users').delete().eq('auth_id', user.auth_id);
    } else {
      await supabase.from('users').delete().eq('id', id);
    }
  },
};
