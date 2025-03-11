
import { prisma } from '@/lib/prisma'
import { UnauthorizedError } from '@/http/_errors/unauthorized-error'

// Verifica se o usuário é OWNER da organização
export async function ensureIsOwner(userId: string, organizationId: string) {
  const isOwner = await prisma.organization.findFirst({
    where: {
      id: organizationId,
      ownerId: userId,
    },
  })

  if (!isOwner) {
    throw new UnauthorizedError('You must be the OWNER to perform this action.')
  }
}

// Verifica se o usuário tem permissões como OWNER ou ADMIN
export async function ensureIsAdminOrOwner(
  userId: string,
  organizationId: string,
) {
  const member = await prisma.member.findFirst({
    where: {
      organizationId,
      userId,
      role: {
        in: ['OWNER', 'ADMIN'],
      },
    },
  })

  if (!member) {
    throw new UnauthorizedError('You do not have sufficient permissions.')
  }
}

// Verifica se um domínio já existe (para validação)
export async function validateUniqueDomain(
  domain: string,
  excludeOrganizationId?: string,
) {
  const existingOrganization = await prisma.organization.findFirst({
    where: {
      domain,
      id: excludeOrganizationId ? { not: excludeOrganizationId } : undefined,
    },
  })

  if (existingOrganization) {
    throw new Error('Another organization with the same domain already exists.')
  }
}
