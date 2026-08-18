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
  price_amount: number | null;
  paid_at: string | null;
  days_paid: number | null;
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
  client_name: string | null;
  client_username: string | null;
  plan: string | null;
  total_paid: number;
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

export const PLAN_INFO: Record<string, { label: string; price: number; days: number }> = {
  hour: { label: 'Час', price: 300, days: 1 },
  day: { label: 'Сутки', price: 2000, days: 1 },
  week: { label: 'Неделя', price: 5000, days: 7 },
  month: { label: 'Месяц', price: 10000, days: 30 },
};

export const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  approved: 'Одобрена',
  rejected: 'Отклонена',
};