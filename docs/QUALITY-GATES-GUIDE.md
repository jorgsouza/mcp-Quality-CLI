# 🚦 Quality Gates Guide

Guia completo sobre Quality Gates no MCP Quality CLI - conceitos, configuração e best practices.

---

## 📋 Índice

- [O que são Quality Gates?](#o-que-são-quality-gates)
- [Métricas Monitoradas](#métricas-monitoradas)
- [Configuração](#configuração)
- [Pipeline Completo](#pipeline-completo)
- [Exit Codes para CI](#exit-codes-para-ci)
- [Thresholds Customizados](#thresholds-customizados)
- [Integração CI/CD](#integração-cicd)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## 🎯 O que são Quality Gates?

**Quality Gates** são critérios de qualidade que devem ser atendidos para que uma mudança de código seja aprovada para produção. Eles funcionam como "portas" (gates) que bloqueiam deploys arriscados e garantem que o código atenda aos padrões mínimos de qualidade.

### Por que usar Quality Gates?

- ✅ **Prevenir bugs em produção**: Detectar problemas antes do deploy
- ✅ **Garantir qualidade consistente**: Definir padrões claros e mensuráveis
- ✅ **Automatizar aprovações**: Reduzir revisões manuais e erros humanos
- ✅ **Melhorar confiança**: Dados objetivos para decisões de release

---

## 📊 Métricas Monitoradas

O MCP Quality CLI monitora 6 categorias de métricas:

### 1. Coverage (Cobertura de Testes)

| Métrica | Threshold Padrão | Severidade |
|---------|------------------|------------|
| Lines | ≥ 80% | Non-blocking |
| Branches | ≥ 75% | Non-blocking |
| Functions | ≥ 80% | Non-blocking |

**Violação bloqueante?** Não (⚠️ warning)

### 2. Mutation (Mutation Testing)

| Métrica | Threshold Padrão | Severidade |
|---------|------------------|------------|
| Overall Score | ≥ 50% | Non-blocking |
| Critical Modules | ≥ 60% | **Blocking** ❌ |

**Violação bloqueante?** Sim, para módulos críticos (🔴 fail)

### 3. Contracts (CDC/Pact)

| Métrica | Threshold Padrão | Severidade |
|---------|------------------|------------|
| Verification Rate | ≥ 95% | Non-blocking |
| Breaking Changes | 0 | **Blocking** ❌ |

**Violação bloqueante?** Sim, se há breaking changes (🔴 fail)

### 4. Suite Health

| Métrica | Threshold Padrão | Severidade |
|---------|------------------|------------|
| Flakiness Rate | ≤ 3% | Non-blocking |
| Runtime | ≤ 12 min | Non-blocking |
| Parallelism | ≥ 4 workers | Non-blocking |

**Violação bloqueante?** Não (⚠️ warning)

### 5. Portfolio (Test Pyramid)

| Métrica | Threshold Padrão | Severidade |
|---------|------------------|------------|
| E2E Tests | ≤ 15% | Non-blocking |
| Unit Tests | ≥ 60% | Non-blocking |

**Violação bloqueante?** Não (⚠️ warning)

### 6. Production (DORA Metrics)

| Métrica | Threshold Padrão | Severidade |
|---------|------------------|------------|
| Change Failure Rate | ≤ 15% | **Blocking** ❌ |
| MTTR | ≤ 60 min | Non-blocking |
| Deployment Frequency | ≥ 1/month | Non-blocking |

**Violação bloqueante?** Sim, se CFR > 15% (🔴 fail)

---

## ⚙️ Configuração

### 1. Estrutura de Arquivos

Os Quality Gates leem métricas de vários arquivos gerados pelo pipeline:

```
qa/<product>/tests/
├── analyses/
│   ├── mutation-results.json      # → mutation gates
│   ├── prod-metrics.json          # → production gates
│   ├── contract-catalog.json      # → contracts gates
│   ├── suite-health.json          # → suite health gates
│   ├── portfolio-plan.json        # → portfolio gates
│   └── coverage-analysis.json     # → coverage gates
└── reports/
    └── quality-gate.json          # ← output
```

### 2. Thresholds Padrão

Os thresholds padrão estão definidos em `src/schemas/thresholds-schema.ts`:

```typescript
export const DEFAULT_THRESHOLDS: QualityGateThresholds = {
  coverage: {
    lines_min: 80,
    branches_min: 75,
    functions_min: 80,
  },
  mutation: {
    overall_min: 50,
    critical_min: 60,
  },
  contracts: {
    verification_min: 0.95,
    breaking_changes_max: 0,
  },
  suite_health: {
    flakiness_max: 0.03,
    runtime_max_minutes: 12,
    parallelism_min: 4,
  },
  portfolio: {
    e2e_max: 0.15,
    unit_min: 0.60,
  },
  production: {
    cfr_max: 0.15,
    mttr_max_minutes: 60,
    deployment_frequency_min: 1,
  },
};
```

### 3. Customizar Thresholds

Crie um arquivo `.quality-gates.json` na raiz do projeto:

```json
{
  "coverage": {
    "lines_min": 90,
    "branches_min": 85
  },
  "mutation": {
    "critical_min": 70
  },
  "production": {
    "cfr_max": 0.10
  }
}
```

Os valores customizados fazem **merge** com os padrões!

---

## 🔄 Pipeline Completo

### Fluxo de Execução

```
┌─────────────────────────────────────────────────────────────┐
│                    MCP Quality Pipeline                      │
└─────────────────────────────────────────────────────────────┘

1. Init & Discovery
   ├─ Self-check
   ├─ Catalog CUJs
   ├─ Define SLOs
   └─ Risk Register

2. Portfolio Planning
   └─ Redesenha pirâmide de testes

3. Contract Testing (CDC/Pact)
   ├─ Scaffold contracts
   └─ Verify contracts

4. Analysis & Planning
   ├─ Analyze code
   ├─ Coverage analysis
   └─ Test strategy

5. Suite Health
   └─ Flakiness, runtime, parallelism

6. Mutation Testing 🧬
   └─ Test quality score

7. Production Metrics 📊
   └─ DORA metrics (CFR, MTTR, Deploy Freq, Lead Time)

8. SLO Canary 🕯️
   └─ Compare prod metrics vs SLOs

9. Quality Gates 🚦 ← VALIDAÇÃO FINAL
   └─ Valida todas as métricas

10. Consolidated Reports
    ├─ CODE-ANALYSIS.md
    └─ TEST-PLAN.md
```

### Comando Completo

```bash
# Executa pipeline completo + Quality Gates
npx quality-cli analyze --mode full

# Ou via MCP
{
  "name": "quality_analyze",
  "arguments": {
    "repo": "/path/to/repo",
    "product": "my-app",
    "mode": "full"
  }
}
```

---

## 🚨 Exit Codes para CI

O Quality Gate retorna 3 exit codes possíveis:

### Exit Code 0: ✅ PASSED

**Todos os gates foram atendidos!**

```json
{
  "exit_code": 0,
  "summary": {
    "total_gates": 15,
    "passed_gates": 15,
    "failed_gates": 0,
    "blocking_violations": 0,
    "non_blocking_violations": 0
  }
}
```

**Ação no CI**: ✅ Aprovar PR / Continuar deploy

---

### Exit Code 1: ❌ BLOCKED

**Violações bloqueantes detectadas!**

Critérios bloqueantes:
- 🔴 **CFR > 15%** (Change Failure Rate alto)
- 🔴 **Mutation critical < 60%** (Módulos críticos sem testes)
- 🔴 **Breaking changes > 0** (Contratos quebrados)

```json
{
  "exit_code": 1,
  "summary": {
    "total_gates": 15,
    "passed_gates": 12,
    "failed_gates": 3,
    "blocking_violations": 2,
    "non_blocking_violations": 1
  },
  "violations": [
    {
      "gate": "production.change_failure_rate",
      "category": "production",
      "severity": "blocking",
      "expected": 0.15,
      "actual": 0.22,
      "message": "Change Failure Rate 22.0% > 15.0%"
    }
  ]
}
```

**Ação no CI**: ❌ Bloquear PR / Rejeitar deploy

---

### Exit Code 2: ⚠️ NON-BLOCKING WARNINGS

**Apenas violações não-bloqueantes (avisos)**

Exemplos:
- ⚠️ Cobertura < 80% (mas não é bloqueante)
- ⚠️ Flakiness > 3%
- ⚠️ E2E > 15%

```json
{
  "exit_code": 2,
  "summary": {
    "total_gates": 15,
    "passed_gates": 13,
    "failed_gates": 2,
    "blocking_violations": 0,
    "non_blocking_violations": 2
  }
}
```

**Ação no CI**: ⚠️ Aprovar com avisos / Monitorar

---

## 🎛️ Thresholds Customizados

### Arquivo `.quality-gates.json`

```json
{
  "$schema": "https://quality-cli.dev/schemas/quality-gates.schema.json",
  
  "coverage": {
    "lines_min": 90,
    "branches_min": 85,
    "functions_min": 90
  },
  
  "mutation": {
    "overall_min": 60,
    "critical_min": 75
  },
  
  "contracts": {
    "verification_min": 0.98,
    "breaking_changes_max": 0
  },
  
  "suite_health": {
    "flakiness_max": 0.02,
    "runtime_max_minutes": 10,
    "parallelism_min": 8
  },
  
  "portfolio": {
    "e2e_max": 0.10,
    "unit_min": 0.70
  },
  
  "production": {
    "cfr_max": 0.10,
    "mttr_max_minutes": 45,
    "deployment_frequency_min": 30
  }
}
```

### Via CLI

```bash
# Especificar arquivo customizado
npx quality-cli validate \
  --thresholds ./custom-gates.json
```

### Validação de Schema

O arquivo é validado usando Zod! Erros claros se houver problema:

```
❌ Invalid thresholds:
  - coverage.lines_min must be between 0-100
  - mutation.critical_min is required
```

---

## 🔗 Integração CI/CD

### GitHub Actions

```yaml
name: Quality Gates

on:
  pull_request:
    branches: [main]

jobs:
  quality-gates:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install MCP Quality CLI
        run: npm install -g @quality/mcp-cli
      
      - name: Run Quality Analysis
        run: npx quality-cli analyze --mode full
      
      - name: Apply Quality Gates
        id: gates
        run: |
          npx quality-cli validate
          echo "exit_code=$?" >> $GITHUB_OUTPUT
      
      - name: Comment PR
        if: always()
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(
              fs.readFileSync('qa/*/tests/analyses/quality-gate.json')
            );
            
            const status = report.exit_code === 0 ? '✅ PASSED' : 
                          report.exit_code === 1 ? '❌ BLOCKED' : 
                          '⚠️ WARNINGS';
            
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Quality Gates: ${status}\n\n` +
                    `Gates: ${report.summary.passed_gates}/${report.summary.total_gates} passed`
            });
      
      - name: Fail if blocked
        if: steps.gates.outputs.exit_code == '1'
        run: exit 1
```

### GitLab CI

```yaml
quality-gates:
  stage: test
  image: node:20
  
  script:
    - npm install -g @quality/mcp-cli
    - npx quality-cli analyze --mode full
    - npx quality-cli validate
  
  artifacts:
    when: always
    paths:
      - qa/*/tests/reports/
    reports:
      junit: qa/*/tests/reports/quality-gate.xml
  
  allow_failure:
    exit_codes: 2  # Non-blocking warnings são OK
```

### Jenkins

```groovy
pipeline {
  agent any
  
  stages {
    stage('Quality Gates') {
      steps {
        script {
          sh 'npm install -g @quality/mcp-cli'
          sh 'npx quality-cli analyze --mode full'
          
          def exitCode = sh(
            script: 'npx quality-cli validate',
            returnStatus: true
          )
          
          if (exitCode == 1) {
            error('Quality Gates: BLOCKED')
          } else if (exitCode == 2) {
            unstable('Quality Gates: WARNINGS')
          }
        }
      }
    }
  }
}
```

---

## 💡 Best Practices

### 1. Começe com Thresholds Conservadores

```json
{
  "coverage": { "lines_min": 60 },
  "mutation": { "overall_min": 40 }
}
```

**Aumente gradualmente** conforme o time se adapta!

### 2. Bloqueie Apenas o Crítico

**Bloqueantes** (exit code 1):
- Change Failure Rate alto
- Mutation critical baixo
- Breaking changes em contracts

**Não-bloqueantes** (exit code 2):
- Coverage baixo
- Flakiness
- Pyramid imbalance

### 3. Monitor DORA Metrics

Configure coleta de métricas de produção:

```bash
# Configurar credenciais
export SENTRY_DSN="..."
export DD_API_KEY="..."
export GRAFANA_URL="..."

# Coletar metrics
npx quality-cli prod-metrics-ingest
```

### 4. SLO Canary para Features Críticas

Defina SLOs por CUJ:

```bash
npx quality-cli define-slos
```

Valide antes do deploy:

```bash
npx quality-cli slo-canary-check
```

### 5. Mutation Testing em Módulos Críticos

Priorize módulos de alto risco:

```bash
npx quality-cli risk-register
npx quality-cli run-mutation-tests
```

### 6. Iterate on Thresholds

Revise thresholds **trimestralmente**:

```bash
# Gerar relatório de métricas históricas
npx quality-cli report --period 90d
```

---

## 🐛 Troubleshooting

### ❌ "Métricas não encontradas"

**Problema**: `quality-gate.json` não gerado

**Solução**: Execute o pipeline completo antes:

```bash
npx quality-cli analyze --mode full
npx quality-cli validate
```

---

### ❌ "Exit code 1: BLOCKED"

**Problema**: Violações bloqueantes

**Soluções**:

1. **CFR alto (>15%)**
   ```bash
   # Analise falhas recentes
   npx quality-cli prod-metrics-ingest
   
   # Aumente cobertura de testes
   npx quality-cli scaffold-unit
   ```

2. **Mutation critical baixo (<60%)**
   ```bash
   # Identifique módulos críticos
   npx quality-cli risk-register
   
   # Execute mutation testing
   npx quality-cli run-mutation-tests
   
   # Adicione testes para matar mutantes
   ```

3. **Breaking changes em contracts**
   ```bash
   # Verifique contratos
   npx quality-cli run-contracts-verify
   
   # Corrija endpoints quebrados
   ```

---

### ⚠️ "Exit code 2: WARNINGS"

**Problema**: Métricas abaixo do ideal (mas não bloqueantes)

**Estratégias**:

1. **Coverage baixo**
   ```bash
   # Gere scaffolds
   npx quality-cli scaffold-unit
   npx quality-cli scaffold-integration
   ```

2. **Flakiness alto (>3%)**
   ```bash
   # Analise suite health
   npx quality-cli suite-health
   
   # Identifique testes flaky
   grep "flaky" qa/*/tests/reports/SUITE-HEALTH.md
   ```

3. **E2E > 15%**
   ```bash
   # Redesenhe pirâmide
   npx quality-cli portfolio-plan
   
   # Converta E2E em unit/integration
   ```

---

### 🔍 "Thresholds customizados não aplicados"

**Problema**: `.quality-gates.json` ignorado

**Verificações**:

1. Arquivo na raiz do repo?
   ```bash
   ls -la .quality-gates.json
   ```

2. JSON válido?
   ```bash
   cat .quality-gates.json | jq .
   ```

3. Schema correto?
   ```bash
   npx quality-cli validate --check-config
   ```

---

## 📚 Recursos

- **DORA Metrics**: [DORA Report 2023](https://dora.dev/publications/)
- **SLO Best Practices**: [Google SRE Book](https://sre.google/sre-book/service-level-objectives/)
- **Mutation Testing**: [Stryker Mutator](https://stryker-mutator.io/)
- **CDC/Pact**: [Pact.io Docs](https://docs.pact.io/)
- **Test Pyramid**: [Martin Fowler's Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

---

## 🎯 Próximos Passos

1. ✅ **Rode o pipeline completo**
   ```bash
   npx quality-cli analyze --mode full
   ```

2. ✅ **Aplique Quality Gates**
   ```bash
   npx quality-cli validate
   ```

3. ✅ **Revise relatórios**
   ```bash
   cat qa/*/tests/reports/CODE-ANALYSIS.md
   cat qa/*/tests/reports/quality-gate.json
   ```

4. ✅ **Customize thresholds**
   ```bash
   echo '{"coverage": {"lines_min": 90}}' > .quality-gates.json
   ```

5. ✅ **Integre com CI/CD**
   - GitHub Actions
   - GitLab CI
   - Jenkins
   - Azure Pipelines

---

**Versão**: 1.0.0  
**Atualizado**: 2025-11-04  
**Mantido por**: MCP Quality CLI Team

