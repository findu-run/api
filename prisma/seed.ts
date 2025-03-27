import { PrismaClient, PlanTier } from '@prisma/client'

const prisma = new PrismaClient()

async function seed() {
  const plans: {
    name: string
    price: number
    type: PlanTier
    isTrialAvailable: boolean
    maxOrganizations: number
    maxIps: number
    maxRequests: number
    ipChangeLimit: number
    supportLevel: string
    description: string
  }[] = [
    {
      name: 'Trial',
      price: 0,
      type: PlanTier.TRIAL,
      isTrialAvailable: true,
      maxOrganizations: 1,
      maxIps: 1,
      maxRequests: 100,
      ipChangeLimit: 24,
      supportLevel: 'E-mail',
      description: 'Plano de teste por 7 dias',
    },
    {
      name: 'Pro',
      price: 47000,
      type: PlanTier.BASIC,
      isTrialAvailable: false,
      maxOrganizations: 1,
      maxIps: 1,
      maxRequests: 500000,
      ipChangeLimit: 24,
      supportLevel: 'E-mail',
      description:
        'Dashboard completo, múltiplas APIs, controle de IPs, monitoramento 24h',
    },
    {
      name: 'Scale',
      price: 67000,
      type: PlanTier.PROFESSIONAL,
      isTrialAvailable: false,
      maxOrganizations: 1,
      maxIps: 2,
      maxRequests: 2000000,
      ipChangeLimit: 24,
      supportLevel: 'E-mail, WhatsApp',
      description:
        'Tudo do Pro + notificações real-time, suporte prioritário, visualização por domínio',
    },
    {
      name: 'Enterprise',
      price: 120000,
      type: PlanTier.BUSINESS,
      isTrialAvailable: false,
      maxOrganizations: 1,
      maxIps: 4,
      maxRequests: 5000000,
      ipChangeLimit: 24,
      supportLevel: 'E-mail, WhatsApp, Prioritário',
      description:
        'Tudo do Scale + relatórios personalizados, SLA dedicado, IPs dinâmicos sob demanda',
    },
  ]

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { type: plan.type },
      update: {},
      create: plan,
    })
    console.log(`Plano ${plan.name} criado ou atualizado!`)
  }

  await prisma.$disconnect()
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})
