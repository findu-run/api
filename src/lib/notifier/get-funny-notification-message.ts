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
    (name) => `⏳ Ei ${name}, sua assinatura tá quase vencendo! Bora renovar?`,
    (name) =>
      `🚨 Última chamada, ${name}! Sua assinatura vai expirar. Tá preparado?`,
  ],

  'usage.limit-reached': [
    (name) => `📉 ${name}, você usou tudo! As requisições acabaram. 😬`,
    (name) => `🚫 Créditos esgotados, ${name}. Que tal um upgrade agora?`,
  ],

  'monitoring.down': [
    (name) =>
      `🚨 Atenção, ${name}! Nosso serviço tá fora do ar. Já estamos resolvendo!`,
    (name) =>
      `💥 ${name}, parece que nosso sistema deu uma pausa. Calma que já voltamos!`,
  ],

  'monitoring.up': [
    (name) => `✅ Voltamos, ${name}! Tudo certo por aqui de novo. 👨‍🔧`,
    (name) => `🎉 API de pé novamente, ${name}! Pode respirar aliviado.`,
  ],

  'monitoring.unstable': [
    (name) =>
      `⚠️ ${name}, detectamos instabilidade. Estamos monitorando de perto!`,
    (name) =>
      `🤔 ${name}, algo estranho rolando na nossa API. Estamos de olho.`,
  ],

  'user.bark-connected': [
    (name) => `📲 Boa, ${name}! Seu dispositivo tá pronto pra receber alertas.`,
    (name) =>
      `🔔 Conexão feita com sucesso, ${name}. Agora você vai estar por dentro de tudo.`,
  ],

  'custom.manual': [
    (name) => `👀 ${name}, chegou uma notificação personalizada pra você.`,
    (name) => `💬 O administrador mandou um recado, ${name}. Confere aí.`,
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
