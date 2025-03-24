import { env } from '@/env'
import type { NotificationChannel } from './@types/types'

export const CHANNEL_URLS: Record<NotificationChannel, string> = {
  bark: env.NOTIFY_URL_BARK,
  ntfy: env.NOTIFY_URL_NTFY,
  email: env.NOTIFY_URL_EMAIL,
}
