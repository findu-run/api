import { appriseProvider } from './providers/apprise'

import { getFunnyNotificationMessage } from './get-funny-notification-message'

import type { NotificationEvent } from './events'
import { getBarkNotificationConfig } from './providers/bark/bark-utils'
import { sendBarkDirect } from './providers/bark/bark-direct'

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

  const barkConfig = getBarkNotificationConfig(event, deviceKey, generatedTitle)

  const finalIcon = icon || barkConfig.icon
  const finalLevel = level || barkConfig.level
  const finalVolume = volume ?? barkConfig.volume
  const finalUrl = url || barkConfig.url

  if (!skipApprise) {
    await appriseProvider.send({
      title: generatedTitle,
      message: generatedMessage,
      channels: ['bark'],
      image: finalIcon,
    })
  }

  if (deviceKey || deviceKeys) {
    await sendBarkDirect({
      title: generatedTitle,
      body: generatedMessage,
      icon: finalIcon,
      url: finalUrl,
      level: finalLevel,
      volume: finalVolume,
      device_key: deviceKey,
      device_keys: deviceKeys,
    })
  }
}
