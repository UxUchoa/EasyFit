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
