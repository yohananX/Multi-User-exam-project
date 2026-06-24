import { supabase } from '../lib/supabase';
import { backendPost, backendGet, backendPut, backendDelete, getAuthHeaders, BACKEND_URL } from './client';
import type { User, Class, Subject, School, TeacherAssignment, Notification, SubjectDownload } from '../types';

// ─── Helpers ───────────────────────────────────────────────────────

function mapUser(r: any): User {
  return { id: r.id, auth_id: r.auth_id || '', username: r.username || '', email: r.email, full_name: r.full_name, role: r.role, school_id: r.school_id, created_at: r.created_at };
}

function mapSubject(r: any): Subject {
  return {
    id: r.id, name: r.name, class_id: r.class_id, status: r.status,
    ocr_text: r.ocr_text, docx_path: r.docx_path, imposed_pdf_path: r.imposed_pdf_path,
    docx_preview_paths: r.docx_preview_paths ?? null,
    impose_preview_paths: r.impose_preview_paths ?? null,
    rejection_reason: r.rejection_reason ?? null,
    released: r.released ?? false,
    released_at: r.released_at ?? null,
    term: r.term ?? null,
    exam_type: r.exam_type ?? null,
  };
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
      email: fields.email!,
      password: fields.password,
      email_confirm: true,
      user_metadata: {
        full_name: fields.full_name,
        username: fields.username,
        role: fields.role,
        school_id: fields.school_id,
      }
    });
    if (authError) throw authError;
    const { data, error } = await supabase.from('users').upsert({
      auth_id: authData.user!.id,
      email: fields.email,
      full_name: fields.full_name,
      username: fields.username,
      role: fields.role,
      school_id: fields.school_id,
    }, { onConflict: 'email' }).select().single();
    if (error) throw error;
    return { data: mapUser(data) };
  },
  delete: async (id: number) => {
    const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: id });
    if (error) {
      await supabase.from('users').delete().eq('id', id);
    }
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
  'Nursery 1', 'Nursery 2', 'Reception', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
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
  byStatus: async (status: string) => {
    const { data } = await supabase
      .from('subjects')
      .select('*, classes(name)')
      .eq('status', status)
      .order('id');
    return { data: (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      class_id: s.class_id,
      class_name: s.classes?.name || '',
      status: s.status,
      ocr_text: s.ocr_text,
      docx_path: s.docx_path,
      imposed_pdf_path: s.imposed_pdf_path,
    })) };
  },
  release: async (subjectId: number): Promise<void> => {
    const { error } = await supabase
      .from('subjects')
      .update({
        released: true,
        released_at: new Date().toISOString(),
      })
      .eq('id', subjectId);
    if (error) throw error;
  },
  getImposedPdfUrl: async (subjectId: number): Promise<string> => {
    const { data: subject, error: fetchError } = await supabase
      .from('subjects')
      .select('imposed_pdf_path')
      .eq('id', subjectId)
      .single();
    if (fetchError) throw fetchError;
    if (!subject?.imposed_pdf_path) throw new Error('No PDF available for this subject');
    const { data, error } = await supabase
      .storage
      .from('uploads')
      .createSignedUrl(subject.imposed_pdf_path, 3600);
    if (error || !data?.signedUrl) throw new Error('Could not generate download URL');
    return data.signedUrl;
  },
  isReleased: async (subjectIds: number[]): Promise<Record<number, boolean>> => {
    if (subjectIds.length === 0) return {};
    const { data, error } = await supabase
      .from('subjects')
      .select('id, released, imposed_pdf_path')
      .in('id', subjectIds)
      .eq('released', true);
    if (error) throw error;
    const result: Record<number, boolean> = {};
    (data ?? []).forEach(s => {
      result[s.id] = s.released && !!s.imposed_pdf_path;
    });
    return result;
  },
  listWithImposed: async (): Promise<any[]> => {
    const { data, error } = await supabase
      .from('subjects')
      .select('*, classes(name)')
      .not('imposed_pdf_path', 'is', null)
      .order('class_id, name');
    if (error) throw error;
    return data || [];
  },
  bulkRelease: async (subjectIds: number[]): Promise<void> => {
    if (subjectIds.length === 0) return;
    const { error } = await supabase
      .from('subjects')
      .update({
        released: true,
        released_at: new Date().toISOString(),
      })
      .in('id', subjectIds);
    if (error) throw error;
  },
  unrelease: async (subjectId: number): Promise<void> => {
    const { error } = await supabase
      .from('subjects')
      .update({
        released: false,
        released_at: null,
      })
      .eq('id', subjectId);
    if (error) throw error;
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
    try {
      await backendPut(`/api/images/by-subject/${subjectId}/ocr-text`, { ocr_text: ocrText });
    } catch {
      await supabase.from('subjects').update({ ocr_text: ocrText }).eq('id', subjectId);
    }
  },

  delete: async (id: number) => {
    const { data: img } = await supabase.from('images').select('*').eq('id', id).single();
    if (img?.file_path) await supabase.storage.from('uploads').remove([img.file_path]);
    if (img?.pdf_path) await supabase.storage.from('uploads').remove([img.pdf_path]);
    await supabase.from('images').delete().eq('id', id);
  },
  ocr: async (subjectId: number, _apiKey?: string, _instructions?: string) => {
    try {
      const result = await backendPost(`/api/images/by-subject/${subjectId}/ocr`);
      return { data: { message: 'OCR complete', ocr_text: result.ocr_text || '' } };
    } catch {
      await supabase.from('subjects').update({ status: 'ocr_pending' }).eq('id', subjectId);
      return { data: { message: 'Queued for OCR (worker pending)', ocr_text: '' } };
    }
  },
  impose: async (subjectId: number, params?: { cols?: number; rows?: number; margin_mm?: number; gap_mm?: number; page_margin_cm?: number; split_mode?: string; header_pg2?: boolean; manual_scale_a?: number; manual_scale_b?: number; scale_a?: number; scale_b?: number }) => {
    const { data: subj } = await supabase.from('subjects').select('*').eq('id', subjectId).single();
    if (!subj?.ocr_text && !subj?.docx_path) throw new Error('No OCR text found. Run OCR first.');
    try {
      const qs = new URLSearchParams()
      if (params?.cols) qs.set('cols', String(params.cols))
      if (params?.rows) qs.set('rows', String(params.rows))
      if (params?.margin_mm) qs.set('margin_mm', String(params.margin_mm))
      if (params?.gap_mm) qs.set('gap_mm', String(params.gap_mm))
      if (params?.page_margin_cm) qs.set('page_margin_cm', String(params.page_margin_cm))
      if (params?.split_mode) qs.set('split_mode', params.split_mode)
      if (params?.header_pg2) qs.set('header_pg2', 'true')
      if (params?.manual_scale_a) qs.set('manual_scale_a', String(params.manual_scale_a))
      if (params?.manual_scale_b) qs.set('manual_scale_b', String(params.manual_scale_b))
      if (params?.scale_a) qs.set('scale_a', String(params.scale_a))
      if (params?.scale_b) qs.set('scale_b', String(params.scale_b))
      const q = qs.toString()
      const result = await backendPost(`/api/images/by-subject/${subjectId}/impose${q ? '?' + q : ''}`);
      return { data: { message: 'Imposition complete', file_path: result.file_path || result.imposed_path || '', previews: result.previews || [] } };
    } catch {
      await supabase.from('subjects').update({ status: 'impose_pending' }).eq('id', subjectId);
      return { data: { message: 'Queued for imposition (worker pending)', file_path: '', previews: [] } };
    }
  },
  downloadPdf: async (subjectId: number) => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/images/by-subject/${subjectId}/download-pdf`, { headers });
    if (!res.ok) throw new Error('No PDF available');
    const { url } = await res.json();
    window.open(url, '_blank');
  },

  downloadImposed: async (subjectId: number): Promise<{ url: string; filename: string }> => {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BACKEND_URL}/api/images/by-subject/${subjectId}/download-imposed`, { headers });
    if (!res.ok) throw new Error('No imposed PDF available');
    const data = await res.json();
    return { url: data.url, filename: data.filename || 'Exam.pdf' };
  },
};

