import { ReminderStatus } from './reminder-status.model';

export interface ReminderRequest {
  reminderTime: string;
}

export interface ReminderResponse {
  id: number;
  noteId: number;
  userId: number;
  reminderTime: string;
  status: ReminderStatus;
  createdDate: string;
  updatedDate: string;
}