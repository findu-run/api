import type { NotificationProvider, SendNotificationParams } from '../client'
import { CHANNEL_URLS } from '../channel-urls'
import { env } from '@/env'

const APPRISE_URL = env.APPRISE_URL || 'http://localhost:8000/notify'

export const appriseProvider: NotificationProvider = {
  async send({ title, message, channels }: SendNotificationParams) {
    const urls = channels.map((channel) => CHANNEL_URLS[channel])

    console.log('[NOTIFY] Sending to Apprise:')
    console.log('Title:', title)
    console.log('Message:', message)
    console.log('URLs:', urls)
    console.log('Endpoint:', APPRISE_URL)

    try {
      const response = await fetch(APPRISE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body: message,
          urls,
        }),
      })

      console.log('[NOTIFY] Status:', response.status)
      console.log('[NOTIFY] Body:', await response.text())
    } catch (error) {
      console.error('[APPRISE] Notification failed:', error)
    }
  },
}