// ─── Dashboard ─────────────────────────────────────────────────────

export const dashboardApi = {
  teacher: async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { data: { subjects: [], images: [], unread: 0, stats: {} } };

    // Try fetching assignments by auth_id (column added in run_all.sql)
    let assignments: any[] = [];
    const { data: authAssignments, error: authErr } = await supabase
      .from('teacher_assignments')
      .select('*, classes(name), subjects(name, status, released, imposed_pdf_path, term, exam_type)')
      .eq('auth_id', authUser.id);
    if (!authErr && authAssignments) {
      assignments = authAssignments;
    } else {
      // Fallback: lookup user in users table, then query by teacher_id
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .maybeSingle();
      if (profile) {
        const { data: fallback } = await supabase
          .from('teacher_assignments')
          .select('*, classes(name), subjects(name, status, released, imposed_pdf_path, term, exam_type)')
          .eq('teacher_id', profile.id);
        if (fallback) assignments = fallback;
      }
    }

    const subjects = assignments.map((a: any) => ({
      class_name: a.classes?.name || '', subject_name: a.subjects?.name || '',
      subject_id: a.subject_id, class_id: a.class_id, status: a.subjects?.status || 'active',
      released: a.subjects?.released ?? false,
      imposed_pdf_path: a.subjects?.imposed_pdf_path ?? null,
      term: a.subjects?.term ?? null,
      exam_type: a.subjects?.exam_type ?? null,
      created_at: a.created_at,
    }));

    // Count images and get recent uploads across this teacher's subjects
    const subjectIds = subjects.map((s: any) => s.subject_id).filter(Boolean);
    let totalImages = 0, pendingImages = 0, completedImages = 0;
    let recentUploads: any[] = [];
    if (subjectIds.length > 0) {
      const { data: imageCounts } = await supabase
        .from('images')
        .select('status')
        .in('subject_id', subjectIds);
      if (imageCounts) {
        totalImages = imageCounts.length;
        pendingImages = imageCounts.filter((i: any) => i.status === 'pending').length;
        completedImages = imageCounts.filter((i: any) => i.status === 'completed').length;
      }

      // Fetch the actual recent uploads for the dashboard activity feed
      const { data: uploads } = await supabase
        .from('images')
        .select('*, subjects(name), classes(name)')
        .in('subject_id', subjectIds)
        .order('created_at', { ascending: false })
        .limit(10);
      if (uploads) {
        recentUploads = uploads.map((u: any) => ({
          id: u.id,
          title: u.title,
          number: u.number,
          status: u.status,
          file_path: u.file_path,
          class_id: u.class_id,
          subject_id: u.subject_id,
          created_at: u.created_at,
          subject_name: u.subjects?.name || '',
          class_name: u.classes?.name || '',
        }));
      }
    }

    // Count unread messages
    let unread = 0;
    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('id')
        .eq('recipient_id', authUser.id)
        .eq('read', false);
      if (msgs) unread = msgs.length;
    } catch { /* table may not exist */ }

    return {
      data: {
        subjects,
        images: { total: totalImages, pending: pendingImages, completed: completedImages },
        unread,
        recent_uploads: recentUploads,
        stats: {
          total_subjects: subjects.length,
          completed_subjects: subjects.filter((s: any) => s.status === 'completed').length,
          pending_subjects: subjects.filter((s: any) => s.status !== 'completed').length,
          total_images: totalImages,
          pending_images: pendingImages,
          completed_images: completedImages,
        },
      },
    };
  },
  admin: async () => {
    const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
    const { count: totalSubjects } = await supabase.from('subjects').select('*', { count: 'exact', head: true });
    const { count: totalImages } = await supabase.from('images').select('*', { count: 'exact', head: true });
    const { count: totalTeachers } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'teacher');

    // Fetch subjects with class names and image stats for pipeline
    const { data: subjects } = await supabase
      .from('subjects')
      .select('*, classes(name)');
    const subjList = subjects || [];

    // Get image counts per subject
    const { data: allImages } = await supabase
      .from('images')
      .select('subject_id, status');
    const imgMap: Record<number, { total: number; pending: number; in_review: number; completed: number }> = {};
    (allImages || []).forEach((img: any) => {
      if (!imgMap[img.subject_id]) imgMap[img.subject_id] = { total: 0, pending: 0, in_review: 0, completed: 0 };
      imgMap[img.subject_id].total++;
      if (img.status === 'pending') imgMap[img.subject_id].pending++;
      else if (img.status === 'in_review') imgMap[img.subject_id].in_review++;
      else if (img.status === 'completed') imgMap[img.subject_id].completed++;
    });

    // Determine pipeline stage for each subject
    const needsOcr: any[] = []
    const needsImpose: any[] = []
    const completedPipe: any[] = []
    let pendingImageCount = 0
    let inReviewCount = 0
    let completedImageCount = 0

    subjList.forEach((s: any) => {
      const stats = imgMap[s.id] || { total: 0, pending: 0, in_review: 0, completed: 0 }
      pendingImageCount += stats.pending
      inReviewCount += stats.in_review
      completedImageCount += stats.completed
      const item = {
        id: s.id, name: s.name, class_id: s.class_id,
        class_name: s.classes?.name || '',
        status: s.status, ocr_text: s.ocr_text,
        docx_path: s.docx_path, imposed_pdf_path: s.imposed_pdf_path,
        image_count: stats.total,
      }
      if (s.imposed_pdf_path) {
        completedPipe.push(item)
      } else if (s.ocr_text) {
        needsImpose.push(item)
      } else if (stats.total > 0) {
        needsOcr.push(item)
      }
    })

    // Recent uploads
    const { data: recent } = await supabase
      .from('images')
      .select('*, subjects(name), classes(name)')
      .order('created_at', { ascending: false })
      .limit(10);

    const totalClasses = 0;

    return {
      data: {
        total_images: totalImages || 0,
        pending: pendingImageCount,
        in_review: inReviewCount,
        completed: completedImageCount,
        total_teachers: totalTeachers || 0,
        total_subjects: totalSubjects || 0,
        total_classes: totalClasses,
        total_users: totalUsers || 0,
        pipeline: {
          needs_ocr: needsOcr,
          needs_impose: needsImpose,
          completed: completedPipe,
        },
        recent_uploads: (recent || []).map((r: any) => ({
          ...r, subject_name: r.subjects?.name, class_name: r.classes?.name,
        })),
      },
    };
  },
  structure: async () => {
    const { data: classes } = await supabase.from('classes').select('*, subjects(*)').order('id');
    const classesData = classes || [];

    const { data: allImages } = await supabase.from('images').select('subject_id, status');
    const imgMap: Record<number, { total: number; pending: number; completed: number }> = {};
    (allImages || []).forEach((img: any) => {
      if (!imgMap[img.subject_id]) imgMap[img.subject_id] = { total: 0, pending: 0, completed: 0 };
      imgMap[img.subject_id].total++;
      if (img.status === 'pending') imgMap[img.subject_id].pending++;
      else if (img.status === 'completed') imgMap[img.subject_id].completed++;
    });

    const enriched = classesData.map((cls: any) => ({
      ...cls,
      subjects: (cls.subjects || []).map((s: any) => ({
        ...s,
        image_count: imgMap[s.id]?.total || 0,
        images: { pending: imgMap[s.id]?.pending || 0, completed: imgMap[s.id]?.completed || 0 },
      })),
    }));

    return { data: enriched };
  },
};

