import type { NotificationEvent } from './events'

type EventParams = {
  event: NotificationEvent
  orgName?: string
  monitorName?: string
  customTitle?: string
  customMessage?: string
}

const funnyMessages: Record<NotificationEvent, ((name: string) => string)[]> = {
  'payment.confirmed': [
    (name) =>
      `💸 ${name}, pagamento recebido! Agora você é oficialmente chique.`,
    (name) => `✅ O dindin caiu na conta, ${name}. Tá liberado o acesso!`,
    (name) => `🎉 Grana confirmada, ${name}. Bora usar sem medo!`,
  ],

  'purchase.created': [
    (name) => `🛍️ Nova compra registrada por ${name}. Gastar é preciso!`,
    (name) =>
      `🧾 ${name} fez uma nova aquisição. Cheirinho de coisa nova no ar.`,
  ],

  'subscription.expiring': [
    (name) =>
      `⏳ Ei ${name}, sua assinatura está vencendo. Hora de renovar ou dizer adeus.`,
    (name) => `🚨 Última chamada, ${name}! A assinatura vai expirar.`,
  ],

  'usage.limit-reached': [
    (name) => `📉 ${name}, você usou tudo! Requisições esgotadas.`,
    (name) => `🚫 Acabaram os créditos, ${name}. Hora de pensar em um upgrade.`,
  ],

  'monitoring.down': [
    (name) => `🚨 Alerta! O serviço ${name} caiu igual conexão de Wi-Fi ruim.`,
    (name) => `🧯 Opa, ${name} saiu do ar! Liga o modo pânico.`,
  ],

  'monitoring.up': [
    (name) => `✅ ${name} está de volta! A lenda reviveu.`,
    (name) => `🎉 ${name} voltou pro jogo. Pode desligar o modo desespero.`,
  ],

  'monitoring.unstable': [
    (name) => `⚠️ ${name} está com soluços técnicos. Algo tá oscilando.`,
    (name) =>
      `😐 ${name} não decide se fica ou se vai. Instabilidade detectada.`,
  ],

  'user.bark-connected': [
    (name) => `🔔 Dispositivo Bark conectado com sucesso para ${name}.`,
    (name) => `📱 ${name} ativou notificações via Bark. Agora é só alegria.`,
  ],

  'custom.manual': [
    (name) => `👀 ${name}, você recebeu uma notificação manual.`,
    (name) => `💬 O administrador mandou um alô pra você, ${name}.`,
  ],
}

export function getFunnyNotificationMessage({
  event,
  orgName,
  monitorName,
  customTitle,
  customMessage,
}: EventParams) {
  if (customTitle || customMessage) {
    return {
      title: customTitle ?? '🔔 Notificação',
      message: customMessage ?? '',
    }
  }

  const templates = funnyMessages[event]
  const name = monitorName || orgName || 'usuário'
  const index = Math.floor(Math.random() * templates.length)

  return {
    title: getTitlePrefix(event) + name,
    message: templates[index](name),
  }
}

function getTitlePrefix(event: NotificationEvent): string {
  switch (event) {
    case 'monitoring.down':
      return '🔥 Instabilidade detectada: '
    case 'monitoring.up':
      return '🎉 Recuperado: '
    case 'usage.limit-reached':
      return '🚫 Limite alcançado: '
    case 'subscription.expiring':
      return '⏳ Assinatura expira em breve: '
    case 'payment.confirmed':
      return '💰 Pagamento recebido: '
    case 'purchase.created':
      return '🛒 Compra registrada: '
    case 'user.bark-connected':
      return '🔗 Bark conectado: '
    case 'custom.manual':
      return '📣 Notificação personalizada: '
    default:
      return '🔔 Alerta: '
  }
}
