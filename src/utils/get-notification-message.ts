import type { NotificationEvent } from '@/lib/notifier/events'

type Params = {
  event: NotificationEvent
  orgName?: string
  monitorName?: string
}

export function getNotificationMessageByEvent({
  event,
  orgName,
  monitorName,
}: Params) {
  switch (event) {
    case 'monitoring.down':
      return {
        title: `🚨 ${monitorName ?? 'Um serviço'} caiu!`,
        message: `Atenção, ${orgName ?? 'cliente'}: o monitor "${monitorName}" detectou uma queda de serviço.`,
      }

    case 'monitoring.up':
      return {
        title: `✅ ${monitorName ?? 'Serviço'} voltou ao ar`,
        message: `Tudo certo, ${orgName ?? 'cliente'}! O serviço "${monitorName}" está novamente disponível.`,
      }

    case 'monitoring.unstable':
      return {
        title: `⚠️ Instabilidade em ${monitorName}`,
        message: `${orgName ?? 'cliente'}, estamos vendo instabilidades em "${monitorName}".`,
      }

    case 'payment.confirmed':
      return {
        title: '💰 Pagamento confirmado',
        message: `Obrigado, ${orgName ?? 'cliente'}! O pagamento da sua assinatura foi confirmado com sucesso.`,
      }

    case 'subscription.expiring':
      return {
        title: '⏳ Sua assinatura está prestes a vencer',
        message: `Ei ${orgName ?? 'cliente'}, renove sua assinatura para não perder acesso às funcionalidades.`,
      }

    case 'usage.limit-reached':
      return {
        title: '🚫 Limite de uso atingido',
        message: `${orgName ?? 'cliente'}, você atingiu o limite de requisições. Faça um upgrade para continuar.`,
      }

    case 'user.bark-connected':
      return {
        title: '🔔 Dispositivo conectado',
        message: `${orgName ?? 'cliente'}, seu dispositivo Bark foi conectado com sucesso!`,
      }

    default:
      return {
        title: '🔔 Notificação',
        message: 'Você recebeu uma notificação.',
      }
  }
}
