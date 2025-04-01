import type { NotificationEvent } from './events'

type EventParams = {
  event: NotificationEvent
  orgName?: string
  monitorName?: string
  customTitle?: string
  customMessage?: string
}

const APP_NICKNAME = 'Finducao'

const funnyMessages: Record<NotificationEvent, ((name: string) => string)[]> = {
  'payment.confirmed': [
    (name) =>
      `💸 Beleza, ${name}! O pagamento caiu, agora você é VIP até o próximo boleto!`,
    (name) =>
      `✅ Dinheiro na conta, ${name}! Pode gastar sem dó, a gente libera!`,
    (name) => `🎉 Pagou direitinho, ${name}? Tá liberado pra zuar no sistema!`,
  ],

  'purchase.created': [
    (name) =>
      `🛍️ ${name}, comprou mais um brinquedinho, hein? Não vai falir esse mês, né?`,
    (name) =>
      `🧾 Eita, ${name}! Gastando igual gente grande, já mandamos a fatura pra te sacanear!`,
    (name) =>
      `💰 Compra nova na área, ${name}! Espero que tenha grana pra pagar essa porr*!`,
  ],

  'subscription.expiring': [
    (name) =>
      `⏳ Ô ${name}, sua assinatura tá com os dias contados! Vai renovar ou vai ficar na mão?`,
    (name) =>
      `🚨 Última chance, ${name}! Sua assinatura tá quase virando história, bota a mão no bolso!`,
    (name) =>
      `⏰ Tic-tac, ${name}! Sua assinatura tá quase dando tchau, corre aí, vagabundo!`,
  ],

  'usage.limit-reached': [
    (name) =>
      `📉 ${name}, acabou a farra! Gastou tudo, agora chora ou paga mais, hein?`,
    (name) =>
      `🚫 Limite estourado, ${name}! Tá pensando que é ilimitado, otário? Compra mais!`,
    (name) =>
      `💥 ${name}, suas requisições foram pro saco! Quer mais? Então desembolsa!`,
  ],

  'monitoring.down': [
    (name) =>
      `🚨 ${name}, caiu tudo aqui! Tá feia a coisa, mas já tô resolvendo, calma aí!`,
    (name) =>
      `💥 Ops, ${name}! O sistema deu uma cochilada, mas a gente tá chutando ele pra acordar!`,
    (name) =>
      `⚠️ ${name}, nosso servidor tá de palhaçada, mas a gente resolve rapidão!`,
  ],

  'monitoring.up': [
    (name) =>
      `✅ ${name}, levantei o sistema na marra! Pode voltar a usar, seu ingrato!`,
    (name) =>
      `🎉 Tudo de pé de novo, ${name}! A gente é foda, agradece aí, vai!`,
    (name) =>
      `👨‍🔧 ${name}, consertei a bagunça! Tá smooth como bunda de bebê!`,
  ],

  'monitoring.unstable': [
    (name) =>
      `⚠️ ${name}, tá oscilando mais que opinião de político! Tô de olho, relaxa!`,
    (name) =>
      `🤔 ${name}, o sistema tá fazendo dancinha estranha, mas a gente não deixa cair!`,
    (name) =>
      `🚨 ${name}, instabilidade detectada! Tá feio, mas eu seguro essa bronca!`,
  ],

  'user.bark-connected': [
    (name) =>
      `📲 ${name}, conectou o Bark direitinho! Agora te perturbo sempre, sacou?`,
    (name) =>
      `🔔 Beleza, ${name}! Tá plugado na gente, prepare-se pra levar uns sustos!`,
    (name) =>
      `✅ ${name}, conexão feita! Agora eu te acho até no fim do mundo!`,
  ],

  'custom.manual': [
    (name) =>
      `👀 ${name}, mandaram um recado personalizado pra você! Lê aí, seu curioso!`,
    (name) =>
      `💬 Ei ${name}, o chefão te mandou um bilhete! Vai encarar ou vai correr?`,
    (name) =>
      `📩 ${name}, alguém te cutucou com uma mensagem! Confere antes que eu delete!`,
  ],

  // Novos eventos
  'addon.canceled': [
    (name) =>
      `🗑️ ${name}, jogou o addon fora, hein? Tá economizando ou só cansado dessa porr*?`,
    (name) =>
      `🚫 Eita, ${name}! Cancelou o addon, agora vai ficar só no basicão, seu pão-duro!`,
    (name) =>
      `💥 ${name}, addon deletado na cara dura! A gente avisa pra não chorar depois!`,
  ],

  'plan.changed': [
    (name) =>
      `📈 ${name}, trocou de plano, hein? Será que agora aguenta o tranco?`,
    (name) =>
      `🔄 Plano novo na área, ${name}! A gente te botou pra rodar em outro nível!`,
    (name) =>
      `💪 ${name}, mudou o plano como quem muda de cueca! Tá chique agora, hein?`,
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
      title: customTitle ?? '🔔 Notificação do Boss',
      message: customMessage ?? 'Sem mensagem? Que preguiça, hein!',
    }
  }

  const templates = funnyMessages[event]
  const name = monitorName || orgName || 'camarada'
  const index = Math.floor(Math.random() * templates.length)

  return {
    title: getTitlePrefix(event),
    message: templates[index](name),
  }
}

function getTitlePrefix(event: NotificationEvent): string {
  const appName = 'findu.run'
  const prefix = `${appName} - `

  switch (event) {
    case 'monitoring.down':
      return `${prefix}Tá caindo tudo! `
    case 'monitoring.up':
      return `${prefix}De volta ao jogo `
    case 'usage.limit-reached':
      return `${prefix}Sem mais créditos `
    case 'subscription.expiring':
      return `${prefix}Assinatura na corda bamba `
    case 'payment.confirmed':
      return `${prefix}Grana na mão `
    case 'purchase.created':
      return `${prefix}Compra na lata `
    case 'user.bark-connected':
      return `${prefix}Conectado `
    case 'custom.manual':
      return `${prefix}Recadinho esperto `
    case 'addon.canceled':
      return `${prefix}Addon pro saco `
    case 'plan.changed':
      return `${prefix}Plano trocado `
    default:
      return `${prefix}Alerta sacana `
  }
}
