export interface Resource {
  id: string;
  title: string;
  description?: string;
  url: string;
  category?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  type?: string;
  content?: string;
  topic?: string;
  difficulty?: string; // e.g., 'beginner', 'intermediate', 'advanced'
}
