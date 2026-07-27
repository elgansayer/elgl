export interface SystemEventPayload {
  type: 'user_joined' | 'system_notification' | 'welcome';
  payload?: Record<string, unknown>;
}
