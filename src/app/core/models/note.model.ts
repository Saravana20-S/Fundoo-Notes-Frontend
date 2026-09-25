export interface NoteRequest {
  title: string;
  content: string;
}

export interface NoteResponse {
  id: number;
  title: string;
  content: string;

  pinned: boolean;
  archived: boolean;
  trashed: boolean;

  createdDate: string;
  updatedDate: string;

  labels?: LabelResponse[];
}

export interface LabelResponse {
  id: number;
  name: string;
}