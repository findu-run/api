FROM node:23-alpine AS base

# Defina o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copie apenas os arquivos necessários para instalar as dependências
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Instale as dependências de produção
RUN npm install --only=production

# Copie o restante do código da aplicação
COPY . .

# Construção do código TypeScript
RUN npm run build

# Comando padrão para iniciar o servidor
CMD ["node", "dist/server.js"]
