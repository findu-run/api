import type { NotificationEvent } from '../../events'
import { getNotificationImageByEvent } from '../../get-notification-image'

export function getBarkNotificationConfig(
  event: NotificationEvent,
  deviceKey?: string,
  title?: string,
) {
  const isCritical = event === 'monitoring.down'
  const isWarning = event === 'monitoring.unstable'
  const isRecovery = event === 'monitoring.up'

  const level: 'critical' | 'timeSensitive' | 'active' = isCritical
    ? 'critical'
    : isWarning
      ? 'timeSensitive'
      : 'active'

  const volume = isCritical ? 5 : isWarning ? 3 : 1
  const icon = getNotificationImageByEvent(event)

  const url =
    isCritical && deviceKey && title
      ? `https://bark.findu.run/${deviceKey}/${encodeURIComponent(title)}`
      : undefined

  return {
    level,
    volume,
    icon,
    url,
  }
}
