import { prisma } from '@/lib/prisma'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'
import { sendNotification } from '@/lib/notifier/send'

export async function checkSubscriptionStatus() {
  const today = convertToBrazilTime(new Date()).startOf('day')

  const subscriptions = await prisma.subscription.findMany({
    where: { status: 'ACTIVE' },
    include: { organization: { include: { owner: true } }, plan: true },
  })

  for (const subscription of subscriptions) {
    const currentPeriodEndBR = convertToBrazilTime(
      subscription.currentPeriodEnd,
    ).startOf('day')
    const expiresInDays = currentPeriodEndBR.diff(today, 'day')

    const { owner, name: orgName } = subscription.organization

    if (expiresInDays === 3) {
      await notify(
        owner.id,
        '⏳ Sua assinatura está vencendo',
        `A assinatura da organização "${orgName}" vence em 3 dias.`,
      )
    } else if (expiresInDays === 1) {
      await notify(
        owner.id,
        '⚠️ Último aviso!',
        `A assinatura da organização "${orgName}" vence amanhã.`,
      )
    } else if (expiresInDays <= 0) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELED' },
      })

      await notify(
        owner.id,
        '🚫 Assinatura expirada',
        `A assinatura da organização "${orgName}" venceu e o acesso foi bloqueado.`,
      )
    }
  }
}

async function notify(userId: string, title: string, message: string) {
  const token = await prisma.token.findFirst({
    where: {
      userId,
      type: 'BARK_CONNECT',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (token?.deviceKey) {
    await sendNotification({
      event: 'subscription.expiring',
      title,
      message,
      deviceKey: token.deviceKey,
      skipApprise: false, // opcional
    })
  }

  console.log(`🔔 Notify(${userId}): ${title} - ${message}`)
}
