import ipaddr from 'ipaddr.js'

export function getClientIp(headers: any, socket: any): string | undefined {
  // Prioridade: 1. CF-Connecting-IP (Cloudflare), 2. x-forwarded-for, 3. socket
  const ipCandidates = [
    headers['cf-connecting-ip'], // Header confiável do Cloudflare
    headers['x-forwarded-for'], // Header padrão de proxies
    socket?.remoteAddress, // IP direto do socket
  ]

  // Filtra e processa os candidatos
  for (let ipCandidate of ipCandidates) {
    // Se for array (x-forwarded-for pode vir assim), pega o primeiro
    if (Array.isArray(ipCandidate)) {
      ipCandidate = ipCandidate[0]
    }
    // Se for string, limpa e separa por vírgula (caso de proxies múltiplos)
    else if (typeof ipCandidate === 'string') {
      ipCandidate = ipCandidate.split(',')[0].trim()
    }

    // Se não houver candidato válido, continua para o próximo
    if (!ipCandidate) continue

    try {
      // Valida com ipaddr.js
      const parsedIp = ipaddr.parse(ipCandidate)
      if (parsedIp.kind() === 'ipv4') {
        return parsedIp.toString() // Retorna apenas IPv4 (ex.: "192.168.1.1")
      }
    } catch (e) {}
  }

  // Nenhum IPv4 válido encontrado
  return undefined
}
