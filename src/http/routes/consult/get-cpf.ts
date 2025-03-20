import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import dayjs from 'dayjs'

import { prisma } from '@/lib/prisma'
import { NotFoundError } from '@/http/_errors/not-found-error'
import { BadRequestError } from '@/http/_errors/bad-request-error'
import { fetchCPFData } from '@/http/external/cpf'

export async function getCPF(app: FastifyInstance) {
  app
    .withTypeProvider<ZodTypeProvider>()
    .get(
      '/organizations/:slug/cpf',
      {
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
              cpf: z.string(),
              name: z.string(),
              birthDate: z.string(),
              motherName: z.string(),
              gender: z.string(),
            }),
          },
        },
      },
      async (request) => {
        const { slug } = request.params
        const { cpf } = request.query

        // 📌 Obtendo IP corretamente, lidando com proxies
        const userIp = Array.isArray(request.headers['x-forwarded-for'])
          ? request.headers['x-forwarded-for'][0]
          : request.headers['x-forwarded-for']?.split(',')[0].trim() || request.socket.remoteAddress;

        if (!userIp) {
          await prisma.queryLog.create({
            data: {
              organizationId: slug,
              ipAddress: 'UNKNOWN',
              status: 'FAILED',
              queryType: 'CPF',
            },
          });

          throw new BadRequestError('IP address not found.');
        }

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
        });

        if (!organization) {
          await prisma.queryLog.create({
            data: {
              organizationId: slug,
              ipAddress: userIp,
              status: 'FAILED',
              queryType: 'CPF',
            },
          });

          throw new NotFoundError('Organization not found.');
        }

        if (!organization.subscription || organization.subscription.status !== 'ACTIVE') {
          await prisma.queryLog.create({
            data: {
              organizationId: organization.id,
              ipAddress: userIp,
              status: 'FAILED',
              queryType: 'CPF',
            },
          });

          throw new BadRequestError('Organization does not have an active subscription.');
        }

        // 🔥 Verificar se o IP é autorizado
        const authorizedIps = organization.ipAddress.map(ip => ip.ip);
        if (!authorizedIps.includes(userIp)) {
          await prisma.queryLog.create({
            data: {
              organizationId: organization.id,
              ipAddress: userIp,
              status: 'FAILED',
              queryType: 'CPF',
            },
          });

          throw new BadRequestError('Unauthorized IP. Your organization does not have access from this IP.');
        }

        // 🔥 Verificar limite de requisições mensais
        const startOfMonth = dayjs().startOf('month').toDate();
        const requestsMade = await prisma.queryLog.count({
          where: {
            organizationId: organization.id,
            createdAt: { gte: startOfMonth },
          },
        });

        const requestLimit = organization.subscription.plan?.maxRequests || 0;
        if (requestsMade >= requestLimit) {
          await prisma.queryLog.create({
            data: {
              organizationId: organization.id,
              ipAddress: userIp,
              status: 'FAILED',
              queryType: 'CPF',
            },
          });

          throw new BadRequestError('Monthly request limit reached.');
        }

        // 🔥 Tentar obter dados da API externa
        let userData;
        try {
          userData = await fetchCPFData(cpf);
        } catch (error) {
          await prisma.queryLog.create({
            data: {
              organizationId: organization.id,
              ipAddress: userIp,
              status: 'FAILED',
              queryType: 'CPF',
            },
          });

          throw new BadRequestError('Failed to fetch CPF data.');
        }

        // 🔥 Registrar log da consulta bem-sucedida
        await prisma.queryLog.create({
          data: {
            organizationId: organization.id,
            ipAddress: userIp,
            status: 'SUCCESS',
            queryType: 'CPF',
          },
        });

        return userData;
      }
    );
}
