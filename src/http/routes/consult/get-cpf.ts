import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'

import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { BadRequestError } from '@/http/_errors/bad-request-error'
import { fetchCPFData, type CpfDataResponse } from '@/http/external/cpf'
import { sendNotification } from '@/lib/notifier/send'
import { convertToBrazilTime } from '@/utils/convert-to-brazil-time'
import { getClientIp } from '@/utils/get-client-ip'
import { capitalizeName } from '@/utils/capitalize-name'
import { formatCPF } from '@/utils/formated-cpf'

export async function getCPF(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/organizations/:slug/cpf',
    {
      config: {
        rateLimit: {
          keyGenerator: (
            request: FastifyRequest<{ Params: { slug: string } }>,
          ) => request.params.slug,
          max: 5000,
        },
      },
      schema: {
        tags: ['CPF'],
        summary: 'Consult CPF information',
        security: [{ bearerAuth: [] }],
        params: z.object({
          slug: z.string(),
        }),
        querystring: z.object({
          cpf: z.string().regex(/^\d{11}$/, 'Invalid CPF format'),
        }),
        response: {
          200: z.object({
            cpf: z.string(),             // sem formatação
            formattedCpf: z.string(),   // com formatação
            name: z.string(),
            firstName: z.string(),
            birthDate: z.string(),
            motherName: z.string(),
            gender: z.string(),
          }),
        },
      },
    },

    async (request, reply) => {
      const { slug } = request.params
      const { cpf } = request.query

      const sanitizedCpf = cpf.replace(/\D/g, '') // remove pontos e traços
      const userIp = getClientIp(request.headers, request.socket)

      if (!userIp) {
        throw new BadRequestError('No valid IPv4 address found')
      }

      const organization = await prisma.organization.findUnique({
        where: { slug },
        select: {
          id: true,
          name: true,
          subscription: {
            select: {
              status: true,
              plan: { select: { maxRequests: true } },
              organization: { select: { ownerId: true } },
            },
          },
          ipAddress: { select: { ip: true } },
        },
      })

      if (!organization) {
        throw new NotFoundError('Organization not found.')
      }

      if (
        !organization.subscription ||
        organization.subscription.status !== 'ACTIVE'
      ) {
        throw new BadRequestError(
          'Organization does not have an active subscription.',
        )
      }

      const authorizedIps = organization.ipAddress.map((ip) => ip.ip)
      if (!authorizedIps.includes(userIp)) {
        throw new BadRequestError(`${userIp} - Unauthorized IP.`)
      }

      const startOfMonth = convertToBrazilTime(new Date())
        .startOf('month')
        .toDate()

      const requestsMade = await prisma.queryLog.count({
        where: {
          organizationId: organization.id,
          createdAt: { gte: startOfMonth },
        },
      })

      const requestLimit = organization.subscription.plan?.maxRequests || 0

      if (requestsMade >= requestLimit) {
        const token = await prisma.token.findFirst({
          where: {
            userId: organization.subscription.organization.ownerId,
            type: 'BARK_CONNECT',
          },
          orderBy: { createdAt: 'desc' },
        })

        if (!token?.deviceKey) {
          throw new NotFoundError()
        }

        await sendNotification({
          event: 'usage.limit-reached',
          orgName: organization.name,
          deviceKey: token.deviceKey,
        })

        throw new BadRequestError('Monthly request limit reached.')
      }

      let userData: CpfDataResponse
      try {
        userData = await fetchCPFData(sanitizedCpf)
      } catch (error) {
        await prisma.queryLog.create({
          data: {
            organizationId: organization.id,
            ipAddress: userIp,
            status: 'FAILED',
            queryType: 'CPF',
          },
        })

        throw new BadRequestError('Failed to fetch CPF data.')
      }

      const capitalizedName = capitalizeName(userData.name)
      const capitalizedMotherName = capitalizeName(userData.motherName)
      const firstName = capitalizedName
        ? capitalizeName(capitalizedName.split(' ')[0])
        : ''

      await prisma.queryLog.create({
        data: {
          organizationId: organization.id,
          ipAddress: userIp,
          status: 'SUCCESS',
          queryType: 'CPF',
        },
      })

      return reply.send({
        cpf: sanitizedCpf,
        formattedCpf: formatCPF(sanitizedCpf),
        name: capitalizedName,
        motherName: capitalizedMotherName,
        firstName,
        birthDate: userData.birthDate,
        gender: userData.gender,
      })
    },
  )
}
