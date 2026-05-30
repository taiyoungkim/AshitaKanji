export type ExamplePermissionStatus = 'cleared' | 'pending' | 'blocked' | 'self';
export type ExampleQaStatus = 'verified' | 'auto' | 'needs_review' | 'rejected';

export interface WordExample {
  id: number;
  word_id: string;
  jp: string;
  ko: string | null;
  source: string;
  source_url: string | null;
  license: string | null;
  permission_status: ExamplePermissionStatus;
  attribution: string | null;
  captured_at: number | null;
  qa_status: ExampleQaStatus;
  sort_order: number;
}
