import { appriseProvider } from './providers/apprise'
import { sendBarkDirect } from './providers/bark-direct'

import type { NotificationEvent } from './events'
import { getFunnyNotificationMessage } from './get-funny-notification-message'
import { getNotificationImageByEvent } from './get-notification-image'

type NotificationPayload = {
  event: NotificationEvent
  orgName?: string
  monitorName?: string

  title?: string
  message?: string
  icon?: string
  url?: string
  level?: 'active' | 'timeSensitive' | 'critical'
  volume?: number

  deviceKey?: string
  deviceKeys?: string[]

  skipApprise?: boolean
}

export async function sendNotification({
  event,
  orgName,
  monitorName,
  title,
  message,
  icon,
  url,
  level,
  volume,
  deviceKey,
  deviceKeys,
  skipApprise,
}: NotificationPayload) {
  const { title: generatedTitle, message: generatedMessage } =
    getFunnyNotificationMessage({
      event,
      orgName,
      monitorName,
      customTitle: title,
      customMessage: message,
    })

  const finalIcon = icon || getNotificationImageByEvent(event)

  if (!skipApprise) {
    await appriseProvider.send({
      title: generatedTitle,
      message: generatedMessage,
      channels: ['bark', 'ntfy'],
    })
  }

  if (deviceKey || deviceKeys) {
    await sendBarkDirect({
      title: generatedTitle,
      body: generatedMessage,
      icon: finalIcon,
      url,
      level,
      volume,
      device_key: deviceKey,
      device_keys: deviceKeys,
    })
  }
}
