import { prisma } from '@/lib/prisma'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'
import { sendNotification } from '@/lib/notifier/send'
import type { FastifyInstance } from 'fastify'

export async function checkSubscriptionStatus(app: FastifyInstance) {
  const today = convertToBrazilTime(new Date()).startOf('day')

  const subscriptions = await prisma.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'TRIALING'] } },
    include: { organization: { include: { owner: true } }, plan: true },
  })

  for (const subscription of subscriptions) {
    const currentPeriodEndBR = convertToBrazilTime(
      subscription.currentPeriodEnd,
    ).startOf('day')
    const expiresInDays = currentPeriodEndBR.diff(today, 'day')

    const { owner, name: orgName } = subscription.organization
    const isTrial = subscription.status === 'TRIALING'

    try {
      // Notificações de expiração
      if (expiresInDays === 3) {
        await notify(
          app,
          owner.id,
          isTrial
            ? '⏳ Seu trial está acabando'
            : '⏳ Sua assinatura está vencendo',
          `A ${isTrial ? 'trial' : 'assinatura'} da organização "${orgName}" vence em 3 dias.`,
        )
      } else if (expiresInDays === 1) {
        await notify(
          app,
          owner.id,
          isTrial ? '⚠️ Último aviso do trial!' : '⚠️ Último aviso!',
          `A ${isTrial ? 'trial' : 'assinatura'} da organização "${orgName}" vence amanhã.`,
        )
      } else if (expiresInDays <= 0) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELED' },
        })
        await notify(
          app,
          owner.id,
          '🚫 Assinatura expirada',
          `A ${isTrial ? 'trial' : 'assinatura'} da organização "${orgName}" venceu e o acesso foi bloqueado.`,
        )
      }

      // Verifica faturas vencidas
      const overdueInvoices = await prisma.invoice.findFirst({
        where: {
          organizationId: subscription.organizationId,
          status: 'PENDING',
          dueDate: { lt: today.toDate() },
        },
      })

      if (overdueInvoices) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELED' },
        })
        await notify(
          app,
          owner.id,
          '🚫 Assinatura cancelada por atraso',
          `A assinatura da organização "${orgName}" foi cancelada devido a faturas vencidas.`,
        )
      }
    } catch (error) {
      app.log.error(`Erro ao processar assinatura ${subscription.id}:`, error)
    }
  }
}

async function notify(
  app: FastifyInstance,
  userId: string,
  title: string,
  message: string,
) {
  try {
    const token = await prisma.token.findFirst({
      where: { userId, type: 'BARK_CONNECT' },
      orderBy: { createdAt: 'desc' },
    })

    if (token?.deviceKey) {
      await sendNotification({
        event: 'subscription.expiring',
        title,
        message,
        deviceKey: token.deviceKey,
        skipApprise: false,
      })
    }

    app.log.info(`🔔 Notify(${userId}): ${title} - ${message}`)
  } catch (error) {
    app.log.error(`Erro ao enviar notificação para ${userId}:`, error)
  }
}
