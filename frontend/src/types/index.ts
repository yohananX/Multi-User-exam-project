export interface User {
  id: number
  auth_id: string
  username: string
  email: string
  full_name: string
  role: 'super_admin' | 'school_admin' | 'teacher'
  school_id: number | null
  created_at?: string
}

export interface School {
  id: number
  name: string
  address: string | null
}

export interface Class {
  id: number
  name: string
  section: string | null
  school_id: number
}

export interface Subject {
  id: number
  name: string
  class_id: number
  status: string | null
  ocr_text: string | null
  docx_path: string | null
  imposed_pdf_path: string | null
  docx_preview_paths: string[] | null
  impose_preview_paths: string[] | null
  rejection_reason: string | null
  released: boolean
  released_at: string | null
  term: string | null
  exam_type: string | null
  created_at?: string
}

export interface TeacherAssignment {
  id: number
  teacher_id: number
  class_id: number
  subject_id: number
  class?: Class
  subject?: Subject
}

export interface Submission {
  id: number
  title: string
  number: number
  status: 'pending' | 'in_review' | 'processing' | 'completed' | 'rejected'
  file_path: string | null
  pdf_path: string | null
  class_id: number
  subject_id: number
  uploaded_by: string
  processed_by: string | null
  rejection_reason?: string | null
  created_at: string
  updated_at: string
  subject?: Subject
  class?: Class
}

export interface Message {
  id: number
  sender_id: string
  recipient_id: string
  subject_id: number | null
  image_id: number | null
  class_id: number | null
  teacher_ref_id: number | null
  body: string
  read: boolean
  created_at: string
  sender_name?: string
  subject_name?: string
  image_title?: string
  class_name?: string
  teacher_ref_name?: string
}

export interface Conversation {
  partner_id: string
  partner_name: string
  last_message: Message
  unread_count: number
}

export interface UploadForm {
  classId: string
  subjectId: string
  examType: string
  term: string
  session: string
  files: File[]
}

export interface DashboardStats {
  total_submissions: number
  pending: number
  in_review: number
  processing: number
  completed: number
  rejected: number
  recent_activity: ActivityItem[]
}

export interface ActivityItem {
  id: number
  type: 'upload' | 'approve' | 'reject' | 'process' | 'message' | 'complete'
  message: string
  subject_name?: string
  class_name?: string
  created_at: string
}

export interface Notification {
  id: number
  recipient_id: number
  recipient_role: string
  type: 'new_teacher' | 'script_uploaded' | 'subject_completed' | 'new_message' | 'new_assignment'
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

export interface SubjectDownload {
  id: number;
  subject_id: number;
  teacher_id: number;
  status: 'new' | 'downloaded';
  released_at: string;
  downloaded_at: string | null;
  subject_name?: string;
  class_name?: string;
  imposed_pdf_path?: string;
  docx_path?: string;
  term?: string;
  exam_type?: string;
}