// ─── Messages ──────────────────────────────────────────────────────

export const messagesApi = {
  list: async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return { data: [] };
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${authUser.id},recipient_id.eq.${authUser.id}`)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) return { data: [] };
    return { data: data || [] };
  },
  send: async (recipientId: string, body: string, refs?: { subject_id?: number; image_id?: number; class_id?: number; teacher_ref_id?: number }) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: authUser.id, recipient_id: recipientId, body, ...refs })
      .select()
      .single();
    if (error) throw error;
    return { data };
  },
  markRead: async (messageIds: number[]) => {
    await supabase.from('messages').update({ read: true }).in('id', messageIds);
  },
  getAdmins: async () => {
    try {
      const { data } = await supabase.from('users').select('auth_id, full_name, email').in('role', ['super_admin', 'school_admin']).limit(1);
      return { data: data || [] };
    } catch { return { data: [] } }
  },
  subscribe: (userId: string, onMessage: (msg: any) => void) => {
    const name = `messages-rt-${userId}`
    const existing = supabase.getChannels().find((c: any) => c.topic === name)
    if (existing) supabase.removeChannel(existing)
    return supabase
      .channel(name)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${userId}` },
        (payload) => onMessage(payload.new),
      )
      .subscribe();
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
    const { data: authData, error } = await supabase.auth.signUp({
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
    // Wait briefly for the trigger to create the profile, but then upsert to guarantee auth_id is set
    await new Promise(r => setTimeout(r, 1000));
    const { data, error: upsertError } = await supabase.from('users').upsert({
      auth_id: authData.user?.id,
      email: fields.email,
      username: fields.username,
      full_name: fields.full_name,
      role: fields.role || 'teacher',
      school_id: fields.school_id,
    }, { onConflict: 'email' }).select().single();
    if (upsertError) throw upsertError;
    return { data: mapUser(data) };
  },
  deleteTeacher: async (id: number) => {
    const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: id });
    if (error) {
      const { data: user } = await supabase.from('users').select('auth_id').eq('id', id).single();
      if (user?.auth_id) {
        await supabase.from('users').delete().eq('auth_id', user.auth_id);
      } else {
        await supabase.from('users').delete().eq('id', id);
      }
    }
  },
};

