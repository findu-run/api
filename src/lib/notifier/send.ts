import type { NotificationEvent } from './events'
import { appriseProvider } from './providers/apprise'
import { sendBarkDirect } from './providers/bark-direct'

type NotificationPayload = {
  event: NotificationEvent
  title: string
  message: string
  deviceKey?: string
  deviceKeys?: string[]
  skipApprise?: boolean
}

export async function sendNotification({
  event,
  title,
  message,
  deviceKey,
  deviceKeys,
  skipApprise,
}: NotificationPayload) {
  if (!skipApprise) {
    await appriseProvider.send({
      title,
      message,
      channels: ['bark', 'ntfy'],
    })
  }

  if (deviceKey || deviceKeys) {
    await sendBarkDirect({
      title,
      body: message,
      device_key: deviceKey,
      device_keys: deviceKeys,
    })
  }
}
