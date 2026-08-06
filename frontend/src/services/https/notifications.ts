import type { NotificationItem } from '../../interface/INotificationInterface'
import { apiFetch } from './index'

export function listMyNotifications(token: string, unreadOnly = false): Promise<NotificationItem[]> {
  const query = unreadOnly ? '?unread=true' : ''
  return apiFetch<NotificationItem[]>(`/api/v1/notifications${query}`, { token })
}

export function getUnreadNotificationCount(token: string): Promise<{ unread_count: number }> {
  return apiFetch<{ unread_count: number }>('/api/v1/notifications/unread-count', { token })
}

export function markNotificationRead(token: string, id: number): Promise<{ updated: boolean }> {
  return apiFetch<{ updated: boolean }>(`/api/v1/notifications/${id}/read`, { method: 'PUT', token })
}

export function markAllNotificationsRead(token: string): Promise<{ updated: boolean }> {
  return apiFetch<{ updated: boolean }>('/api/v1/notifications/read-all', { method: 'PUT', token })
}