// ─── Notifications ────────────────────────────────────────────────

export const notificationsApi = {
  list: async (userId: number): Promise<Notification[]> => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
  },

  markRead: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id);
    if (error) throw error;
  },

  markAllRead: async (userId: number): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', userId)
      .eq('read', false);
    if (error) throw error;
  },

  dismiss: async (id: number): Promise<void> => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  subscribe: (userId: number, onNew: (n: Notification) => void) => {
    return supabase
      .channel('notifications:' + userId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'recipient_id=eq.' + userId,
        },
        (payload) => onNew(payload.new as Notification),
      )
      .subscribe();
  },
};

// ─── Downloads ──────────────────────────────────────────────────────

export const downloadsApi = {
  list: async (teacherId: number): Promise<SubjectDownload[]> => {
    // Query teacher_assignments → subjects where released=true
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('id', teacherId)
      .maybeSingle()
      .throwOnError();

    const uid = profile?.id || teacherId;

    const { data: assignments, error } = await supabase
      .from('teacher_assignments')
      .select(`
        id,
        subject_id,
        teacher_id,
        subjects!inner(
          id,
          name,
          imposed_pdf_path,
          term,
          exam_type,
          released,
          released_at,
          classes(name)
        )
      `)
      .eq('teacher_id', uid)
      .not('subjects.imposed_pdf_path', 'is', null)
      .eq('subjects.released', true);

    if (error) throw error;

    return (assignments ?? []).map((row: any) => ({
      id: row.id,
      subject_id: row.subject_id,
      teacher_id: row.teacher_id,
      status: 'new' as const,
      released_at: row.subjects?.released_at || '',
      downloaded_at: null,
      subject_name: row.subjects?.name,
      class_name: row.subjects?.classes?.name,
      imposed_pdf_path: row.subjects?.imposed_pdf_path,
      term: row.subjects?.term,
      exam_type: row.subjects?.exam_type,
    }));
  },

  markDownloaded: async (_downloadId: number): Promise<void> => {
    // subject_downloads table may not exist — no-op for now
    return;
  },

  getNewCount: async (teacherId: number): Promise<number> => {
    try {
      const items = await downloadsApi.list(teacherId);
      return items.length;
    } catch {
      return 0;
    }
  },

  getPdfUrl: async (imposedPdfPath: string): Promise<string> => {
    const { data, error } = await supabase
      .storage
      .from('uploads')
      .createSignedUrl(imposedPdfPath, 3600);
    if (error || !data?.signedUrl)
      throw new Error('Could not generate download URL');
    return data.signedUrl;
  },
};
