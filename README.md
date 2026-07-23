# EasyFit

PWA mobile-first para alimentação, metas corporais e treino, construída com Next.js full-stack, TypeScript, PostgreSQL e Prisma.

## Desenvolvimento local

1. Use Node.js 24.x.
2. Copie `.env.example` para `.env` e configure um PostgreSQL de desenvolvimento.
3. Instale as dependências com `npm install`.
4. Gere o cliente e aplique a migration com `npm run prisma:generate` e `npm run prisma:migrate -- --name initial`.
5. Inicie com `npm run dev`.

## Verificações

```text
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e
npm run build
```

Os testes de integração só acessam o banco quando `RUN_INTEGRATION_TESTS=1`; use exclusivamente um PostgreSQL descartável. Instale o navegador E2E uma vez com `npx playwright install chromium`. A CI provisiona o PostgreSQL, aplica a migration e executa integração, E2E mobile e auditoria axe automaticamente.

Nunca use o banco de produção no desenvolvimento ou em ambientes Preview. Senhas são armazenadas com Argon2id e as sessões persistem apenas hashes de tokens.

## Publicação na Vercel

O EasyFit é uma aplicação Next.js full-stack: páginas e rotas de API são publicadas juntas na Vercel, enquanto o PostgreSQL permanece no Supabase.

1. Importe o repositório na Vercel e mantenha o diretório raiz como `./`.
2. Use Node.js 24.x. Os comandos padrão são `npm install` e `npm run build`.
3. Cadastre em **Production** todas as variáveis listadas em `.env.example`, sem enviar o arquivo `.env` ao Git.
4. Use o Transaction Pooler do Supabase na `DATABASE_URL` e o Session Pooler na `DIRECT_URL`.
5. Defina `APP_URL` com a origem HTTPS canônica, sem barra final, e use a mesma origem em `OPEN_FOOD_FACTS_CONTACT` ou informe um e-mail de contato.
6. Gere um `SESSION_SECRET` exclusivo para produção, com pelo menos 32 caracteres aleatórios.
7. Aplique migrations de produção de forma deliberada com `npm run prisma:deploy`; não execute migrations automaticamente em deployments de Preview.

Variáveis de banco devem ficar restritas ao ambiente **Production**. Se Preview precisar acessar dados, use outro projeto Supabase e credenciais próprias. Depois de alterar qualquer variável na Vercel, faça um novo deploy para que ela entre em vigor.

Após a publicação, valide cadastro, login, criação e exclusão de alimentos e treinos, leitura de código de barras e logout. Confira também os logs das Functions na Vercel e o Security Advisor do Supabase.
