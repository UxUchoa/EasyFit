# Estado de implementação do EasyFit

Atualizado em 22 de julho de 2026. Este arquivo é um mapa de entrega, não substitui a especificação de requisitos do produto.

## Concluído na fundação

- Next.js full-stack, React, TypeScript, Node.js 24.x, Tailwind CSS e build reproduzível com lockfile.
- Modelo Prisma/PostgreSQL para usuário, sessão, perfil, metas versionadas, diário, snapshots de alimento, treino, consentimento, solicitações do titular e auditoria.
- Cadastro e login com ID/senha, Argon2id, mensagem genérica no login e cookie HttpOnly/SameSite/Secure em produção.
- Sessão persistida por hash de token e logout com revogação da sessão atual.
- Proteção de origem nas mutações implementadas e validação Zod de credenciais e onboarding.
- Onboarding em três etapas com revisão explícita de perfil, objetivo, experiência, frequência e restrições antes da conclusão.
- Cálculos transparentes de idade, IMC, TMB por Mifflin-St Jeor, gasto estimado, meta calórica e macros.
- Versionamento inicial da meta; uma nova conclusão de onboarding encerra a meta vigente anterior.
- Área Hoje inicial, navegação autenticada, estados vazios e PWA com cache apenas do shell público.
- Diário alimentar com refeições padrão e personalizadas, adição rápida, busca local, edição de quantidade, remoção e totais reais.
- Planejado e realizado separados; confirmar um item planejado cria um snapshot consumido idempotente e preserva a origem.
- Comparação calórica planejado/realizado por refeição e dia, com indicação explícita de macros parciais.
- Alimentos privados isolados por conta, normalização por unidade/porção e histórico preservado após alteração do catálogo.
- Scanner com BarcodeDetector, fallback ZXing, digitação manual e consulta/cache da API v3.6 do Open Food Facts, com validade explícita, atualização e fallback identificado para cache antigo.
- Migration inicial versionada para PostgreSQL e schema validado pelo Prisma.
- Planos de treino manuais com divisões A, AB, ABC, ABCD, ABCDE ou personalizada e template editável vinculado ao usuário.
- Versões imutáveis de plano e snapshots de sessão; alterações futuras não reescrevem exercícios executados.
- Sessão de treino retomável com persistência por série, carga, repetições, RPE opcional e conclusão/cancelamento auditados.
- Cronômetro de descanso automático ou manual, com pausa, retomada, cancelamento e aviso acessível de término.
- Perfil de treino editável com objetivo, experiência, frequência, equipamentos, grupos prioritários e restrições informadas.
- Metas nutricionais automáticas ou manuais editáveis, com nova versão a cada alteração e explicação de fórmula, fatores, entradas e unidades.
- Alimentos favoritos/recentes e refeições favoritas/recentes por conta; templates podem ser salvos, renomeados, aplicados e excluídos como registros independentes.
- Duplicação de refeição e cópia de refeição ou dia entre datas, com rastreabilidade da entrada de origem e edição independente.
- Configuração editável de fuso IANA e horário de fechamento do dia sem reescrever o fuso armazenado em dias históricos.
- Histórico de peso e medidas corporais com data/unidade, edição, exclusão, sincronização do peso corrente, auditoria e isolamento por conta.
- Área Hoje com saldo calórico explícito, planejado/realizado por refeição, retomada direta do treino e estados carregando, erro e offline.
- Central de conta com troca de senha, reautenticação curta e sessões ativas descritas por dispositivo e localização aproximada, incluindo revogação individual e das demais.
- Política de privacidade pública e consentimentos versionados; finalidade opcional pode ser aceita ou revogada sem afetar o uso essencial.
- Solicitação e histórico de exportações JSON autenticadas com protocolo, estado e validade; exclusão de conta exige reautenticação e confirmação forte e devolve protocolo persistente.
- Auditoria de login, sessão, senha, consentimento, exportação e exclusão, sem armazenar senhas, tokens ou user-agent bruto nos eventos.
- Headers básicos de segurança, suporte a `prefers-reduced-motion` e interface mobile-first.
- Rate limit de login e reautenticação persistido no PostgreSQL, compartilhado entre instâncias e protegido por transação serializável.
- Logger JSON com identificador de correlação, duração e redação de campos sensíveis aplicado a login e integração externa de código de barras.
- Integração Open Food Facts com timeout, retry exponencial limitado, quota configurável e circuit breaker persistido e compartilhado pelo PostgreSQL.
- Pipeline de CI com PostgreSQL de serviço, migrations, testes unitários, isolamento por objeto, E2E mobile em Chromium, lint, typecheck e build.
- Auditoria automatizada axe para páginas públicas críticas e para o diário autenticado, além de cenário E2E que comprova renderização inerte de markup persistido.
- Relatório semanal de nutrição com meta vigente por dia, planejado/realizado, calorias, macros, parcialidade e tabela equivalente ao gráfico.
- Evolução de peso com gráfico e tabela acessível, além de histórico de treino por exercício com data, carga, repetições e volume por série.
- Preferências separadas de refeição, treino e check-in com horário, dias, canal, janela silenciosa e centro in-app sempre disponível.
- Permissão de notificação negada é explicada sem novos prompts automáticos; estado fica persistido por conta e integra a exportação.
- Substituição de exercício antes da primeira série, filtrada por grupo muscular/equipamento e registrada no snapshot e na auditoria.
- Geração determinística por regra versionada usando objetivo, experiência, dias, equipamentos, prioridades e presença de restrições, sempre como prévia totalmente editável antes da ativação.
- Correções de quantidade preservam revisão imutável com valores anterior/novo, data, motivo e auditoria; dias passados exigem justificativa e os totais não são duplicados.
- Relatórios diferenciam sessões previstas, iniciadas, em andamento, concluídas e canceladas e documentam aderência como concluídas ÷ previstas no período.
- Piloto de importação JSON valida extensão, MIME, tamanho, assinatura e estrutura; preserva ponteiro de origem/confiança, exige revisão dos itens incertos, bloqueia porções ausentes e confirma um plano versionado de forma idempotente.
- Jobs de importação têm estados e transições validadas, tentativas, parser versionado, ownership, auditoria sem conteúdo alimentar e exportação junto aos dados do titular.
- Backoffice mínimo com papéis `USER`, `SUPPORT` e `ADMIN`: contas comuns recebem 404, suporte vê saúde operacional agregada e somente admin consulta auditoria por período.
- Painel operacional mostra volume/estado de importações, falhas, retries, latência de processamento, quotas e circuito das integrações sem conteúdo alimentar ou dados pessoais por padrão.
- Acesso excepcional exige reautenticação recente, justificativa, conta-alvo comum, escopos e expiração de 15 minutos; consulta e revogação registram operador, alvo e cada objeto visto, preservando a trilha anonimizada após exclusão de conta.
- Conflitos de catálogo usam grupo estável por GTIN ou nome/marca/unidade normalizados; todas as fontes e nutrientes permanecem visíveis, nenhuma alternativa sofre overwrite e a escolha é gravada atomicamente com o lançamento.
- Preferências entre fontes são isoladas por conta, reaparecem na busca, preservam snapshots das alternativas, integram a exportação e produzem auditoria sem nome de alimento em texto aberto.
- Diário preserva criações e edições offline em fila IndexedDB isolada por conta; novas entradas reutilizam a mesma idempotency key e sincronizam automaticamente ao retornar a conexão.
- Edições usam controle otimista por `updatedAt`; divergências retornam 409, não criam revisão falsa e ficam pausadas até a escolha explícita entre servidor e versão local. Exclusão de conta remove também a fila do dispositivo.
- Métricas operacionais persistem somente buckets horários agregados, sem usuário/IP/GTIN/arquivo/conteúdo; login, scanner/catálogo e recebimento de importações registram resultado e histograma de latência.
- Backoffice apresenta volume, média, máximo e limite estimado de p95 por métrica, além dos resultados e sinais de saturação como rate limit, circuit breaker e retries. Logs JSON usam `correlation_id` e redação por chave sensível.
- Expiração absoluta e intervalo de rotação de sessão são configuráveis; tokens vencidos para rotação são trocados por uma rota autenticada, protegida por origem, com concorrência segura entre abas e evento de auditoria.
- `AuditEvent` é append-only por trigger PostgreSQL: `UPDATE` e `DELETE` são recusados. O ator pseudônimo permanece após exclusão da conta, enquanto o painel resolve nome/papel apenas para contas ainda existentes.

