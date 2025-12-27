
export type CourseLevel = 'SEE' | '+2' | 'Bachelor' | 'Master';
export type CourseStructure = 'Semester' | 'Yearly';
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'note';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface Course {
  id: string;
  user_id: string;
  name: string;
  type: CourseLevel;
  structure: CourseStructure | null;
  period_value: number | null;
  joined_date: string;
  created_at: string;
}

export interface Subject {
  id: string;
  course_id: string;
  name: string;
}

export interface MediaAttachment {
  id: string;
  study_log_id: string;
  type: MediaType;
  file_url: string;
  file_name: string;
  created_at: string;
}

export interface StudyLog {
  id: string;
  subject_id: string;
  user_id: string;
  day_number: number;
  title: string | null;
  content_text: string | null;
  created_at: string;
  // Optional property for joined queries
  media_attachments?: MediaAttachment[];
}
