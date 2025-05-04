import { prisma } from '@/lib/prisma'
import dayjs from 'dayjs'
import type { FastifyInstance } from 'fastify'

export async function deleteOldQueryLogs(app: FastifyInstance) {
  const cutoffDate = dayjs().subtract(90, 'days').toDate()

  const { count } = await prisma.queryLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  })

  if (count > 0) {
    app.log.info(`🧹 ${count} query logs antigos foram deletados.`)
  } else {
    app.log.info('🧼 Nenhum query log antigo para deletar.')
  }
}
