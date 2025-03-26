export function getClientIp(headers: any, socket: any): string | undefined {
  const forwarded = headers['x-forwarded-for']
  if (Array.isArray(forwarded)) return forwarded[0]
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return socket?.remoteAddress
}
