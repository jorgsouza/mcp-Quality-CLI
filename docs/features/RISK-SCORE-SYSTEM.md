# Risk Score System 📊

Sistema de Cálculo de Risco Probabilístico para priorização de testes.

## Visão Geral

O Risk Score System calcula scores de 0-100 para cada arquivo/endpoint baseado em **Probability** (probabilidade de falha) × **Impact** (impacto da falha).

## Formula de Cálculo

```
Risk Score = Probability × Impact / 100

onde:

Probability (0-100) = 
  - changeFrequency (40%)  : Frequência de commits nos últimos 30 dias
  - recentBugs (35%)       : Bugs reportados recentemente
  - complexity (25%)       : Complexidade ciclomática estimada

Impact (0-100) = 
  - testCoverage (40%)     : Inverso da cobertura (menos cobertura = mais impacto)
  - isCriticalFlow (35%)   : Está em critical_flows? (auth, payment, checkout)
  - isUserFacing (25%)     : Interface visível ao usuário final?
```

## Níveis de Risco

| Nível | Score | Ação Recomendada |
|-------|-------|------------------|
| 🔴 **CRITICAL** | 80-100 | Prioridade máxima, criar testes imediatamente |
| 🟠 **HIGH** | 60-79 | Alta prioridade, incluir no próximo sprint |
| 🟡 **MEDIUM** | 40-59 | Prioridade média, monitorar e testar gradualmente |
| 🟢 **LOW** | 0-39 | Baixa prioridade, manter monitoramento básico |

## Funções Disponíveis

### `calculateRiskScore(factors: RiskFactors): RiskScore`

Calcula o score de risco para um arquivo/endpoint.

**Exemplo:**
```typescript
import { calculateRiskScore } from './utils/risk-calculator.js';

const score = calculateRiskScore({
  filePath: '/api/checkout',
  changeFrequency: 0.8,      // 80% de commits nos últimos 30 dias
  recentBugs: 0.6,            // 60% de bugs recentes
  complexity: 0.7,            // Complexidade alta
  testCoverage: 0.3,          // Apenas 30% de cobertura
  isCriticalFlow: true,       // Fluxo crítico de pagamento
  isUserFacing: true          // Interface do usuário
});

// Resultado:
// {
//   file: '/api/checkout',
//   probability: 71.5,  // (0.8*40 + 0.6*35 + 0.7*25)
//   impact: 93.0,       // ((1-0.3)*40 + 1*35 + 1*25)
//   score: 66.5,        // 71.5 × 93.0 / 100
//   level: 'HIGH'
// }
```

### `groupByRiskLevel(scores: RiskScore[]): Record<string, RiskScore[]>`

Agrupa scores por nível de risco.

**Exemplo:**
```typescript
import { groupByRiskLevel, calculateRiskScores } from './utils/risk-calculator.js';

const files = [
  { filePath: '/api/login', /* ... factors ... */ },
  { filePath: '/api/products', /* ... factors ... */ },
  { filePath: '/api/search', /* ... factors ... */ }
];

const scores = calculateRiskScores(files);
const grouped = groupByRiskLevel(scores);

// Resultado:
// {
//   'CRITICAL': [{ file: '/api/login', score: 85.2, ... }],
//   'HIGH': [],
//   'MEDIUM': [{ file: '/api/products', score: 45.0, ... }],
//   'LOW': [{ file: '/api/search', score: 12.3, ... }]
// }
```

### `estimateComplexity(fileContent: string): number`

Estima complexidade ciclomática baseada em padrões de código.

**Exemplo:**
```typescript
import { estimateComplexity } from './utils/risk-calculator.js';

const code = `
function processPayment(amount, card) {
  if (amount > 0 && card.valid) {
    try {
      return charge(amount, card);
    } catch (error) {
      logger.error(error);
      return null;
    }
  }
  return null;
}
`;

const complexity = estimateComplexity(code);
// Resultado: 0.5 (5 decision points: if, &&, try, catch, return)
```

### `estimateChangeFrequency(commits: number, totalFiles: number): number`

Calcula frequência de mudanças relativa.

**Exemplo:**
```typescript
import { estimateChangeFrequency } from './utils/risk-calculator.js';

const freq = estimateChangeFrequency(25, 100);
// Resultado: 0.25 (25%)
```

### `isUserFacing(filePath: string): boolean`

Detecta se arquivo é interface do usuário.

**Exemplo:**
```typescript
import { isUserFacing } from './utils/risk-calculator.js';

isUserFacing('src/components/LoginForm.tsx');  // true
isUserFacing('src/pages/checkout.vue');        // true
isUserFacing('src/utils/db-helper.ts');        // false
```

## Integração com Test Plans

O sistema de risk scores está integrado automaticamente ao `generatePlan()`:

```typescript
import { generatePlan } from './tools/plan.js';

const plan = await generatePlan({
  repo: '/path/to/repo',
  product: 'MyApp',
  base_url: 'https://api.example.com',
  analyze_result: {
    findings: {
      routes: [...],
      endpoints: [...],
      risk_map: [
        { area: '/api/checkout', risk: 'high', rationale: 'Payment processing' },
        { area: '/api/login', risk: 'high', rationale: 'Authentication' },
        { area: '/api/products', risk: 'med', rationale: 'Product listing' }
      ]
    }
  }
});
```

