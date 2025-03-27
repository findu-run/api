import type { NotificationEvent } from './events'

export function getNotificationImageByEvent(
  event: NotificationEvent,
): string | undefined {
  switch (event) {
    case 'payment.confirmed':
      return 'https://cdn.findu.run/img/payment-confirmed.png'

    case 'purchase.created':
      return 'https://cdn.findu.run/img/purchase-created.png'

    case 'subscription.expiring':
      return 'https://cdn.findu.run/img/subscription-expiring.png'

    case 'usage.limit-reached':
      return 'https://cdn.findu.run/img/usage-limit.png'

    case 'monitoring.down':
      return 'https://cdn.findu.run/img/server-down.png'

    case 'monitoring.up':
      return 'https://cdn.findu.run/img/server-up.png'

    case 'monitoring.unstable':
      return 'https://cdn.findu.run/img/server-unstable.png'

    case 'user.bark-connected':
      return 'https://cdn.findu.run/img/bark-connected.png'

    default:
      return undefined
  }
}
