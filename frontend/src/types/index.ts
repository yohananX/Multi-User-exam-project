export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'school_admin' | 'teacher';
  school_id: number | null;
}

export interface School {
  id: number;
  name: string;
  address: string | null;
}

export interface Class {
  id: number;
  name: string;
  section: string | null;
  school_id: number;
}

export interface Subject {
  id: number;
  name: string;
  class_id: number;
  status?: string;
  ocr_text?: string | null;
  docx_path?: string | null;
  imposed_pdf_path?: string | null;
}

export interface TeacherAssignment {
  id: number;
  teacher_id: number;
  class_id: number;
  subject_id: number;
}