O plano gerado incluirá automaticamente:

1. **Seção "Risk Score Analysis"** com endpoints ordenados por criticidade
2. **TODOs automáticos** baseados em análise do repositório
3. **Quality Gates** com thresholds configuráveis

## Casos de Uso

### 1. Priorizar Testes em Sprint Planning

```typescript
import { calculateRiskScores, groupByRiskLevel } from './utils/risk-calculator.js';

// Calcular scores para todos os endpoints
const endpoints = analyzeResult.findings.risk_map.map(risk => ({
  filePath: risk.area,
  changeFrequency: getCommitsForFile(risk.area) / 30,
  recentBugs: getBugsForFile(risk.area).length,
  complexity: 0.5,
  testCoverage: getCoverageForFile(risk.area),
  isCriticalFlow: risk.risk === 'high',
  isUserFacing: true
}));

const scores = calculateRiskScores(endpoints);
const grouped = groupByRiskLevel(scores);

// Priorizar CRITICAL e HIGH primeiro
console.log(`Testes para o Sprint:`);
grouped['CRITICAL']?.forEach(s => console.log(`  - ${s.file} (score: ${s.score})`));
grouped['HIGH']?.forEach(s => console.log(`  - ${s.file} (score: ${s.score})`));
```

### 2. Identificar Gaps de Cobertura

```typescript
import { calculateRiskScore } from './utils/risk-calculator.js';

const highRiskLowCoverage = endpoints
  .map(calculateRiskScore)
  .filter(s => s.level === 'CRITICAL' || s.level === 'HIGH')
  .filter(s => s.impact > 80); // Impact alto = baixa cobertura

console.log(`⚠️ Endpoints críticos sem testes adequados:`);
highRiskLowCoverage.forEach(s => {
  console.log(`  - ${s.file}: ${s.score.toFixed(1)} (coverage: ${(1 - s.impact/100) * 100}%)`);
});
```

### 3. Gerar Relatórios de Risco

```typescript
import { calculateRiskScores, groupByRiskLevel } from './utils/risk-calculator.js';
import { writeFile } from 'fs/promises';

const scores = calculateRiskScores(allEndpoints);
const grouped = groupByRiskLevel(scores);

const report = `
# Risk Assessment Report

## Critical Risks (${grouped['CRITICAL']?.length || 0})
${grouped['CRITICAL']?.map(s => `- ${s.file}: ${s.score.toFixed(1)}`).join('\n')}

## High Risks (${grouped['HIGH']?.length || 0})
${grouped['HIGH']?.map(s => `- ${s.file}: ${s.score.toFixed(1)}`).join('\n')}

## Recommendations
1. Prioritize CRITICAL endpoints for immediate testing
2. Increase test coverage for HIGH risk files
3. Monitor MEDIUM risk files for regression
`;

await writeFile('tests/analyses/RISK-REPORT.md', report);
```

## Personalização

### Ajustar Pesos dos Fatores

Para ajustar os pesos, modifique as funções em `src/utils/risk-calculator.ts`:

```typescript
// Exemplo: dar mais peso para bugs recentes
export function calculateProbability(factors: RiskFactors): number {
  const changeFreq = factors.changeFrequency * 30;  // era 40
  const bugs = factors.recentBugs * 50;              // era 35, agora 50
  const complexity = factors.complexity * 20;        // era 25
  return Math.min(100, changeFreq + bugs + complexity);
}
```

### Adicionar Novos Fatores

Estenda a interface `RiskFactors`:

```typescript
export interface RiskFactors {
  // ... existing factors
  securityIssues?: number;  // Novo fator
  performanceScore?: number; // Novo fator
}

export function calculateProbability(factors: RiskFactors): number {
  const base = /* cálculo original */;
  const security = (factors.securityIssues || 0) * 10;
  return Math.min(100, base + security);
}
```

## Melhores Práticas

1. **Colete dados reais**: Use Git commits, bug trackers, coverage reports
2. **Revise regularmente**: Risk scores mudam com o tempo, recalcule mensalmente
3. **Combine com análise manual**: O score é uma ferramenta, não uma decisão final
4. **Documente decisões**: Registre por que certos endpoints são críticos
5. **Automatize**: Integre no CI/CD para alertas automáticos

## Roadmap

- [ ] Integração com Git para `changeFrequency` automático
- [ ] Integração com Jira/GitHub Issues para `recentBugs`
- [ ] Análise de complexidade real via AST parsing
- [ ] Dashboard visual de risk scores
- [ ] Alertas automáticos via Slack/Teams
- [ ] Machine Learning para predição de falhas

## Referências

- [OWASP Risk Rating Methodology](https://owasp.org/www-community/OWASP_Risk_Rating_Methodology)
- [Google Testing Blog: Test Prioritization](https://testing.googleblog.com/)
- [Microsoft SDL: Risk Assessment](https://www.microsoft.com/en-us/securityengineering/sdl/)
