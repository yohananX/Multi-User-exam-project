import api from './client';
import type { User, Class, Subject, School, TeacherAssignment } from '../types';

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ access_token: string; token_type: string; user: User }>('/auth/login', { username, password }),
  me: () => api.get<User>('/auth/me'),
  register: (data: { username: string; email: string; password: string; full_name: string; school_name?: string }) =>
    api.post<User>('/auth/register', data),
};

export const usersApi = {
  list: () => api.get<User[]>('/users/'),
  create: (data: Partial<User> & { password: string }) =>
    api.post<User>('/users/', data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

export const schoolsApi = {
  list: () => api.get<School[]>('/schools/'),
  create: (data: { name: string; address?: string }) =>
    api.post<School>('/schools/', data),
  delete: (id: number) => api.delete(`/schools/${id}`),
};

export const classesApi = {
  list: () => api.get<Class[]>('/classes/'),
  create: (data: { name: string; section?: string; school_id: number }) =>
    api.post<Class>('/classes/', data),
  delete: (id: number) => api.delete(`/classes/${id}`),
};

export const subjectsApi = {
  list: (classId?: number) =>
    api.get<Subject[]>('/subjects/', { params: { class_id: classId } }),
  create: (data: { name: string; class_id: number }) =>
    api.post<Subject>('/subjects/', data),
  delete: (id: number) => api.delete(`/subjects/${id}`),
  updateStatus: (id: number, status: string) =>
    api.patch(`/subjects/${id}/status`, { status }),
};

export const assignmentsApi = {
  list: () => api.get<TeacherAssignment[]>('/assignments/'),
  create: (data: { teacher_id: number; class_id: number; subject_id: number }) =>
    api.post<TeacherAssignment>('/assignments/', data),
  delete: (id: number) => api.delete(`/assignments/${id}`),
};

export const imagesApi = {
  bySubject: (subjectId: number) =>
    api.get<any[]>(`/images/by-subject/${subjectId}`),
  upload: (subjectId: number, classId: number, title: string, file: File) => {
    const form = new FormData();
    form.append('class_id', String(classId));
    form.append('subject_id', String(subjectId));
    form.append('title', title);
    form.append('file', file);
    return api.post('/images/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadMultiple: (subjectId: number, classId: number, files: File[]) => {
    const form = new FormData();
    form.append('class_id', String(classId));
    form.append('subject_id', String(subjectId));
    files.forEach(f => form.append('files', f));
    return api.post('/images/upload-multiple', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  markInReview: (id: number) => api.post(`/images/${id}/mark-in-review`),
  convert: (id: number) => api.post(`/images/${id}/convert`),
  convertAll: (subjectId: number) => api.post(`/images/by-subject/${subjectId}/convert-all`),
  exportPdf: (subjectId: number) => api.post(`/images/by-subject/${subjectId}/export-pdf`),
  downloadPdfUrl: (subjectId: number) => `/api/images/by-subject/${subjectId}/download-pdf`,
  ocr: (subjectId: number, apiKey?: string, instructions?: string) =>
    api.post(`/images/by-subject/${subjectId}/ocr`, null, { params: { api_key: apiKey || '', instructions: instructions || '' } }),
  getOcrText: (subjectId: number) => api.get<{ ocr_text: string }>(`/images/by-subject/${subjectId}/ocr-text`),
  updateOcrText: (subjectId: number, ocrText: string) =>
    api.put(`/images/by-subject/${subjectId}/ocr-text`, { ocr_text: ocrText }),
  buildDocx: (subjectId: number) => api.post(`/images/by-subject/${subjectId}/build-docx`),
  downloadDocxUrl: (subjectId: number) => `/api/images/by-subject/${subjectId}/download-docx`,
  impose: (subjectId: number, params: { cols?: number; rows?: number; margin_mm?: number; gap_mm?: number; page_margin_cm?: number; split_mode?: string; header_pg2?: boolean; manual_scale_a?: number; manual_scale_b?: number }) =>
    api.post(`/images/by-subject/${subjectId}/impose`, null, { params }),
  downloadImposedUrl: (subjectId: number) => `/api/images/by-subject/${subjectId}/download-imposed`,
  delete: (id: number) => api.delete(`/images/${id}`),
};

export const dashboardApi = {
  teacher: () => api.get<any>('/dashboard/teacher'),
  admin: () => api.get<any>('/dashboard/admin'),
  structure: () => api.get<any[]>('/dashboard/structure'),
};

export const adminApi = {
  teachers: () => api.get<any[]>('/admin/teachers'),
  teacherAssignments: (id: number) => api.get<any[]>(`/admin/teachers/${id}/assignments`),
  addAssignment: (teacherId: number, classId: number, subjectId: number) =>
    api.post(`/admin/teachers/${teacherId}/assignments`, null, { params: { class_id: classId, subject_id: subjectId } }),
  addAssignmentsBatch: (teacherId: number, classId: number, subjectIds: number[]) =>
    api.post(`/admin/teachers/${teacherId}/assignments/batch`, subjectIds, { params: { class_id: classId } }),
  removeAssignment: (id: number) => api.delete(`/admin/assignments/${id}`),
  createTeacher: (data: { username: string; email: string; password: string; full_name: string; role: string; school_id?: number | null }) =>
    api.post<User>('/admin/teachers', data),
  deleteTeacher: (id: number) => api.delete(`/admin/teachers/${id}`),
};
