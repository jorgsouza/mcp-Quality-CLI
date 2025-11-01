# Exemplos de Uso

Este documento contém exemplos práticos de uso do Quality MCP.

## 📋 Índice

- [Exemplo 1: Aplicação Next.js](#exemplo-1-aplicação-nextjs)
- [Exemplo 2: API Express](#exemplo-2-api-express)
- [Exemplo 3: Monorepo](#exemplo-3-monorepo)
- [Exemplo 4: Uso com Claude](#exemplo-4-uso-com-claude)
- [Exemplo 5: CI/CD Completo](#exemplo-5-cicd-completo)

## Exemplo 1: Aplicação Next.js

### Cenário

Você tem uma aplicação Next.js com:
- Autenticação (login, signup)
- Dashboard
- Perfil de usuário
- Configurações

### Execução

```bash
# 1. Configurar ambiente
export E2E_BASE_URL="http://localhost:3000"
export E2E_USER="test@example.com"
export E2E_PASS="Test123!"

# 2. Pipeline completo
quality full \
  --repo ~/projetos/minha-app-nextjs \
  --product "MinhaApp" \
  --base-url "$E2E_BASE_URL" \
  --domains "auth,dashboard,profile,settings" \
  --critical-flows "login,signup,update_profile" \
  --targets '{
    "ci_p95_min": 12,
    "flaky_pct_max": 2,
    "diff_coverage_min": 70
  }'
```

### Resultado

```
plan/
├── analyze.json          # 15 rotas, 8 endpoints detectados
└── TEST-PLAN.md         # Plano com 12 cenários

packages/product-e2e/
├── tests/
│   ├── auth/
│   │   ├── login.spec.ts        # ✅ Gerado
│   │   └── signup.spec.ts       # ✅ Gerado
│   ├── dashboard/
│   │   └── overview.spec.ts     # ✅ Gerado
│   └── profile/
│       └── update.spec.ts       # ✅ Gerado
└── playwright.config.ts

reports/
├── html/index.html      # 11/12 passed (91.7%)
├── json/results.json
└── junit/results.xml

SUMMARY.md               # Pronto para PR
```

### Customização

```typescript
// packages/product-e2e/fixtures/auth.ts
export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    // Autenticação via API para acelerar testes
    const token = await apiLogin(process.env.E2E_USER!, process.env.E2E_PASS!);
    await page.goto('/');
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, token);
    await page.reload();
    await use(page);
  }
});
```

## Exemplo 2: API Express

### Cenário

API REST com:
- CRUD de usuários
- CRUD de produtos
- Sistema de pedidos
- OpenAPI 3.0 spec

### Execução

```bash
quality analyze \
  --repo ~/projetos/api-ecommerce \
  --product "APIEcommerce" \
  --domains "users,products,orders" \
  --critical-flows "create_order,process_payment"

# Resultado: plan/analyze.json
{
  "summary": "Encontradas 0 rotas web, 24 endpoints e 5 eventos.",
  "findings": {
    "routes": [],
    "endpoints": [
      "GET /api/users",
      "POST /api/users",
      "GET /api/users/:id",
      "PUT /api/users/:id",
      "DELETE /api/users/:id",
      "GET /api/products",
      ...
    ],
    "events": [
      "kafka:order.created",
      "kafka:order.processed",
      "kafka:payment.success",
      ...
    ],
    "risk_map": [
      {
        "area": "endpoint:POST /api/orders",
        "risk": "high",
        "rationale": "fluxo crítico - deve ter cobertura E2E prioritária"
      }
    ]
  }
}
```

### Testes Gerados

```typescript
// packages/product-e2e/tests/orders/create-order.spec.ts
test('deve criar pedido com sucesso', async ({ request }) => {
  // Autenticação
  const authRes = await request.post('/api/auth/login', {
    data: { email: process.env.E2E_USER, password: process.env.E2E_PASS }
  });
  const { token } = await authRes.json();

  // Criar pedido
  const orderRes = await request.post('/api/orders', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      items: [{ productId: 1, quantity: 2 }],
      shippingAddress: { ... }
    }
  });

  expect(orderRes.ok()).toBeTruthy();
  const order = await orderRes.json();
  expect(order).toHaveProperty('id');
  expect(order.status).toBe('pending');
});
```

## Exemplo 3: Monorepo

### Cenário

Monorepo com:
- `apps/web` - Next.js
- `apps/api` - Express
- `apps/admin` - React
- `packages/shared` - Libs compartilhadas

### Estrutura

```bash
my-monorepo/
├── apps/
│   ├── web/
│   ├── api/
│   └── admin/
├── packages/
│   └── shared/
└── quality/            # ← Onde rodar Quality MCP
```

### Execução por App

```bash
# App Web
quality full \
  --repo apps/web \
  --product "WebApp" \
  --base-url "http://localhost:3000" \
  --out packages/web-e2e

# API
quality full \
  --repo apps/api \
  --product "API" \
  --base-url "http://localhost:4000" \
  --out packages/api-e2e

# Admin
quality full \
  --repo apps/admin \
  --product "Admin" \
  --base-url "http://localhost:3001" \
  --out packages/admin-e2e
```

### CI/CD para Monorepo

```yaml
# .github/workflows/e2e.yml
jobs:
  e2e-web:
    steps:
      - run: quality run --repo apps/web --e2e packages/web-e2e

  e2e-api:
    steps:
      - run: quality run --repo apps/api --e2e packages/api-e2e

  e2e-admin:
    steps:
      - run: quality run --repo apps/admin --e2e packages/admin-e2e
```

## Exemplo 4: Uso com Claude

### Configuração

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "quality": {
      "command": "node",
      "args": ["/Users/me/dev/mcp-Quality-CLI/dist/server.js"],
      "env": {
        "E2E_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Interação

**Você:**
> Analise o repositório em ~/projetos/meu-app e gere um plano de testes E2E

**Claude:**
> Vou analisar seu repositório e gerar um plano de testes.
>
> [Claude invoca `analyze_codebase`]
>
> Encontrei:
> - 8 rotas web
> - 12 endpoints de API
> - 3 eventos assíncronos
>
> [Claude invoca `generate_test_plan`]
>
> Criei um plano de testes em `plan/TEST-PLAN.md` com 15 cenários organizados por domínio...

**Você:**
> Agora crie a estrutura de testes Playwright

**Claude:**
> [Claude invoca `scaffold_playwright`]
>
> Criei a estrutura completa em `packages/product-e2e/` com:
> - Configuração do Playwright
> - 15 specs organizados por domínio
> - Fixtures de autenticação
> - Utilitários para dados de teste
>
> Para executar: `quality run --repo . --e2e packages/product-e2e`

## Exemplo 5: CI/CD Completo

### GitHub Actions - Multi-Stage

```yaml
# .github/workflows/quality.yml
name: Quality Pipeline

on:
  pull_request:
  push:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    outputs:
      has-changes: ${{ steps.check.outputs.has-changes }}
    steps:
      - uses: actions/checkout@v4
      - name: Analyze codebase
        id: analyze
        run: |
          quality analyze \
            --repo . \
            --product "${{ github.repository }}"
      - name: Check for test changes
        id: check
        run: |
          # Lógica para detectar mudanças relevantes
          echo "has-changes=true" >> $GITHUB_OUTPUT
      - uses: actions/upload-artifact@v4
        with:
          name: analysis
          path: plan/analyze.json

  plan:
    needs: analyze
    if: needs.analyze.outputs.has-changes == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: analysis
      - name: Generate test plan
        run: |
          quality plan \
            --repo . \
            --product "${{ github.repository }}" \
            --base-url "${{ secrets.E2E_BASE_URL }}"
      - uses: actions/upload-artifact@v4
        with:
          name: plan
          path: plan/

  scaffold:
    needs: plan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: plan
      - name: Scaffold tests
        run: quality scaffold --repo . --plan plan/TEST-PLAN.md
      - uses: actions/upload-artifact@v4
        with:
          name: tests
          path: packages/product-e2e/

  test:
    needs: scaffold
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: tests
      - name: Run tests (shard ${{ matrix.shard }}/4)
        env:
          E2E_BASE_URL: ${{ secrets.E2E_BASE_URL }}
          E2E_USER: ${{ secrets.E2E_USER }}
          E2E_PASS: ${{ secrets.E2E_PASS }}
        run: |
          quality run \
            --repo . \
            --e2e packages/product-e2e \
            -- --shard=${{ matrix.shard }}/4
      - uses: actions/upload-artifact@v4
        with:
          name: reports-${{ matrix.shard }}
          path: reports/

  report:
    needs: test
    if: always()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          pattern: reports-*
          merge-multiple: true
          path: reports/
      - name: Merge reports
        run: npx playwright merge-reports reports/
      - name: Build summary
        run: quality report --in reports --out SUMMARY.md
      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const summary = fs.readFileSync('SUMMARY.md', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: summary
            });
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - analyze
  - plan
  - test
  - report

variables:
  E2E_BASE_URL: "http://staging.example.com"

analyze:
  stage: analyze
  script:
    - quality analyze --repo . --product "$CI_PROJECT_NAME"
  artifacts:
    paths:
      - plan/analyze.json

plan:
  stage: plan
  script:
    - quality plan --repo . --product "$CI_PROJECT_NAME" --base-url "$E2E_BASE_URL"
  artifacts:
    paths:
      - plan/

test:
  stage: test
  parallel: 4
  script:
    - quality full --repo . --product "$CI_PROJECT_NAME" --base-url "$E2E_BASE_URL"
  artifacts:
    paths:
      - reports/
    reports:
      junit: reports/junit/*.xml

report:
  stage: report
  script:
    - quality report --in reports --out SUMMARY.md
  artifacts:
    paths:
      - SUMMARY.md
```

## 💡 Dicas Avançadas

### 1. Testes Parametrizados

```typescript
// packages/product-e2e/tests/search/search.spec.ts
const testCases = [
  { query: 'laptop', expectedMin: 10 },
  { query: 'phone', expectedMin: 20 },
  { query: 'tablet', expectedMin: 5 },
];

testCases.forEach(({ query, expectedMin }) => {
  test(`busca por "${query}" deve retornar ao menos ${expectedMin} resultados`, async ({ page }) => {
    await page.goto('/search');
    await page.getByLabel('Buscar').fill(query);
    await page.keyboard.press('Enter');
    
    const results = await page.locator('.result-item').count();
    expect(results).toBeGreaterThanOrEqual(expectedMin);
  });
});
```

### 2. Testes com API Mocks

```typescript
// packages/product-e2e/tests/offline/offline.spec.ts
test('deve mostrar mensagem quando API está offline', async ({ page }) => {
  // Mock falha de API
  await page.route('**/api/**', route => route.abort());
  
  await page.goto('/');
  await expect(page.getByText(/erro de conexão/i)).toBeVisible();
});
```

### 3. Visual Regression

```typescript
// packages/product-e2e/tests/visual/homepage.spec.ts
test('homepage deve manter layout', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png');
});
```

### 4. Performance Testing

```typescript
// packages/product-e2e/tests/performance/load-time.spec.ts
test('homepage deve carregar em menos de 2s', async ({ page }) => {
  const start = Date.now();
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const duration = Date.now() - start;
  
  expect(duration).toBeLessThan(2000);
});
```

## 📚 Recursos Adicionais

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Test Patterns](https://playwright.dev/docs/test-patterns)
- [Page Object Model](https://playwright.dev/docs/pom)

---

Precisa de mais exemplos? Abra uma [issue](https://github.com/seu-usuario/mcp-Quality-CLI/issues)!

