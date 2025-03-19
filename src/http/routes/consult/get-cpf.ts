import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import dayjs from 'dayjs'

import { auth } from '@/http/middlewares/auth'
import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { BadRequestError } from '@/http/_errors/bad-request-error'
import { fetchCPFData } from '@/http/external/cpf'

export async function getCPF(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .register(auth)
    .get(
      '/organizations/:slug/cpf/:cpf',
      {
        schema: {
          tags: ['CPF'],
          summary: 'Consult CPF information',
          security: [{ bearerAuth: [] }],
          params: z.object({
            slug: z.string(),
            cpf: z.string().regex(/^\d{11}$/, 'Invalid CPF format'),
          }),
          response: {
            200: z.object({
              cpf: z.string(),
              name: z.string(),
              birthDate: z.string(),
              motherName: z.string(),
              gender: z.string(),
            }),
          },
        },
      },
      async (request, reply) => {
        const { slug, cpf } = request.params
        const userId = await request.getCurrentUserId()
        // const userIp = request.ip

        const userIp = Array.isArray(request.headers['x-forwarded-for'])
        ? request.headers['x-forwarded-for'][0] // Se for array, pega o primeiro elemento
        : request.headers['x-forwarded-for']?.split(',')[0].trim() || request.socket.remoteAddress;
      

  console.log("User IP:", userIp)

        // 🔥 Buscar a organização e validar acesso
        const organization = await prisma.organization.findUnique({
          where: { slug },
          select: {
            id: true,
            name: true,
            subscription: {
              select: {
                status: true,
                plan: {
                  select: { maxRequests: true },
                },
              },
            },
            ipAddress: { select: { ip: true } },
          },
        })

        if (!organization) {
          throw new NotFoundError('Organization not found.')
        }

        console.log(userIp)

        if (!organization.subscription || organization.subscription.status !== 'ACTIVE') {
          throw new BadRequestError('Organization does not have an active subscription.')
        }

        // 🔥 Verificar se o IP é autorizado
        const authorizedIps = organization.ipAddress.map(ip => ip.ip)
        if (!authorizedIps.includes(userIp)) {
          throw new BadRequestError('Unauthorized IP. Your organization does not have access from this IP.')
        }

        // 🔥 Verificar limite de requisições mensais
        const startOfMonth = dayjs().startOf('month').toDate()
        const requestsMade = await prisma.queryLog.count({
          where: {
            organizationId: organization.id,
            createdAt: { gte: startOfMonth },
          },
        })

        const requestLimit = organization.subscription.plan?.maxRequests || 0
        if (requestsMade >= requestLimit) {
          throw new BadRequestError('Monthly request limit reached.')
        }


// 🔥 Obter dados da API externa
      const userData = await fetchCPFData(cpf)

        // 🔥 Registrar log da consulta
        await prisma.queryLog.create({
          data: {
            cpf,
            userId,
            organizationId: organization.id,
            ipAddress: userIp,
            response: JSON.stringify(userData),
          },
        })

        return reply.send(userData)
      }
    )
}
