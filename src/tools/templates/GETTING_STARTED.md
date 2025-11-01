# Getting Started - {{PRODUCT}} QA

## 📋 Índice

- [Estrutura do Projeto](#estrutura-do-projeto)
- [Responsabilidades](#responsabilidades)
- [Configuração](#configuração)
- [Ferramentas MCP Quality](#ferramentas-mcp-quality)
- [Executando Testes](#executando-testes)
- [CI/CD](#cicd)
- [Convenções](#convenções)

## 📁 Estrutura do Projeto

```
/qa/{{PRODUCT}}/
├── mcp-settings.json          # Configuração centralizada do produto
├── tests/
│   ├── unit/                  # Testes unitários (responsabilidade: Dev)
│   ├── integration/           # Testes de integração (responsabilidade: Dev + QA)
│   │   ├── contracts/         # Testes de contrato (OpenAPI)
│   │   └── helpers/           # Helpers de integração
│   ├── e2e/                   # Testes E2E (responsabilidade: QA)
│   │   ├── auth/              # Fluxos de autenticação
│   │   ├── {{DOMAIN}}/        # Fluxos por domínio
│   │   └── auth.setup.ts      # Setup global de autenticação
│   ├── analyses/              # Relatórios de análise (gerados)
│   └── reports/               # Relatórios de execução (gerados)
├── fixtures/
│   └── auth/
│       └── storageState.json  # Estado de autenticação (Playwright)
└── playwright.config.ts       # Configuração do Playwright
```

## 👥 Responsabilidades

### Desenvolvedores (Dev)
- **Donos** de `tests/unit/` e `tests/integration/`
- Escrever testes unitários para todo código novo
- Criar testes de integração para:
  - Contratos de API (endpoints REST/GraphQL)
  - Regras de negócio complexas
  - Integrações com serviços externos (testcontainers)
- Manter cobertura de diff em **{{DIFF_COVERAGE_MIN}}%+**
- Rodar testes antes de criar PR

### QA
- **Donos** de `tests/e2e/`
- Criar cenários E2E para fluxos críticos definidos em `critical_flows`
- Apoiar devs na criação da base da pirâmide
- Validar gates de qualidade no CI
- Gerenciar fixtures e dados de teste
- Manter taxa de flakiness abaixo de **{{FLAKY_PCT_MAX}}%**

## ⚙️ Configuração

### 1. Instalar MCP Quality CLI

```bash
npm install -g @quality-mcp/cli
# ou
yarn global add @quality-mcp/cli
```

### 2. Configurar mcp-settings.json

Já existe um arquivo `mcp-settings.json` na raiz de `/qa/{{PRODUCT}}/`. 
Ajuste conforme necessário:

```json
{
  "product": "{{PRODUCT}}",
  "base_url": "{{BASE_URL}}",
  "domains": {{DOMAINS}},
  "critical_flows": {{CRITICAL_FLOWS}},
  "targets": {
    "diff_coverage_min": {{DIFF_COVERAGE_MIN}},
    "flaky_pct_max": {{FLAKY_PCT_MAX}},
    "ci_p95_min": {{CI_P95_MIN}}
  }
}
```

### 3. Configurar Variáveis de Ambiente

```bash
# .env.local
BASE_URL=https://stg.{{PRODUCT_DOMAIN}}
E2E_USER=test@example.com
E2E_PASS=your-test-password
```

## 🛠️ Ferramentas MCP Quality

### Sequência Completa (Análise → Plano → Scaffold → Execução)

```bash
# 1. Análise do código
quality analyze --repo . --product {{PRODUCT}}
# Gera: tests/analyses/analyze.json (rotas, endpoints, eventos, risk map)

# 2. Recomendação de estratégia
quality recommend-strategy --product {{PRODUCT}}
# Calcula: distribuição ideal unit/integration/e2e por domínio

# 3. Relatório de pirâmide
quality pyramid-report --product {{PRODUCT}}
# Valida: se a pirâmide está invertida

# 4. Gerar estrutura de testes
quality scaffold-unit --product {{PRODUCT}}
quality scaffold-integration --product {{PRODUCT}}
quality scaffold --product {{PRODUCT}}  # E2E

# 5. Gerar plano de ação
quality plan --product {{PRODUCT}}
# Gera: tests/analyses/plan.md (priorizado por risco)

# 6. Executar testes
quality run --product {{PRODUCT}}

# 7. Analisar cobertura (com diff)
quality coverage --product {{PRODUCT}}
# Valida: diff_coverage_min, gera relatórios

# 8. Dashboard e relatório executivo
quality dashboard --product {{PRODUCT}}
quality report --product {{PRODUCT}}
```

### Comandos Individuais

#### Análise e Planejamento
```bash
# Analisar código e gerar risk map
quality analyze --repo . --product {{PRODUCT}}

# Gerar plano priorizado
quality plan --product {{PRODUCT}}
```

#### Scaffolding
```bash
# Criar testes unitários
quality scaffold-unit --repo . --files src/services/auth.ts

# Criar testes de integração
quality scaffold-integration --repo . --product {{PRODUCT}} --base-url {{BASE_URL}}

# Criar estrutura E2E completa
quality scaffold --repo . --product {{PRODUCT}}
```

#### Execução e Relatórios
```bash
# Executar testes
quality run --product {{PRODUCT}}

# Cobertura com diff
quality coverage --repo . --product {{PRODUCT}}

# Dashboard visual
quality dashboard --product {{PRODUCT}}

# Relatório executivo
quality report --product {{PRODUCT}}
```

## 🧪 Executando Testes

### Testes Unitários
```bash
npm run test:unit
# ou
npm test -- tests/unit
```

### Testes de Integração
```bash
npm run test:integration
# ou
npm test -- tests/integration
```

### Testes E2E
```bash
# Todos os testes
npx playwright test

# Por domínio
npx playwright test tests/e2e/auth
npx playwright test tests/e2e/claim

# Debug mode
npx playwright test --debug

# Headed mode
npx playwright test --headed

# Apenas chromium
npx playwright test --project=chromium
```

## 🚀 CI/CD

### Pipeline Estrutura

```yaml
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit
  
  integration:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:integration
  
  e2e:
    runs-on: ubuntu-latest
    steps:
      - run: npx playwright test
      - uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: tests/reports/
  
  coverage:
    needs: [unit, integration, e2e]
    runs-on: ubuntu-latest
    steps:
      - run: quality coverage --product {{PRODUCT}}
      - name: Validate Coverage Gates
        run: |
          if [ $? -ne 0 ]; then
            echo "❌ Coverage gates failed"
            exit 1
          fi
```

### Quality Gates

O pipeline **falha** se:
- ❌ Diff coverage < {{DIFF_COVERAGE_MIN}}%
- ❌ Flaky tests > {{FLAKY_PCT_MAX}}%
- ❌ CI p95 > {{CI_P95_MIN}} minutos

### Artefatos Publicados

- 📊 `dashboard.html` - Dashboard visual da qualidade
- 📄 `SUMMARY.md` - Resumo executivo
- 🎬 `videos/` - Vídeos de falhas (E2E)
- 📸 `screenshots/` - Screenshots de falhas
- 📋 `junit.xml` - Relatório JUnit
- 📈 `coverage.json` - Dados de cobertura

Links dos artefatos aparecerão automaticamente nos comentários do PR.

## 📝 Convenções

### Nomenclatura de Testes

#### Unit Tests
```typescript
// tests/unit/services/auth.test.ts
describe('AuthService', () => {
  describe('login', () => {
    it('should return token when credentials are valid', () => {
      // ...
    });
    
    it('should throw error when credentials are invalid', () => {
      // ...
    });
  });
});
```

#### Integration Tests
```typescript
// tests/integration/api/claims.test.ts
import request from 'supertest';
import { app } from '../../../src/server';

describe('POST /api/claims', () => {
  it('should create claim with valid data', async () => {
    const res = await request(app)
      .post('/api/claims')
      .send({ title: 'Test', companyId: '123' });
    
    expect(res.status).toBe(201);
  });
});
```

#### E2E Tests
```typescript
// tests/e2e/claim/create-claim.spec.ts
import { test, expect } from '@playwright/test';

test('user can create a claim', async ({ page }) => {
  await page.goto('/claims/new');
  await page.fill('[name="title"]', 'Atraso na entrega');
  await page.click('button:has-text("Enviar")');
  await expect(page).toHaveURL(/\/claims\/\d+/);
});
```

### Commits

```bash
# Convenção: type(scope): message

feat(claim): add create claim endpoint
test(claim): add integration tests for claim creation
fix(auth): fix token expiration validation
chore(ci): add quality gates to pipeline
```

### Pull Requests

Toda PR deve:
1. ✅ Ter testes (unit + integration para features)
2. ✅ Passar em todos os quality gates
3. ✅ Manter diff coverage ≥ {{DIFF_COVERAGE_MIN}}%
4. ✅ Não introduzir flaky tests
5. ✅ Incluir link para dashboard.html nos artefatos

## 📚 Recursos

- [Quality MCP Documentation](https://github.com/your-org/mcp-Quality-CLI)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)
- [Contract Testing](https://pactflow.io/what-is-contract-testing/)

## 🆘 Suporte

- **Dúvidas sobre testes unitários/integração**: Time de Desenvolvimento
- **Dúvidas sobre E2E**: Time de QA
- **Problemas com ferramentas**: [Abrir issue](https://github.com/your-org/mcp-Quality-CLI/issues)

---

**Gerado por:** Quality MCP v0.2.0  
**Data:** {{DATE}}
