import type { NotificationEvent } from './events'

export function getNotificationImageByEvent(
  event: NotificationEvent,
): string | undefined {
  switch (event) {
    case 'payment.confirmed':
      return 'https://i.ibb.co/jvRrvLg4/logo.jpg'

    case 'purchase.created':
      return 'https://i.ibb.co/jvRrvLg4/logo.jpg'

    case 'subscription.expiring':
      return 'https://i.ibb.co/jvRrvLg4/logo.jpg'

    case 'usage.limit-reached':
      return 'https://i.ibb.co/jvRrvLg4/logo.jpg'

    case 'monitoring.down':
      return 'https://i.ibb.co/jvRrvLg4/logo.jpg'

    case 'monitoring.up':
      return 'https://i.ibb.co/jvRrvLg4/logo.jpg'

    case 'monitoring.unstable':
      return 'https://i.ibb.co/jvRrvLg4/logo.jpg'

    case 'user.bark-connected':
      return 'https://i.ibb.co/jvRrvLg4/logo.jpg'

    default:
      return undefined
  }
}
