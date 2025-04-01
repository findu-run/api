import type { FastifyInstance } from 'fastify'
import { CronJob, AsyncTask } from 'toad-scheduler'
import { checkSubscriptionStatus } from '@/services/subscription-service'

export async function subscriptionsCheckSchedule(app: FastifyInstance) {
  const cronExpression = '*/1 * * * *'

  const task = new AsyncTask(
    'subscription-check-task',
    async () => {
      console.log('🔎 Iniciando verificação diária das assinaturas...')
      await checkSubscriptionStatus(app)
      console.log('✅ Verificação diária concluída com sucesso!')
    },
    (err) => {
      app.log.error('🚨 Erro ao verificar assinaturas:', err)
    },
  )

  const job = new CronJob(
    {
      cronExpression,
      timezone: 'America/Sao_Paulo',
    },
    task,
    { preventOverrun: true },
  )

  app.jobsMap.set('subscription-check-task', job)
  app.scheduler.addCronJob(job)
}
