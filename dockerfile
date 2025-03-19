# Usa Node 23 com Alpine para um ambiente leve
FROM node:23-alpine AS base

# Habilita o Corepack para usar pnpm e instala pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Define o diretório de trabalho
WORKDIR /app

# Copia os arquivos de configuração de pacotes antes para otimizar cache
COPY package.json pnpm-lock.yaml ./

# Instala as dependências de produção
RUN pnpm install --frozen-lockfile --production

# Copia o restante do código do projeto
COPY . .

# Executa as migrações do banco de dados
RUN pnpx prisma migrate deploy

# Gera o cliente Prisma
RUN pnpx prisma generate

# Constrói o código TypeScript
RUN pnpm run build

# Comando para iniciar a aplicação
CMD ["node", "dist/server.js"]
