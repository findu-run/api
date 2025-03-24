import type { NotificationEvent } from './events'

type NotificationChannel = 'bark' | 'ntfy' | 'email'

export const NOTIFICATION_CHANNELS: Record<
  NotificationEvent,
  NotificationChannel[]
> = {
  'payment.confirmed': ['ntfy', 'email'],
  'purchase.created': ['ntfy', 'email'],
  'subscription.expiring': ['ntfy', 'email'],
  'usage.limit-reached': ['bark', 'ntfy'],
  'monitoring.down': ['bark'],
  'monitoring.up': ['ntfy'],
  'monitoring.unstable': ['ntfy'],
  'custom.manual': ['ntfy'],
}
