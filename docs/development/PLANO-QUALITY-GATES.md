# Plano QUALITY GATES + DORA/SRE Metrics 🎯

**Objetivo**: Transformar o MCP Quality CLI em uma plataforma completa de engenharia de qualidade seguindo práticas DORA, SRE, Fowler, Kent Beck, Meszaros e Pact.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Novas Tools MCP](#novas-tools-mcp)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [Pipeline Auto](#pipeline-auto)
- [Quality Gates](#quality-gates)
- [Plano de Implementação](#plano-de-implementação)
- [Cronograma](#cronograma)

---

## 🎯 Visão Geral

### Problema a Resolver

Atualmente o MCP Quality CLI foca em **quantidade de testes** (cobertura). Queremos evoluir para **qualidade sistêmica**:

- ❌ Cobertura alta mas testes fracos → ✅ Mutation score valida eficácia
- ❌ E2E lentos dominam pipeline → ✅ Pirâmide balanceada (70/20/10)
- ❌ Testes quebram sem código mudar → ✅ Suite health mede flakiness
- ❌ Bugs escapam para produção → ✅ CFR/MTTR rastreiam resultado real
- ❌ Contratos entre serviços quebram → ✅ CDC (Pact) valida compatibilidade

### Princípios (DORA/SRE/Testing Patterns)

1. **CUJs como estrela norte** (Brewer/SRE): Identifique 5-10 jornadas críticas
2. **SLOs por CUJ** (Beyer): Latência/erro/disponibilidade mensuráveis
3. **Pirâmide de testes** (Fowler): Unit 70%, Service 20%, E2E 10%
4. **Mutation testing** (Jia/Harman): Eficácia > cobertura
5. **CDC** (Pact): Contratos consumidor-provedor evitam quebra de integração
6. **Property-based** (QuickCheck): Invariantes > casos específicos
7. **Approval tests** (Meszaros): Golden master para legados complexos
8. **Quality gates** (DORA): CFR ≤ 15%, MTTR ≤ 60min, Mutation ≥ 50%

---

## 🏗️ Arquitetura

### Camadas

```
┌─────────────────────────────────────────────────────┐
│  CLIENT (MCP/CLI)                                   │
│  quality.auto --repo . --product X                  │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│  ORCHESTRATOR (auto.ts - renovado)                  │
│  ├─ Phase 1: CUJ/SLO/Risk Discovery                 │
│  ├─ Phase 2: Portfolio Planning                     │
│  ├─ Phase 3: Scaffold Tests (all types)             │
│  ├─ Phase 4: Execute Tests                          │
│  ├─ Phase 5: Measure Suite Health                   │
│  ├─ Phase 6: Measure Mutation (critical modules)    │
│  ├─ Phase 7: Ingest Prod Metrics                    │
│  └─ Phase 8: Apply Quality Gates                    │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│  TOOLS LAYER (13 novas + 12 existentes = 25 total) │
│                                                     │
│  CUJ/SLO/Risk:                                      │
│    catalog_cujs, define_slos, risk_register         │
│                                                     │
│  Portfolio:                                         │
│    portfolio_plan                                   │
│                                                     │
│  Scaffolding:                                       │
│    scaffold_contracts_pact                          │
│    scaffold_property_tests                          │
│    scaffold_approval_tests                          │
│    (+ existing: scaffold_unit, integration, e2e)    │
│                                                     │
│  Execution:                                         │
│    run_contracts_verify                             │
│    run_mutation_tests                               │
│    (+ existing: run_coverage, run_playwright)       │
│                                                     │
│  Metrics:                                           │
│    suite_health                                     │
│    prod_metrics_ingest                              │
│    slo_canary_check                                 │
│                                                     │
│  Gates:                                             │
│    release_quality_gate                             │
└─────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────┐
│  OUTPUTS (qa/<product>/)                            │
│  ├─ tests/analyses/ (14 JSON files)                 │
│  ├─ tests/reports/ (10 MD/JSON/HTML files)          │
│  ├─ tests/contracts/ (Pact configs)                 │
│  ├─ tests/property/ (Property-based tests)          │
│  └─ tests/approval/ (Golden masters)                │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ Novas Tools MCP

### 1. CUJ/SLO/Risk Discovery

#### 1.1. `catalog_cujs`

**Propósito**: Mapear Critical User Journeys (CUJs)

**Input Schema**:

```typescript
interface CatalogCUJsParams {
  repo: string;
  product: string;
  sources?: ("routes" | "telemetry" | "readme" | "openapi")[];
}
```

**Output**: `qa/<product>/tests/analyses/cuj-catalog.json`

```json
{
  "cujs": [
    {
      "id": "checkout-purchase",
      "name": "Checkout and Purchase",
      "criticality": "high",
      "endpoints": ["/api/cart", "/api/payment"],
      "dependencies": ["payment-gateway", "inventory-service"]
    }
  ]
}
```

**Implementação**:

- Escaneia rotas API (Express/Next/FastAPI)
- Parse OpenAPI/Swagger se disponível
- Lê telemetria (Sentry breadcrumbs, Datadog traces)
- Sugere CUJs baseado em tráfego/erros

---

#### 1.2. `define_slos`

**Propósito**: Definir SLOs por CUJ

**Input Schema**:

```typescript
interface DefineSLOsParams {
  repo: string;
  product: string;
  cuj_file: string; // cuj-catalog.json
  defaults?: {
    latency_p99_ms?: number;
    error_rate_max?: number;
    availability_min?: number;
  };
}
```

**Output**: `qa/<product>/tests/analyses/slos.json`

```json
{
  "slos": [
    {
      "cuj_id": "checkout-purchase",
      "latency_p99_ms": 500,
      "error_rate_max": 0.01,
      "availability_min": 0.995
    }
  ]
}
```

---

#### 1.3. `risk_register`

**Propósito**: Cruzar CUJs + SLOs + domínio para identificar riscos críticos

**Input Schema**:

```typescript
interface RiskRegisterParams {
  repo: string;
  product: string;
  cuj_file: string;
  slos_file: string;
  impact_matrix?: Record<string, "critical" | "high" | "medium" | "low">;
}
```

**Output**: `qa/<product>/tests/analyses/risk-register.json`

```json
{
  "risks": [
    {
      "id": "payment-gateway-down",
      "cuj_id": "checkout-purchase",
      "impact": "critical",
      "probability": "medium",
      "mitigation": ["circuit-breaker", "retry-logic", "dead-letter-queue"],
      "test_coverage": 0.78
    }
  ],
  "top_5_critical": ["payment-gateway-down", "inventory-race-condition", ...]
}
```

---

### 2. Portfolio Planning

#### 2.1. `portfolio_plan`

**Propósito**: Redesenhar pirâmide de testes baseado em riscos

**Input Schema**:

```typescript
interface PortfolioPlanParams {
  repo: string;
  product: string;
  risk_file: string;
  coverage_file?: string;
  targets?: {
    unit_percent?: number; // default 70
    service_percent?: number; // default 20
    e2e_percent?: number; // default 10
    max_ci_time_min?: number; // default 12
  };
}
```

**Output**: `qa/<product>/tests/reports/portfolio-plan.md`

```markdown
# Test Portfolio Plan

## Current State

- Unit: 45% (target: 70%)
- Service: 30% (target: 20%)
- E2E: 25% (target: 10%)
- CI Time: 18 min (target: ≤12 min)

## Recommendations

1. **Add 150 unit tests** for billing-core (mutation score: 0.34 → 0.60)
2. **Remove 40 E2E tests** (duplicated by service tests)
3. **Add CDC (Pact)** for payment-gateway integration
4. **Add property tests** for pricing logic (invariants: price ≥ 0)

## Module Breakdown

| Module          | Unit | Service | E2E | CDC | Property | Approval |
| --------------- | ---- | ------- | --- | --- | -------- | -------- |
| billing-core    | 80   | 15      | 2   | -   | 3        | -        |
| payment-gateway | 50   | 20      | 1   | 5   | -        | -        |
```

---

### 3. Advanced Scaffolding

#### 3.1. `scaffold_contracts_pact`

**Propósito**: Gerar CDC com Pact

**Input Schema**:

```typescript
interface ScaffoldContractsPactParams {
  repo: string;
  product: string;
  services: Array<{
    name: string;
    role: "consumer" | "provider";
    endpoints: string[];
  }>;
}
```

**Output**:

- `qa/<product>/tests/contracts/pact.config.ts`
- `qa/<product>/tests/contracts/<service>/*.pact.spec.ts`

**Exemplo gerado**:

```typescript
// qa/<product>/tests/contracts/payment-gateway/checkout.pact.spec.ts
import { pactWith } from "jest-pact";

pactWith(
  { consumer: "checkout-service", provider: "payment-gateway" },
  (interaction) => {
    interaction("process payment", ({ provider, execute }) => {
      beforeEach(() =>
        provider
          .given("user has valid credit card")
          .uponReceiving("a payment request")
          .withRequest({
            method: "POST",
            path: "/api/v1/payments",
            body: { amount: 100, currency: "USD" },
          })
          .willRespondWith({
            status: 200,
            body: { transaction_id: "12345", status: "approved" },
          })
      );

      execute("should process payment", () => {
        // test implementation
      });
    });
  }
);
```

---

#### 3.2. `scaffold_property_tests`

**Propósito**: Gerar property-based tests (fast-check/Hypothesis/QuickCheck)

**Input Schema**:

```typescript
interface ScaffoldPropertyTestsParams {
  repo: string;
  product: string;
  targets: Array<{
    module: string;
    invariants: string[]; // e.g., "price >= 0", "total = sum(items)"
  }>;
}
```

**Output**: `qa/<product>/tests/unit/property/<module>.property.spec.ts`

**Exemplo gerado**:

```typescript
// qa/<product>/tests/unit/property/pricing.property.spec.ts
import fc from "fast-check";

describe("Pricing invariants", () => {
  it("price is always non-negative", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ price: fc.nat(), quantity: fc.nat() })),
        (items) => {
          const total = calculateTotal(items);
          return total >= 0;
        }
      )
    );
  });

  it("total equals sum of item prices", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ price: fc.nat(), quantity: fc.nat() })),
        (items) => {
          const total = calculateTotal(items);
          const expected = items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          );
          return total === expected;
        }
      )
    );
  });
});
```

---

#### 3.3. `scaffold_approval_tests`

**Propósito**: Gerar Approval/Golden Master tests para legado

**Input Schema**:

```typescript
interface ScaffoldApprovalTestsParams {
  repo: string;
  product: string;
  targets: Array<{
    module: string;
    output_format: "json" | "html" | "pdf" | "xml";
  }>;
}
```

**Output**: `qa/<product>/tests/approval/<module>/*.approval.spec.ts`

**Exemplo gerado**:

```typescript
// qa/<product>/tests/approval/report-generator.approval.spec.ts
import { toMatchSnapshot } from "jest";

describe("Report Generator (Approval Tests)", () => {
  it("should generate invoice PDF unchanged", () => {
    const invoice = generateInvoice({ orderId: "12345" });
    expect(invoice).toMatchSnapshot();
  });
});
```

---

### 4. Advanced Execution

#### 4.1. `run_contracts_verify`

**Propósito**: Executar verificação de contratos Pact

**Input Schema**:

```typescript
interface RunContractsVerifyParams {
  repo: string;
  product: string;
  broker_url?: string; // Pact Broker
}
```

**Output**: `qa/<product>/tests/reports/contracts-verify.json`

```json
{
  "total_contracts": 12,
  "verified": 11,
  "failed": 1,
  "verification_rate": 0.92,
  "failures": [
    {
      "consumer": "checkout-service",
      "provider": "inventory-service",
      "interaction": "check stock",
      "error": "Expected status 200, got 404"
    }
  ]
}
```

---

#### 4.2. `run_mutation_tests`

**Propósito**: Executar mutation testing (Stryker/PIT/Mutmut)

**Input Schema**:

```typescript
interface RunMutationTestsParams {
  repo: string;
  product: string;
  targets: string[]; // módulos críticos apenas
  framework?: "stryker" | "pit" | "mutmut";
  min_score?: number; // default 0.5
}
```

**Output**: `qa/<product>/tests/reports/mutation-score.json`

```json
{
  "framework": "stryker",
  "modules": [
    {
      "name": "billing-core",
      "total_mutants": 450,
      "killed": 288,
      "survived": 112,
      "timeout": 50,
      "score": 0.64
    }
  ],
  "overall_score": 0.58,
  "threshold": 0.5,
  "passed": true
}
```

---

### 5. Metrics & Health

#### 5.1. `suite_health`

**Propósito**: Medir saúde da suíte de testes

**Input Schema**:

```typescript
interface SuiteHealthParams {
  repo: string;
  product: string;
  history_days?: number; // default 30
}
```

**Output**: `qa/<product>/tests/reports/suite-health.json`

```json
{
  "total_runtime_sec": 465,
  "parallelism": 6,
  "flaky_tests": [
    {
      "name": "e2e checkout smoke",
      "runs": 100,
      "failures": 11,
      "flake_rate": 0.11
    }
  ],
  "instability_index": 0.07,
  "recommendations": [
    "Fix flaky test: e2e checkout smoke (11% flake rate)",
    "Increase parallelism to 8 workers (est. runtime: 290s)"
  ]
}
```

---

#### 5.2. `prod_metrics_ingest`

**Propósito**: Coletar métricas DORA de produção

**Input Schema**:

```typescript
interface ProdMetricsIngestParams {
  repo: string;
  product: string;
  sources: {
    sentry?: { dsn: string; project: string };
    datadog?: { api_key: string; app_key: string };
    grafana?: { url: string; token: string };
    jira?: { url: string; email: string; token: string };
    argo?: { url: string; token: string };
  };
  period?: { start: string; end: string }; // ISO dates
}
```

**Output**: `qa/<product>/tests/analyses/prod-metrics.json`

```json
{
  "period": { "start": "2025-06-01", "end": "2025-06-30" },
  "releases": [
    {
      "id": "v1.3.0",
      "deployed_at": "2025-06-15T10:30:00Z",
      "deploys_count": 210,
      "cfr": 0.12,
      "mttr_minutes": 38,
      "incidents": [{ "category": "checkout", "count": 3, "severity": "high" }]
    }
  ],
  "dora_metrics": {
    "deployment_frequency": "210/month",
    "lead_time_minutes": 45,
    "change_failure_rate": 0.12,
    "mttr_minutes": 38
  }
}
```

---

#### 5.3. `slo_canary_check`

**Propósito**: Avaliar canary/flags vs SLOs

**Input Schema**:

```typescript
interface SLOCanaryCheckParams {
  repo: string;
  product: string;
  slos_file: string;
  prod_metrics_file: string;
}
```

**Output**: `qa/<product>/tests/reports/slo-canary.md`

```markdown
# SLO Canary Report

## Summary

- **Period**: 2025-06-01 to 2025-06-30
- **SLOs Met**: 4/5 (80%)
- **Incidents**: 3 high-severity

## CUJ: checkout-purchase

- **SLO**: Latency P99 ≤ 500ms, Error Rate ≤ 1%, Availability ≥ 99.5%
- **Actual**: Latency P99 = 380ms ✅, Error Rate = 1.2% ❌, Availability = 99.7% ✅
- **Status**: ❌ VIOLATION (Error Rate exceeded)
- **Incidents**: 3 checkout failures (payment gateway timeout)

## Recommendations

1. Add circuit breaker to payment-gateway integration
2. Increase CDC test coverage (currently 60%)
3. Add chaos engineering test for gateway timeout
```

---

### 6. Quality Gates

#### 6.1. `release_quality_gate`

**Propósito**: Aplicar quality gates e retornar exit code para CI

**Input Schema**:

```typescript
interface ReleaseQualityGateParams {
  repo: string;
  product: string;
  thresholds_file?: string; // default: qa/<product>/thresholds.json
}
```

**Thresholds Schema** (`qa/<product>/thresholds.json`):

```json
{
  "production": {
    "cfr_max": 0.15,
    "mttr_max_minutes": 60
  },
  "mutation": {
    "min_score": 0.5,
    "critical_modules_min_score": 0.6
  },
  "contracts": {
    "verification_rate_min": 0.95,
    "zero_breaking_changes": true
  },
  "suite_health": {
    "flakiness_max": 0.03,
    "total_runtime_max_minutes": 12,
    "parallelism_min": 4
  },
  "portfolio": {
    "e2e_max_percent": 15,
    "unit_min_percent": 60
  }
}
```

**Output**: `qa/<product>/tests/reports/quality-gate.json`

```json
{
  "passed": false,
  "timestamp": "2025-11-03T19:00:00Z",
  "violations": [
    {
      "gate": "mutation.critical_modules_min_score",
      "expected": 0.6,
      "actual": 0.34,
      "severity": "blocking"
    }
  ],
  "metrics": {
    "cfr": 0.12,
    "mttr_minutes": 38,
    "mutation_score": 0.58,
    "critical_mutation_score": 0.34,
    "contract_verification_rate": 0.95,
    "suite_runtime_minutes": 7.75,
    "flakiness": 0.03
  },
  "exit_code": 1
}
```

---

## 📁 Estrutura de Pastas (Final)

```
qa/<product>/
├── thresholds.json                    # Quality gate thresholds
├── tests/
│   ├── analyses/                      # Raw data (14 files)
│   │   ├── cuj-catalog.json          # 🆕 CUJs mapeados
│   │   ├── slos.json                 # 🆕 SLOs por CUJ
│   │   ├── risk-register.json        # 🆕 Top riscos críticos
│   │   ├── prod-metrics.json         # 🆕 CFR/MTTR/escapados
│   │   ├── analyze.json
│   │   ├── coverage-analysis.json
│   │   ├── risk-map.json
│   │   └── TEST-QUALITY-LOGICAL.json
│   ├── reports/                       # Human-readable (13 files)
│   │   ├── portfolio-plan.md         # 🆕 Redesenho pirâmide
│   │   ├── contracts-verify.json     # 🆕 CDC verification
│   │   ├── mutation-score.json       # 🆕 Eficácia da suíte
│   │   ├── suite-health.json         # 🆕 Flakiness/tempo/paralelismo
│   │   ├── slo-canary.md             # 🆕 Canary vs SLOs
│   │   ├── quality-gate.json         # 🆕 Gates CI/CD
│   │   ├── QUALITY-REPORT.md
│   │   ├── PLAN.md
│   │   ├── PYRAMID.md
│   │   ├── PYRAMID.html
│   │   ├── COVERAGE-REPORT.md
│   │   ├── DIFF-COVERAGE.md
│   │   └── SELF-CHECK.md
│   ├── unit/                          # Unit tests
│   │   └── property/                 # 🆕 Property-based tests
│   ├── integration/                   # Service/Integration tests
│   ├── e2e/                           # E2E Playwright
│   ├── contracts/                     # 🆕 CDC (Pact)
│   │   ├── pact.config.ts
│   │   ├── <service-consumer>/
│   │   └── <service-provider>/
│   └── approval/                      # 🆕 Golden master tests
├── dashboards/
│   └── dashboard.html
└── fixtures/
    └── auth/
```

---

## 🔄 Pipeline Auto (Renovado)

### Novo `quality auto` - 8 Fases

```typescript
// src/tools/auto.ts (updated)

export async function autoQualityRun(options: AutoOptions): Promise<AutoResult> {
  const steps: string[] = [];
  const startTime = Date.now();

  // PHASE 0: Self-Check
  await selfCheck({ repo, product });
  steps.push('self-check');

  // PHASE 1: CUJ/SLO/Risk Discovery 🆕
  const cujResult = await catalogCUJs({ repo, product });
  steps.push('catalog-cujs');

  const slosResult = await defineSLOs({ repo, product, cuj_file: cujResult.output });
  steps.push('define-slos');

  const riskResult = await riskRegister({ repo, product, cuj_file: cujResult.output, slos_file: slosResult.output });
  steps.push('risk-register');

  // PHASE 2: Code Analysis + Portfolio Planning 🆕
  const analyzeResult = await analyze({ repo, product });
  steps.push('analyze');

  const coverageResult = await runCoverage({ repo, product });
  steps.push('coverage');

  const portfolioResult = await portfolioPlan({
    repo,
    product,
    risk_file: riskResult.output,
    coverage_file: coverageResult.output
  });
  steps.push('portfolio-plan');

  // PHASE 3: Scaffold All Test Types 🆕
  await scaffoldUnitTests({ repo, product });
  steps.push('scaffold-unit');

  await scaffoldIntegrationTests({ repo, product });
  steps.push('scaffold-integration');

  await scaffoldPlaywright({ repo, product });
  steps.push('scaffold-e2e');

  // 🆕 CDC
  await scaffoldContractsPact({ repo, product, services: [...] });
  steps.push('scaffold-contracts');

  // 🆕 Property-based (só para módulos com invariantes)
  await scaffoldPropertyTests({ repo, product, targets: [...] });
  steps.push('scaffold-property');

  // 🆕 Approval (só para legados complexos)
  await scaffoldApprovalTests({ repo, product, targets: [...] });
  steps.push('scaffold-approval');

  // PHASE 4: Execute Tests
  if (!options.skipRun) {
    // Unit + Service + CDC
    await runTests({ repo, product, types: ['unit', 'integration'] });
    steps.push('run-tests');

    // 🆕 Verify Contracts
    await runContractsVerify({ repo, product });
    steps.push('run-contracts');

    // E2E (smoke crítico apenas)
    await runPlaywright({ repo, product, tags: ['@smoke', '@critical'] });
    steps.push('run-e2e');
  }

  // PHASE 5: Measure Suite Health 🆕
  const suiteHealthResult = await suiteHealth({ repo, product });
  steps.push('suite-health');

  // PHASE 6: Mutation Testing (só módulos críticos) 🆕
  const criticalModules = riskResult.data.top_5_critical.map(r => r.module);
  const mutationResult = await runMutationTests({
    repo,
    product,
    targets: criticalModules
  });
  steps.push('mutation-tests');

  // PHASE 7: Production Metrics 🆕
  const prodMetricsResult = await prodMetricsIngest({
    repo,
    product,
    sources: { sentry: {...}, datadog: {...} }
  });
  steps.push('prod-metrics');

  const sloCanaryResult = await sloCanaryCheck({
    repo,
    product,
    slos_file: slosResult.output,
    prod_metrics_file: prodMetricsResult.output
  });
  steps.push('slo-canary');

  // PHASE 8: Quality Gates 🆕
  const gateResult = await releaseQualityGate({ repo, product });
  steps.push('quality-gate');

  // Generate Reports
  await pyramidReport({ repo, product });
  steps.push('pyramid-report');

  await buildReport({ repo, product });
  steps.push('build-report');

  return {
    ok: gateResult.passed,
    outputs: { ... },
    steps,
    duration: Date.now() - startTime,
    context: { ... },
    quality_gate: gateResult
  };
}
```

---

## 🚦 Quality Gates (Detalhado)

### Gates por Categoria

| Gate             | Métrica                   | Threshold   | Fonte                                    |
| ---------------- | ------------------------- | ----------- | ---------------------------------------- |
| **Production**   | CFR                       | ≤ 15%       | prod-metrics.json                        |
| **Production**   | MTTR                      | ≤ 60 min    | prod-metrics.json                        |
| **Eficácia**     | Mutation Score (overall)  | ≥ 50%       | mutation-score.json                      |
| **Eficácia**     | Mutation Score (critical) | ≥ 60%       | mutation-score.json + risk-register.json |
| **Contratos**    | Verification Rate         | ≥ 95%       | contracts-verify.json                    |
| **Contratos**    | Breaking Changes          | 0           | contracts-verify.json                    |
| **Suite Health** | Flakiness                 | ≤ 3%        | suite-health.json                        |
| **Suite Health** | Total Runtime             | ≤ 12 min    | suite-health.json                        |
| **Suite Health** | Parallelism               | ≥ 4 workers | suite-health.json                        |
| **Portfolio**    | E2E Tests                 | ≤ 15%       | portfolio-plan.md                        |
| **Portfolio**    | Unit Tests                | ≥ 60%       | portfolio-plan.md                        |

### Exit Codes para CI

```typescript
// release_quality_gate retorna:
{
  exit_code: 0; // ✅ All gates passed
  exit_code: 1; // ❌ Blocking violation (CFR, mutation critical)
  exit_code: 2; // ⚠️  Non-blocking violation (flakiness, E2E%)
}
```

---

## 📅 Plano de Implementação

### FASE 1: CUJ/SLO/Risk Tools (Est: 4-5 dias)

**Arquivos Novos**:

- `src/tools/catalog-cujs.ts`
- `src/tools/define-slos.ts`
- `src/tools/risk-register.ts`
- `src/tools/__tests__/catalog-cujs.test.ts`
- `src/tools/__tests__/define-slos.test.ts`
- `src/tools/__tests__/risk-register.test.ts`

**Dependências**:

- Parser de rotas: Express, Next.js, FastAPI
- OpenAPI parser: `swagger-parser`
- Telemetria: SDK Sentry/Datadog (opcional)

**Tasks**:

1. ✅ Criar interface `CUJ`, `SLO`, `Risk`
2. ✅ Implementar `catalog_cujs`: escanear rotas + OpenAPI
3. ✅ Implementar `define_slos`: template + validação
4. ✅ Implementar `risk_register`: scoring de impacto/probabilidade
5. ✅ Testes unitários (30+ cenários)
6. ✅ Integrar com `auto.ts` (Phase 1)

---

### FASE 2: Portfolio Planning (Est: 2-3 dias)

**Arquivos Novos**:

- `src/tools/portfolio-plan.ts`
- `src/tools/__tests__/portfolio-plan.test.ts`

**Tasks**:

1. ✅ Calcular distribuição atual (unit/service/E2E)
2. ✅ Recomendar rebalanceamento baseado em riscos
3. ✅ Sugerir CDC, property, approval por módulo
4. ✅ Estimar impacto no CI time
5. ✅ Gerar `portfolio-plan.md`

---

### FASE 3: CDC (Pact) (Est: 5-6 dias)

**Arquivos Novos**:

- `src/tools/scaffold-contracts-pact.ts`
- `src/tools/run-contracts-verify.ts`
- `src/adapters/pact-adapter.ts` (para cada stack)
- `src/tools/__tests__/scaffold-contracts-pact.test.ts`

**Dependências**:

- `@pact-foundation/pact` (Node.js/TypeScript)
- `pact-python` (Python)
- `pact-jvm` (Java)

**Tasks**:

1. ✅ Detectar serviços e integrações (analyze.json)
2. ✅ Gerar pact.config.ts
3. ✅ Scaffoldar consumer/provider tests
4. ✅ Implementar `run_contracts_verify`
5. ✅ Integração com Pact Broker (opcional)

---

### FASE 4: Property-Based Tests (Est: 3-4 dias)

**Arquivos Novos**:

- `src/tools/scaffold-property-tests.ts`
- `src/adapters/property-test-adapter.ts`
- Templates: `fast-check` (TS), `hypothesis` (Python), `QuickCheck` (Go)

**Tasks**:

1. ✅ Detectar módulos com lógica matemática/regras
2. ✅ Identificar invariantes (pricing, totals, estado)
3. ✅ Gerar templates por linguagem
4. ✅ Exemplos de invariantes comuns

---

### FASE 5: Approval Tests (Est: 2 dias)

**Arquivos Novos**:

- `src/tools/scaffold-approval-tests.ts`
- Templates: Jest snapshots, Approval Tests libraries

**Tasks**:

1. ✅ Detectar módulos legados (sem testes, alta complexidade)
2. ✅ Gerar approval tests para outputs complexos
3. ✅ Golden master fixtures

---

### FASE 6: Mutation Testing (Est: 4-5 dias)

**Arquivos Novos**:

- `src/tools/run-mutation-tests.ts`
- `src/adapters/mutation-adapter.ts` (Stryker/PIT/Mutmut)

**Dependências**:

- `@stryker-mutator/core` (TS/JS)
- `pitest` (Java)
- `mutmut` (Python)

**Tasks**:

1. ✅ Detectar framework de testes
2. ✅ Configurar mutation runner
3. ✅ Executar só em módulos críticos (risk-register)
4. ✅ Parsear resultados → mutation-score.json

---

### FASE 7: Suite Health (Est: 3 dias)

**Arquivos Novos**:

- `src/tools/suite-health.ts`
- `src/utils/flakiness-detector.ts`

**Tasks**:

1. ✅ Coletar histórico de execuções (CI logs, JUnit XML)
2. ✅ Calcular flake rate por teste
3. ✅ Medir runtime total e paralelismo
4. ✅ Recomendar otimizações

---

### FASE 8: Production Metrics (Est: 5-6 dias)

**Arquivos Novos**:

- `src/tools/prod-metrics-ingest.ts`
- `src/adapters/sentry-adapter.ts`
- `src/adapters/datadog-adapter.ts`
- `src/adapters/grafana-adapter.ts`
- `src/adapters/jira-adapter.ts`

**Tasks**:

1. ✅ Conectar com Sentry (erros, releases)
2. ✅ Conectar com Datadog (métricas, traces)
3. ✅ Conectar com Jira (incidents)
4. ✅ Calcular CFR, MTTR, deployment frequency
5. ✅ Gerar prod-metrics.json

---

### FASE 9: SLO Canary Check (Est: 2 dias)

**Arquivos Novos**:

- `src/tools/slo-canary-check.ts`

**Tasks**:

1. ✅ Comparar prod-metrics vs SLOs
2. ✅ Alertar violações por CUJ
3. ✅ Gerar slo-canary.md

---

### FASE 10: Quality Gates (Est: 3 dias)

**Arquivos Novos**:

- `src/tools/release-quality-gate.ts`
- `src/schemas/thresholds-schema.ts`

**Tasks**:

1. ✅ Carregar thresholds.json
2. ✅ Validar cada gate
3. ✅ Gerar quality-gate.json
4. ✅ Retornar exit code

---

### FASE 11: Integração Auto.ts (Est: 3-4 dias)

**Tasks**:

1. ✅ Adicionar Phases 1-8 ao pipeline
2. ✅ Orquestrar dependências entre tools
3. ✅ Atualizar AutoResult interface
4. ✅ Testes E2E do pipeline completo

---

### FASE 12: MCP Server + Documentação (Est: 2-3 dias)

**Tasks**:

1. ✅ Adicionar 13 tools ao manifest
2. ✅ Atualizar README com quality gates
3. ✅ Criar QUALITY-GATES-GUIDE.md
4. ✅ CI/CD examples

---

## 📊 Cronograma

| Fase                    | Duração        | Deps | Risco                       |
| ----------------------- | -------------- | ---- | --------------------------- |
| 1. CUJ/SLO/Risk         | 4-5 dias       | -    | 🟡 Médio (parsers de rotas) |
| 2. Portfolio Planning   | 2-3 dias       | 1    | 🟢 Baixo                    |
| 3. CDC (Pact)           | 5-6 dias       | 1    | 🔴 Alto (multi-stack)       |
| 4. Property Tests       | 3-4 dias       | 1    | 🟡 Médio (templates)        |
| 5. Approval Tests       | 2 dias         | -    | 🟢 Baixo                    |
| 6. Mutation Testing     | 4-5 dias       | -    | 🔴 Alto (múltiplos runners) |
| 7. Suite Health         | 3 dias         | -    | 🟡 Médio (histórico CI)     |
| 8. Prod Metrics         | 5-6 dias       | 1    | 🔴 Alto (APIs externas)     |
| 9. SLO Canary           | 2 dias         | 1, 8 | 🟢 Baixo                    |
| 10. Quality Gates       | 3 dias         | 2-9  | 🟢 Baixo                    |
| 11. Auto.ts Integration | 3-4 dias       | 1-10 | 🟡 Médio (orquestração)     |
| 12. MCP + Docs          | 2-3 dias       | 11   | 🟢 Baixo                    |
| **TOTAL**               | **38-50 dias** | -    | -                           |

**Estimativa**: 2-2.5 meses (1 dev full-time)

---

## ✅ Critérios de Sucesso

### Must Have

- [ ] 13 novas tools implementadas e testadas
- [ ] Pipeline `auto` com todas as fases fases funcionando
- [ ] Quality gates bloqueando builds ruins (exit code)
- [ ] Estrutura `qa/<product>` completa (14 analyses, 13 reports)
- [ ] 700+ testes passando (621 existentes + ~80 novos)

### Should Have

- [ ] CDC (Pact) funcional para ≥2 stacks (TS, Python)
- [ ] Mutation testing para ≥3 runners (Stryker, PIT, Mutmut)
- [ ] Prod metrics de ≥2 fontes (Sentry + Datadog)
- [ ] Documentação completa (QUALITY-GATES-GUIDE.md)

### Could Have

- [ ] Dashboard interativo mostrando gates
- [ ] Integração com Pact Broker
- [ ] CI/CD templates (.github/workflows/)
- [ ] Suporte para Chaos Engineering

---

## 🚀 Próximos Passos Imediatos

1. **Validar proposta** com usuário
2. **Criar branch**: `git checkout -b feature/quality-gates`
3. **FASE 1**: Implementar CUJ/SLO/Risk tools
4. **Dogfooding**: Rodar em mcp-Quality-CLI
5. **Iterar**: Ajustar baseado em feedback

---

**Status**: 🚧 EM PROGRESSO (6/12 fases completas - 50%)  
**Prioridade**: 🔥 ALTA (próxima evolução natural)  
**Esforço Inicial**: 38-50 dias → **Revisado**: 25-30 dias (ritmo acelerado)  
**ROI**: ⭐⭐⭐⭐⭐ (transforma de "ferramenta de cobertura" para "plataforma de qualidade")

---

## ⚠️ Lacunas e Inconsistências Identificadas

**Data**: 2025-11-04 (Auditoria Técnica Completa)

### 1. Engine Multi-Linguagem Incompleta

**Problema**: `src/engine/adapters/` contém apenas TypeScript. Apesar de existirem adapters em `src/adapters/` (Python/Go/Java/Ruby) para gerar testes, o engine (descoberta, mutation, coverage parsing consolidado, execução) não usa esses adapters consistentemente.

**Impacto**: O comando `quality analyze/auto` não entrega o mesmo "one-shot" fora do TS/JS.

**Solução**:

- Padronizar interface do engine para receber um `LanguageAdapter` unificado
- Mover adapter TypeScript atual para `src/adapters/` (mesma família)
- Criar contrato único: `LanguageAdapter` com métodos:
  - `detectFramework()`
  - `runTests()`
  - `parseCoverage()`
  - `runMutation()`
  - `discoverEndpoints()`

**Prioridade**: 🔴 ALTA (bloqueia suporte real multi-linguagem)

---

### 2. CDC/Pact "Meio do Caminho"

**Problema**: Há scaffolding de Pact (`scaffold-contracts-pact.ts`) mas o passo "run/verify Pact" não está integrado ao pipeline. Não há coleta de relatórios Pact no `consolidate-reports.ts`.

**Impacto**: CDC gerado mas nunca executado automaticamente.

**Solução**:

- ✅ `run-contracts-verify.ts` já existe mas não integrado
- Adicionar parsing de relatórios Pact (JSON/HTML)
- Integrar no `auto.ts` antes de `validate`
- Consolidar em `CODE-ANALYSIS.md` ou `TEST-PLAN.md`

**Prioridade**: 🟡 MÉDIA (funcionalidade parcialmente implementada)

---

### 3. Coverage & Mutation Fora de TS/JS

**Problema**: `run-coverage.ts` trata vários formatos, mas a execução depende do framework (pytest, junit, go test) e não há runners específicos por linguagem.

**Impacto**: Cobertura e mutation score só funciona para TS/JS.

**Solução**:

- Criar executores por linguagem:
  - `runners/python-runner.ts` (pytest + coverage.py)
  - `runners/go-runner.ts` (go test -cover)
  - `runners/java-runner.ts` (JUnit + JaCoCo)
- Criar parsers de cobertura:
  - `parsers/cobertura-parser.ts` (Python/Java)
  - `parsers/jacoco-parser.ts` (Java)
  - `parsers/lcov-parser.ts` (JS/TS)
  - `parsers/gocov-parser.ts` (Go)

**Prioridade**: 🔴 ALTA (funcionalidade core limitada)

---

### 4. Dois "Sistemas de Adapters"

**Problema**: `src/engine/adapters` (TS) vs `src/adapters` (multi-linguagem). Cada parte usa um sistema diferente.

**Impacto**: Duplicação de lógica, manutenção difícil, evolução divergente.

**Solução**:

- Unificar em **um único contrato** `LanguageAdapter`:

```typescript
interface LanguageAdapter {
  language: string;
  detectFramework(repo: string): Promise<Framework>;
  discoverTests(repo: string): Promise<TestFile[]>;
  runTests(repo: string, options: RunOptions): Promise<TestResult>;
  parseCoverage(coverageFile: string): Promise<Coverage>;
  runMutation(repo: string, targets: string[]): Promise<MutationResult>;
  scaffoldTest(target: TestTarget): Promise<string>;
}
```

- Migrar adapter TS do engine para `src/adapters/typescript.ts`
- Engine consome adapters de forma polimórfica

**Prioridade**: 🔴 ALTA (arquitetura fundamental)

---

### 5. Dependências Externas em Runtime

**Problema**: O fluxo supõe que o repo já tem Playwright/Vitest/Jest/pytest instalados.

**Impacto**: Primeiras execuções falham com erros crípticos.

**Solução**:

- Expandir `self-check.ts` para:
  - Detectar ferramentas faltantes
  - Imprimir comandos exatos: `npm i -D vitest @vitest/coverage-v8`
  - Modo `--bootstrap-deps` que instala automaticamente
  - Lockar versões recomendadas
- Criar `docs/SETUP-BY-LANGUAGE.md`:
  - TypeScript: vitest + coverage-v8 + stryker
  - Python: pytest + pytest-cov + mutmut
  - Go: go test + gotestsum + go-mutesting
  - Java: JUnit 5 + JaCoCo + PIT

**Prioridade**: 🟡 MÉDIA (UX crítico para onboarding)

---

### 6. Plan/Strategy Podem Se Beneficiar do Risco Real

**Problema**: Heurística de risco é estática (rotas críticas, endpoints sem contrato). Não usa métricas reais do repositório.

**Impacto**: Plano pode não priorizar os módulos realmente problemáticos.

**Solução**:

- Puxar sinais reais:
  - **Git churn**: arquivos com mais commits (código volátil)
  - **Complexidade ciclomática**: funções complexas (risk-prone)
  - **Histórico de flakiness**: testes que falharam intermitentemente
  - **MTTR por módulo**: tempo médio de reparo
  - **Tamanho de diff**: arquivos com grandes mudanças
- Integrar no `risk-register.ts`:
  - Calcular score composto: `impact × probability × volatility`
  - Priorizar no `portfolio-plan.ts`

**Prioridade**: 🟢 BAIXA (enhancement, não blocker)

---

### 7. Validação "Diff Coverage"

**Problema**: Schema prevê `diff_coverage_min`, mas não há coleta de LCOV por diff de PR integrada (apenas cobertura global).

**Impacto**: Não valida se código novo está testado.

**Solução**:

- Criar `run-diff-coverage.ts`:
  - Integrar com `git diff main...HEAD`
  - Gerar coverage focado no diff
  - Parser: `nyc report --include <diff-files>` ou coverage filtrado
- Adicionar gate em `validate.ts`:
  - `diff_coverage >= 60%` (threshold configurável)
- Reportar em `DIFF-COVERAGE.md`

**Prioridade**: 🟡 MÉDIA (CI/CD quality gate importante)

---

## 🛠️ Roadmap para "Fechar" a V1 Sólida

### Fase A: Unificar Adapters (5-7 dias)

1. Criar contrato `LanguageAdapter` unificado
2. Migrar adapter TS do engine para `src/adapters/typescript.ts`
3. Implementar adapters completos:
   - Python: pytest + coverage.py + mutmut
   - Go: go test + gocov + go-mutesting
4. Engine passa a consumir adapters polimorficamente

### Fase B: CDC Completo (2-3 dias)

1. Integrar `run-contracts-verify.ts` no pipeline
2. Parser de relatórios Pact (JSON/HTML)
3. Consolidar em relatórios principais
4. Adicionar gate: `contract_verification_rate >= 95%`

### Fase C: Coverage/Mutation Multi-Linguagem (4-5 dias)

1. Criar runners por linguagem (Python, Go, Java)
2. Criar parsers de cobertura (Cobertura, JaCoCo, gocov)
3. Integrar mutation testing multi-linguagem
4. Testar com projetos reais em cada stack

### Fase D: Bootstrap de Dependências (2 dias)

1. Expandir `self-check.ts` com detecção de faltas
2. Modo `--bootstrap-deps` para instalação automática
3. Criar `SETUP-BY-LANGUAGE.md` com receitas prontas

### Fase E: Diff Coverage (3 dias)

1. Implementar `run-diff-coverage.ts`
2. Integrar com git diff
3. Adicionar gate em `validate.ts`
4. Reportar em `DIFF-COVERAGE.md`

### Fase F: Risco Dinâmico (3-4 dias)

1. Coletar git churn por arquivo
2. Calcular complexidade ciclomática
3. Integrar flakiness histórico
4. Score composto em `risk-register.ts`

### Fase G: Documentação e Testes (2-3 dias)

1. Tabela "Linguagem × Suporte" no README
2. Testes E2E por linguagem
3. CI matrix com Python/Go/TS
4. Guias de uso por stack

---

## 📊 Cronograma Revisado

| Fase Original         | Status  | Nova Fase              | Status | Prioridade |
| --------------------- | ------- | ---------------------- | ------ | ---------- |
| 1. CUJ/SLO/Risk       | ✅ 100% | A. Unificar Adapters   | ❌ 0%  | 🔴 ALTA    |
| 2. Portfolio Planning | ✅ 100% | B. CDC Completo        | ⚠️ 50% | 🟡 MÉDIA   |
| 3. CDC (Pact)         | ✅ 80%  | C. Coverage Multi-Lang | ❌ 20% | 🔴 ALTA    |
| 4. Property Tests     | ✅ 100% | D. Bootstrap Deps      | ❌ 0%  | 🟡 MÉDIA   |
| 5. Approval Tests     | ✅ 100% | E. Diff Coverage       | ❌ 0%  | 🟡 MÉDIA   |
| 6. Mutation Testing   | ❌ 0%   | F. Risco Dinâmico      | ❌ 0%  | 🟢 BAIXA   |
| 7. Suite Health       | ✅ 100% | G. Docs & Testes       | ⚠️ 30% | 🟡 MÉDIA   |
| 8. Prod Metrics       | ❌ 0%   | -                      | -      | -          |
| 9. SLO Canary         | ❌ 0%   | -                      | -      | -          |
| 10. Quality Gates     | ❌ 0%   | -                      | -      | -          |
| 11. Integration       | ⚠️ 50%  | -                      | -      | -          |
| 12. MCP + Docs        | ⚠️ 20%  | -                      | -      | -          |

**Novo Esforço Total**: 21-27 dias (3-4 semanas)  
**Prioridade 1 (Blockers)**: Fases A, C (9-12 dias)  
**Prioridade 2 (Importante)**: Fases B, D, E, G (9-11 dias)  
**Prioridade 3 (Enhancement)**: Fase F (3-4 dias)

---

## ✅ Critérios de Sucesso V1 (Revisado)

### Must Have

- [x] 6/12 fases originais implementadas (50%)
- [x] Property Tests + Approval Tests funcionais
- [x] Suite Health monitorando flakiness
- [ ] **Suporte real multi-linguagem (TS + Python + Go)**
- [ ] **Coverage + Mutation para ≥3 stacks**
- [ ] **CDC integrado ao pipeline**
- [ ] **Bootstrap de dependências**
- [ ] 700+ testes passando (666 atuais + ~50 novos)

### Should Have

- [ ] Diff Coverage validado em PRs
- [ ] Risco dinâmico (git churn + complexidade)
- [ ] Documentação completa por linguagem
- [ ] CI matrix testando Python/Go/TS

### Could Have

- [ ] Dashboard interativo (quality gates visíveis)
- [ ] Pact Broker integration
- [ ] Chaos Engineering tests
- [ ] Prod metrics (Sentry/Datadog)
