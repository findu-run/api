import type { NotificationChannel } from './@types/types'

export type SendNotificationParams = {
  title: string
  message: string
  channels: NotificationChannel[]
  image?: string
}

export interface NotificationProvider {
  send(params: SendNotificationParams): Promise<void>
}
