# Provisionamento de acesso interno

Contas novas sempre recebem o papel `USER`. O EasyFit não oferece rota pública, formulário ou parâmetro de cadastro para promover usuários.

Papéis `SUPPORT` e `ADMIN` devem ser atribuídos somente por mudança operacional revisada, executada no PostgreSQL do ambiente correto por uma identidade privilegiada e auditada pelo provedor. A evidência da mudança deve registrar solicitante, aprovador, ambiente, conta, papel anterior/novo e data. O mesmo fluxo deve ser usado para remoção do papel.

Antes de liberar produção:

1. integrar o login interno ao IdP homologado e exigir MFA;
2. limitar quem pode alterar `User.role` fora da aplicação;
3. revisar contas internas periodicamente e remover acessos ociosos;
4. encaminhar eventos `admin.*` ao coletor imutável definido pela operação;
5. testar revogação, expiração e retenção de `SupportAccess` conforme a política jurídica aprovada.

Dentro do produto, toda consulta excepcional exige nova confirmação de senha, justificativa, escopos mínimos e expira em 15 minutos. A concessão não autoriza leitura genérica do banco: somente a rota resumida registra e devolve os objetos previstos pelo escopo.
