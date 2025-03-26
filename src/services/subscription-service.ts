import { prisma } from '@/lib/prisma'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'

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

    if (expiresInDays === 3) {
      await notify(
        subscription.organization.ownerId,
        'Sua assinatura vence em 3 dias.',
      )
    } else if (expiresInDays === 1) {
      await notify(
        subscription.organization.ownerId,
        'Sua assinatura vence amanhã.',
      )
    } else if (expiresInDays <= 0) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'CANCELED' },
      })
      await notify(
        subscription.organization.ownerId,
        'Sua assinatura venceu e seu acesso foi bloqueado.',
      )
    }
  }
}

async function notify(userId: string, message: string) {
  // Implemente a notificação real aqui (email, Bark, etc.)
  console.log(`🔔 Notify User(${userId}): ${message}`)
}
