# Evidências locais de aceite

Atualizado em 22 de julho de 2026. Este documento registra verificações reproduzíveis locais e não substitui homologação em Preview/Production.

## Segurança e acessibilidade públicas

Executado em Chromium mobile pelo Playwright:

```text
npm run test:e2e -- tests/e2e/security-accessibility.spec.ts
4 passed
```

Cobertura: CSP e headers defensivos, ausência de `X-Powered-By`, recusa de mutação com origem ausente/hostil, foco por teclado, reflow a 320 px e `prefers-reduced-motion`.

```text
npm run test:e2e -- --grep "páginas públicas críticas"
1 passed
```

Cobertura: axe com tags WCAG 2 A/AA, 2.1 AA e 2.2 AA em login, cadastro e privacidade, recusando impactos sérios ou críticos.

## Gates de código

```text
npm run lint
npm run typecheck
npm test
npm run build
```

Último resultado: lint e TypeScript sem erros; 61 testes unitários em 23 arquivos; build de produção com 32 páginas.

Os testes autenticados de integração e E2E dependem do PostgreSQL descartável provisionado pela CI. A descoberta local carrega 10 cenários PostgreSQL e os fluxos mobile, mas não é contabilizada aqui como execução aprovada.

## Evidências ainda externas ou manuais

- leitor de tela, zoom real e matriz de dispositivos/navegadores;
- pentest, CSP com nonce e validação de headers no domínio implantado;
- Core Web Vitals e latência p95 em Preview/Production;
- backup/restore, rollback, RPO/RTO e resposta a incidentes;
- coletor/alertas, object storage, fila/worker, antivírus e provedores homologados.
