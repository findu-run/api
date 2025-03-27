import type { NotificationEvent } from './events'

type NotificationChannel = 'bark' | 'ntfy' | 'email'

export const NOTIFICATION_CHANNELS: Record<
  NotificationEvent,
  NotificationChannel[]
> = {
  'payment.confirmed': ['bark'],
  'purchase.created': ['bark'],
  'subscription.expiring': ['bark'],
  'usage.limit-reached': ['bark'],
  'monitoring.down': ['bark'],
  'monitoring.up': ['bark'],
  'monitoring.unstable': ['bark'],
  'custom.manual': ['bark'],
  'user.bark-connected': ['bark'],
}
