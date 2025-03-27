import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { auth } from '@/http/middlewares/auth'

export async function getJobsStatus(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/admin/jobs/status',
      {
        schema: {
          tags: ['Admin'],
          summary: 'Check the status of scheduled jobs',
          security: [{ bearerAuth: [] }],
          response: {
            200: z.object({
              jobs: z.array(
                z.object({
                  name: z.string(),
                }),
              ),
            }),
          },
        },
      },
      async (request, reply) => {
        const jobs = Array.from(app.jobsMap.entries()).map(([name]) => ({
          name,
        }))

        return reply.send({ jobs })
      },
    )
}
