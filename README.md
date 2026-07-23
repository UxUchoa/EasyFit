<div align="center">
  <img src="./public/icon.svg" width="88" height="88" alt="Ícone do EasyFit" />

  # EasyFit

  ### Alimentação, evolução corporal e treino em um só lugar.

  PWA mobile-first construída para tornar o acompanhamento de saúde simples, rápido e honesto — sem inventar nutrientes, esconder dados incompletos ou depender de APIs pagas.

  [![EasyFit CI](https://github.com/UxUchoa/EasyFit/actions/workflows/ci.yml/badge.svg)](https://github.com/UxUchoa/EasyFit/actions/workflows/ci.yml)
  [![Next.js](https://img.shields.io/badge/Next.js-16-111111?logo=nextdotjs)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
  [![PWA](https://img.shields.io/badge/PWA-instalável-166534?logo=pwa&logoColor=white)](https://web.dev/explore/progressive-web-apps)

  **[Abrir aplicação](https://easy-fit-phi.vercel.app)** · [Começar localmente](#rodando-localmente) · [Reportar problema](https://github.com/UxUchoa/EasyFit/issues)

  <sub>Feito para celular, internet instável e uma rotina de verdade.</sub>
</div>

---

<div align="center">
  <a href="#sobre-o-projeto">Visão geral</a> ·
  <a href="#tecnologias">Stack</a> ·
  <a href="#arquitetura">Arquitetura</a> ·
  <a href="#rodando-localmente">Instalação</a> ·
  <a href="#supabase--vercel">Deploy</a> ·
  <a href="#comandos-úteis">Comandos</a>
</div>

<br />

## Sobre o projeto

O EasyFit reúne diário alimentar, metas nutricionais, medidas corporais e planejamento de treinos em uma experiência pensada primeiro para o celular.

A aplicação é full-stack: o frontend e as rotas de API vivem no mesmo projeto Next.js, o Prisma cuida da camada de dados e o PostgreSQL pode rodar localmente via Docker ou remotamente no Supabase.

| 📱 Mobile-first | 🥗 Nutrição sem chute | 🏋️ Treino adaptável | 🛜 Resiliente |
| :---: | :---: | :---: | :---: |
| Interface pensada para uso com uma mão | Dados incompletos ficam visíveis | Planos revisáveis por divisão e objetivo | PWA, cache e fila offline |

### O que já funciona

| Área | Recursos |
| --- | --- |
| **Dieta** | Registros planejados e consumidos, refeições personalizadas, correção com histórico, cópia de refeições e resumo de macros. |
| **Alimentos** | Pesquisa manual, favoritos, recentes, catálogo privado, TACO e consulta gratuita ao Open Food Facts. |
| **Código de barras** | Leitura pela câmera no próprio aparelho, busca por GTIN e cadastro manual quando o produto não existe. |
| **Treinos** | Sugestões revisáveis Full body, AB, ABC, ABCD e ABCDE para força ou hipertrofia; montagem manual, pesquisa, importação JSON, sessões, séries e substituições. |
| **Evolução** | Relatórios nutricionais, aderência aos treinos, volume por exercício e evolução de medidas corporais. |
| **Conta** | Sessões, exportação e exclusão de dados, consentimentos, lembretes e preferências pessoais. |
| **Experiência** | PWA instalável, fila offline, conflitos recuperáveis, skeleton loading, navegação responsiva e bottom sheets no mobile. |

## Tecnologias

- **Next.js 16** com App Router, Server Components e Route Handlers
- **React 19** e **TypeScript 5**
- **Tailwind CSS 4** para a interface
- **PostgreSQL 17** e **Prisma 6**
- **ZXing** para leitura local de códigos de barras
- **Open Food Facts** como base aberta de produtos
- **Vitest**, **Playwright** e **axe-core** para qualidade e acessibilidade
- **Vercel** para aplicação e APIs; **Supabase** como PostgreSQL gerenciado

> [!TIP]
> Nenhuma API paga é obrigatória. A leitura do código de barras acontece no aparelho, e a consulta usa Open Food Facts e o catálogo nacional como fontes abertas.

## Arquitetura

```mermaid
flowchart LR
    U["PWA no celular ou navegador"] --> N["Next.js App Router"]
    N --> A["Route Handlers / API"]
    A --> P["Prisma ORM"]
    P --> D[("PostgreSQL / Supabase")]
    A --> O["Open Food Facts"]
    A --> T["Catálogo nacional / TACO"]
    N --> Q["Fila offline no dispositivo"]
    Q --> A
```

```text
app/          páginas, layouts e endpoints HTTP
components/   componentes de interface e fluxos interativos
lib/          domínio, autenticação, integrações e acesso a dados
prisma/       schema e migrations versionadas
public/       manifest, service worker e ícone da PWA
tests/        testes unitários, integração e E2E
```

## Rodando localmente

### Pré-requisitos

- [Node.js 24.x](https://nodejs.org/)
- npm 11 ou superior
- PostgreSQL 17, local ou remoto
- Docker, opcionalmente, para subir o PostgreSQL local

### 1. Clone e instale

```bash
git clone https://github.com/UxUchoa/EasyFit.git
cd EasyFit
npm install
```

### 2. Configure o banco

Você pode usar Supabase ou um PostgreSQL local. Para subir um banco descartável com Docker:

```bash
docker run --name easyfit-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=easyfit \
  -p 5432:5432 \
  -d postgres:17-alpine
```

No PowerShell, o mesmo comando pode ser executado em uma linha:

```powershell
docker run --name easyfit-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=easyfit -p 5432:5432 -d postgres:17-alpine
```

As migrations de segurança também protegem as roles da API do Supabase. Em um PostgreSQL local recém-criado, crie essas duas roles compatíveis uma única vez:

```bash
docker exec easyfit-postgres psql -U postgres -d easyfit -c "CREATE ROLE anon NOLOGIN;"
docker exec easyfit-postgres psql -U postgres -d easyfit -c "CREATE ROLE authenticated NOLOGIN;"
```

Se estiver usando PostgreSQL local sem Docker, execute os mesmos comandos SQL como administrador do banco antes das migrations.

### 3. Crie o arquivo de ambiente

```powershell
Copy-Item .env.example .env
```

No Linux ou macOS:

```bash
cp .env.example .env
```

Para o PostgreSQL local, ajuste o começo do `.env`:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/easyfit?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/easyfit?schema=public"
SESSION_SECRET="substitua-por-uma-chave-aleatoria-com-no-minimo-32-caracteres"
APP_URL="http://localhost:3000"
OPEN_FOOD_FACTS_CONTACT="http://localhost:3000"
```

> [!IMPORTANT]
> Use apenas um par de aspas em cada valor. Um `"` extra no final da `DATABASE_URL` faz o Prisma interpretar `schema=public` incorretamente.

Você pode gerar um segredo seguro com Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Prepare o Prisma

```bash
npm run prisma:generate
npm run prisma:deploy
```

`prisma:deploy` aplica as migrations que já estão versionadas no projeto. Ao desenvolver uma mudança nova de schema, use:

```bash
npm run prisma:migrate -- --name nome_da_alteracao
```

### 5. Inicie a aplicação

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Variáveis de ambiente

O arquivo [`.env.example`](./.env.example) contém a lista completa e valores seguros de exemplo.

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão usada pela aplicação; no Supabase/Vercel, use o Transaction Pooler. |
| `DIRECT_URL` | Conexão direta usada pelas migrations; no Supabase, use o Session Pooler. |
| `SESSION_SECRET` | Assina as sessões e deve ter ao menos 32 caracteres aleatórios. |
| `SESSION_TTL_DAYS` | Validade absoluta da sessão. |
| `SESSION_ROTATION_HOURS` | Intervalo de rotação do token. |
| `APP_URL` | Origem canônica usada nas validações de segurança. |
| `ALLOWED_ORIGINS` | Origens adicionais autorizadas, separadas por vírgula. |
| `OPEN_FOOD_FACTS_CONTACT` | URL ou e-mail de contato enviado à base aberta. |
| `OPEN_FOOD_FACTS_*` | Timeout, tentativas, circuit breaker e limites lógicos da integração. |

> [!CAUTION]
> Nunca envie `.env`, senhas, chaves ou URLs reais de banco para o Git. O arquivo já está protegido pelo `.gitignore`.

## Supabase + Vercel

O Supabase é usado somente como PostgreSQL gerenciado. Autenticação, sessões e regras da aplicação continuam no backend do EasyFit.

1. Crie um projeto no Supabase.
2. Em **Connect → ORM → Prisma**, copie as duas conexões:
   - Transaction Pooler, porta `6543`, para `DATABASE_URL`;
   - Session Pooler, porta `5432`, para `DIRECT_URL`.
3. Preencha `.env` localmente e execute `npm run prisma:deploy` uma única vez para aplicar as migrations.
4. Importe este repositório na Vercel, mantendo o diretório raiz como `./`.
5. Cadastre as variáveis da `.env.example` no ambiente **Production** da Vercel.
6. Defina `APP_URL` com a URL HTTPS final, sem barra no final.
7. Faça o deploy. O [`vercel.json`](./vercel.json) já direciona as funções para São Paulo (`gru1`).

> [!NOTE]
> Frontend e backend sobem juntos na Vercel. Alterações apenas no código não exigem reconfigurar o Supabase; basta um novo deploy. O banco só precisa de `prisma:deploy` quando existir uma migration nova.

Para ambientes Preview, use outro banco ou outro projeto Supabase. Não conecte previews nem testes ao banco de produção.

## Comandos úteis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento. |
| `npm run build` | Gera o build otimizado de produção. |
| `npm start` | Executa o build de produção. |
| `npm run lint` | Verifica regras de qualidade do código. |
| `npm run typecheck` | Valida os tipos sem gerar arquivos. |
| `npm test` | Executa os testes unitários. |
| `npm run test:integration` | Executa a suíte de integração. |
| `npm run test:e2e` | Executa os fluxos E2E com Playwright. |
| `npm run prisma:generate` | Gera o Prisma Client. |
| `npm run prisma:deploy` | Aplica migrations já existentes. |
| `npm run prisma:migrate -- --name exemplo` | Cria uma migration durante o desenvolvimento. |

### Testes de integração e E2E

Use exclusivamente um PostgreSQL descartável. As suítes criam e removem registros durante a execução.

No PowerShell:

```powershell
$env:RUN_INTEGRATION_TESTS="1"
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

A integração contínua já provisiona PostgreSQL, aplica as migrations e executa lint, tipos, testes unitários, integração, E2E mobile, auditoria axe e build.

## Segurança e privacidade

- Senhas protegidas com **Argon2id**.
- Tokens de sessão persistidos somente como hash e rotacionados periodicamente.
- CSP, HSTS, proteção contra framing e política restritiva de permissões.
- Validação de origem para mutações e suporte a origens explicitamente autorizadas.
- Papéis internos, escopos de suporte e trilha de auditoria.
- Exportação e solicitação de exclusão dos dados do titular.
- Migration de lockdown para impedir acesso das roles públicas do Supabase às tabelas do Prisma.

## Solução de problemas

<details>
<summary><strong>Prisma P1001: Can't reach database server</strong></summary>

- Confirme que o container está rodando com `docker ps`.
- Verifique se a URL usa `localhost:5432`, e não o texto literal `HOST:5432`.
- Confirme usuário, senha, nome do banco e porta.
- No Supabase, confira se copiou o host do pooler e se o projeto está ativo.

</details>

<details>
<summary><strong>Erro de identificador entre aspas próximo a public</strong></summary>

Remova aspas duplicadas no fim da URL. O valor correto termina assim:

```dotenv
DATABASE_URL="postgresql://postgres:senha@localhost:5432/easyfit?schema=public"
```

</details>

<details>
<summary><strong>Cadastro retorna 403 na Vercel</strong></summary>

- Defina `APP_URL` exatamente com a origem pública, por exemplo `https://easy-fit-phi.vercel.app`.
- Não coloque barra no final.
- Confira `ALLOWED_ORIGINS` se estiver usando outro domínio.
- Faça um novo deploy depois de alterar variáveis na Vercel.

</details>

<details>
<summary><strong>Produto não encontrado pelo código de barras</strong></summary>

O Open Food Facts é uma base colaborativa e pode não possuir todos os produtos brasileiros. O usuário ainda pode pesquisar pelo nome, consultar o catálogo nacional ou cadastrar manualmente os valores do rótulo.

</details>

---

<div align="center">
  Feito para uma rotina real: celular na mão, internet imperfeita e informação sem chute.
</div>
