export interface Campaign {
  id: number;
  state: string;
  posts_sent: number;
  last_sent_at: string | null;
  last_error: string | null;
  expires_at: string | null;
  interval_minutes: number;
  window_start_hour: number;
  window_end_hour: number;
  paused_until: string | null;
}

export interface AdRequest {
  id: number;
  city: string;
  contact: string;
  ad_text: string;
  status: string;
  created_at: string;
  pref_start_hour: number;
  pref_end_hour: number;
  public_token: string | null;
  photo_url: string | null;
  client_notified: boolean;
  can_write: boolean;
  pending: PendingEdit | null;
  campaign: Campaign | null;
}

export interface PendingEdit {
  ad_text: string;
  photo_url: string | null;
  photo_clear: boolean;
  created_at: string;
}

export interface ClientMessage {
  direction: 'in' | 'out';
  text: string;
  created_at: string;
}

export interface CityGroup {
  id: number;
  city: string;
  chat_id: string;
  members: string;
  slots: string;
  is_active: boolean;
  sort_order: number;
}

export const STATE_LABELS: Record<string, string> = {
  running: 'Крутится',
  stopped: 'Остановлено',
  expired: 'Срок вышел',
  archived: 'В архиве',
};

export const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  approved: 'Одобрена',
  rejected: 'Отклонена',
};