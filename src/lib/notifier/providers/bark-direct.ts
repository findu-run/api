import { env } from '@/env'

type SendBarkDirectParams = {
  title: string
  body: string
  device_key?: string
  device_keys?: string[]
}

export async function sendBarkDirect({
  title,
  body,
  device_key,
  device_keys,
}: SendBarkDirectParams) {
  const payload: any = {
    title,
    body,
  }

  if (device_key) payload.device_key = device_key
  if (device_keys) payload.device_keys = device_keys

  try {
    const res = await fetch(`${env.BARK_SERVER_URL}/push`, {
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
