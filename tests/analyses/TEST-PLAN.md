# Plano de Testes E2E — Test

**Base URL:** https://test.com

**Data:** 2025-11-01

## 1) Cenários Canônicos (Produto)



### Cenários Principais
- **Login e Sessão** (P1) — owner: QA Consumer — SLA: 7 dias
  - Login com credenciais válidas
  - Persistência de sessão
  - Logout
  - Login com credenciais inválidas (caso negativo)

- **Abrir Reclamação** (P1) — owner: QA Consumer — SLA: 7 dias
  - Fluxo completo de abertura
  - Validação de campos obrigatórios
  - Upload de anexos
  - Confirmação de criação

- **Buscar Empresa** (P2) — owner: QA Search — SLA: 14 dias
  - Busca com resultados
  - Busca sem resultados
  - Filtros e ordenação

## 2) Risco & Priorização

- **P1 (Alta Prioridade):** Caminho do dinheiro, incidentes recorrentes, SLA regulatório
- **P2 (Média Prioridade):** Alta frequência de uso, impacto moderado
- **P3 (Baixa Prioridade):** Funcionalidades secundárias, baixo impacto


### Mapa de Riscos (Análise)
- **[MED]** endpoint:GET /path: sem verificação de contrato detectada
- **[MED]** endpoint:GET /users: sem verificação de contrato detectada
- **[MED]** endpoint:POST /path: sem verificação de contrato detectada
- **[MED]** endpoint:POST /users: sem verificação de contrato detectada
- **[MED]** endpoint:PUT /users/:id: sem verificação de contrato detectada
- **[MED]** endpoint:DELETE /users/:id: sem verificação de contrato detectada
- **[MED]** endpoint:PATCH /users/:id: sem verificação de contrato detectada
- **[MED]** endpoint:GET /profile: sem verificação de contrato detectada
- **[MED]** endpoint:POST /profile: sem verificação de contrato detectada
- **[MED]** endpoint:GET /admin: sem verificação de contrato detectada


## 3) Playwright — Estrutura

```
packages/product-e2e/
├─ playwright.config.ts
├─ fixtures/
│  ├─ auth.ts
│  └─ test-data.ts
└─ tests/
   ├─ auth/
   │  ├─ login.spec.ts
   │  └─ session.spec.ts
   ├─ claim/
   │  ├─ open-claim.spec.ts
   │  └─ claim-validation.spec.ts
   └─ search/
      ├─ search-company.spec.ts
      └─ search-filters.spec.ts
```

## 4) Dados de Teste

- **Ambiente:** Staging/Preview
- **Usuário seed:** Configurado via variáveis de ambiente (E2E_USER, E2E_PASS)
- **Massa sintética:** Factories determinísticas para dados de teste
- **Limpeza:** Reset de dados após cada suite (quando aplicável)

## 5) Relatórios & Métricas

### Formatos de Saída
- **HTML:** Relatório visual interativo
- **JUnit XML:** Integração com CI/CD
- **JSON:** Análise programática
- **Coverage (lcov):** Cobertura de código

### Políticas de Qualidade
- **Flaky Tests:** Quarentena automática + issue + SLA 7 dias para correção
- **Retry Policy:** 1 retry automático, máximo 2 tentativas
- **Timeout:** 35s por teste, 5min por suite

### Metas (Targets)
- **CI p95:** ≤ 15 minutos (percentil 95 do tempo de CI)
- **Flaky Rate:** ≤ 3% (percentual de testes instáveis)
- **Diff Coverage:** ≥ 60% (cobertura nas mudanças)

## 6) Execução

### Ambientes
- **PR:** Suite reduzida (smoke tests)
- **Nightly:** Suite completa
- **Pre-release:** Suite completa + testes de regressão

### Comandos
```bash
# Executar todos os testes
npm run e2e

# Executar por domínio
npm run e2e:auth
npm run e2e:claim
npm run e2e:search

# Debug mode
npm run e2e:debug

# Gerar relatório
npm run e2e:report
```



## 7) Manutenção & Evolução

- **Review mensal:** Atualizar cenários conforme novas funcionalidades
- **Refatoração:** Extrair page objects quando houver duplicação
- **Monitoramento:** Acompanhar métricas de flaky e tempo de execução
- **Feedback:** Loop com time de desenvolvimento para melhorar testabilidade

---

**Próximos Passos:**
1. ✅ Plano aprovado por QA
2. ⏳ Scaffold dos testes (executar `quality scaffold`)
3. ⏳ Execução e validação (executar `quality run`)
4. ⏳ Relatório para release (executar `quality report`)