- Login, scanner, importação e privacidade usam o mesmo bloco acessível de ajuda contextual, na mesma posição relativa, com explicação e encaminhamento específico sem interromper o fluxo.

## Parcial — requer endurecimento antes do aceite

- RF-ALI-04: Open Food Facts e cache local funcionam; bases TACO/TBCA e USDA ainda dependem de homologação/licença.
- RF-NOT-01/02: agenda, canal, janela silenciosa e centro in-app estão prontos; a entrega push real ainda depende de provedor, subscription e worker homologados.
- RF-IMP-01/02/08: o piloto JSON executa o domínio completo sem disco local e permite reprocessamento; PDF textual, DOCX, object storage, antivírus e fila/worker remotos ainda dependem de provedores homologados.
- RNF-02: axe, foco por teclado, reflow em 320 px e redução de movimento têm testes automatizados; falta revisão manual WCAG 2.2 AA com leitor de tela, zoom real e dispositivos representativos.
- RNF-10: origem ausente/hostil, markup persistido inerte e headers/CSP têm testes E2E; falta pentest dedicado e substituir `unsafe-inline` por nonce compatível e homologado com a renderização Next.js.
- RNF-15/30: logger estruturado e métricas agregadas cobrem os fluxos operacionais exigidos; integração com coletor externo, alertas e retenção operacional ainda dependem da plataforma homologada.
- RF-ADM-01/03: RBAC, reautenticação e acesso temporário estão implementados; provisionamento/revisão periódica de contas internas e MFA federado ainda dependem do IdP e do runbook operacional escolhidos. Não existe autopromoção na API pública.

## Próximos blocos MVP 1

1. Catálogo: homologar licenças, atribuições, quotas e ingestão de TACO/TBCA/USDA.
2. Importação completa: object storage, fila/worker, verificação de malware e parsers PDF textual/DOCX sobre o domínio JSON já versionado.
3. Aceite: ampliar E2E e segurança, executar acessibilidade e smoke em Preview/Production e homologar a evidência em dispositivos reais.

## Dependências externas ainda abertas

- Provedor e região de PostgreSQL, object storage e fila.
- Políticas de retenção, RPO/RTO e aprovação jurídica/LGPD.
- Licenciamento, atribuição, quotas e forma de ingestão das fontes TACO/TBCA, USDA e Open Food Facts.
- Domínio canônico e configuração separada de Preview/Production na Vercel.
