import { env } from '@/env'

type SendBarkDirectParams = {
  title: string
  body: string
  icon?: string
  url?: string
  level?: 'active' | 'timeSensitive' | 'critical'
  volume?: number
  device_key?: string
  device_keys?: string[]
}

export async function sendBarkDirect({
  title,
  body,
  icon,
  url,
  level,
  volume,
  device_key,
  device_keys,
}: SendBarkDirectParams) {
  const DEFAULT_BARK_ICON = 'https://i.ibb.co/jvRrvLg4/logo.jpg'
  const queryParams = new URLSearchParams()

  queryParams.append('icon', icon || DEFAULT_BARK_ICON)
  if (url) queryParams.append('url', url)
  if (level) queryParams.append('level', level)
  if (volume !== undefined) queryParams.append('volume', volume.toString())

  const endpoint = `${env.BARK_SERVER_URL}/push?icon=https://i.ibb.co/jvRrvLg4/logo.jpg&${queryParams.toString()}`

  const payload = {
    title,
    body,
    ...(device_key ? { device_key } : {}),
    ...(device_keys ? { device_keys } : {}),
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()
    console.log('[BARK DIRECT]', res.status, data)
  } catch (err) {
    console.error('[BARK DIRECT ERROR]', err)
  }
}
