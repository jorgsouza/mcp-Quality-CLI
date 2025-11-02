# Plano DEIXE-ME-ÓTIMO 🚀

**Objetivo**: Transformar o MCP Quality CLI em uma ferramenta 100% automática onde **um único comando** gera **tudo organizado em `qa/<product>/`**.

## 📋 Índice
- [Problema Atual](#problema-atual)
- [Visão do Estado Final](#visão-do-estado-final)
- [Plano de Implementação](#plano-de-implementação)
- [Cronograma](#cronograma)
- [Critérios de Sucesso](#critérios-de-sucesso)

---

## 🔴 Problema Atual

### Gargalo Principal: Inconsistência de Diretórios

#### 1. **Saídas Espalhadas**
```
repo/
├── tests/analyses/          ← Algumas tools escrevem aqui (plan.ts, pyramid-report.ts)
├── qa/<product>/
│   └── tests/
│       ├── analyses/        ← Outras escrevem aqui (init-product.ts)
│       ├── unit/
│       └── integration/
```

**Resultado**: Artefatos ficam em 2 lugares diferentes, usuário não sabe onde procurar.

#### 2. **auto.ts Não Impõe OUTPUT_ROOT Único**
- Resolve caminhos caso a caso (às vezes `mcp-settings`, às vezes valores padrão)
- Nem sempre encaminha `in_dir`/`out_dir` para dentro de `qa/<product>`
- Cada tool decide seu próprio caminho de saída

#### 3. **Relatório Final Depende de Parâmetros Cliente**
- Se `in_dir` não for passado, usa caminhos "padrão" fora de `qa/<product>`
- Cliente precisa saber estrutura interna para pedir relatórios corretos

### Impacto
❌ "Não sinto a mágica de rodar tudo e no final sair a pasta qa toda organizada"

---

## 🎯 Visão do Estado Final

### Comando Único
```bash
# CLI
quality auto --repo . --product mcp-Quality-CLI --mode full

# MCP (via Cursor/Continue/Cline)
quality.auto { 
  repo: ".", 
  product: "mcp-Quality-CLI", 
  mode: "full" 
}
```

### Estrutura 100% Previsível
```
qa/
└── mcp-Quality-CLI/
    ├── tests/
    │   ├── analyses/              ← Dados brutos JSON
    │   │   ├── analyze.json
    │   │   ├── coverage-analysis.json
    │   │   ├── risk-map.json
    │   │   └── TEST-QUALITY-LOGICAL.json
    │   ├── reports/               ← Relatórios legíveis
    │   │   ├── QUALITY-REPORT.md
    │   │   ├── PLAN.md
    │   │   ├── PYRAMID.md
    │   │   ├── PYRAMID.html
    │   │   ├── DIFF-COVERAGE.md
    │   │   └── playwright/
    │   │       ├── results.json
    │   │       └── html-report/
    │   ├── unit/
    │   ├── integration/
    │   └── e2e/
    ├── dashboards/
    │   └── dashboard.html
    └── fixtures/
        └── auth/
            └── storageState.json
```

### Resposta Estruturada
```json
{
  "ok": true,
  "outputs": {
    "root": "qa/mcp-Quality-CLI",
    "reports": [
      "tests/reports/QUALITY-REPORT.md",
      "tests/reports/PLAN.md",
      "tests/reports/PYRAMID.html"
    ],
    "analyses": [
      "tests/analyses/analyze.json",
      "tests/analyses/coverage-analysis.json"
    ],
    "dashboard": "dashboards/dashboard.html"
  }
}
```

---

## 🛠 Plano de Implementação

### **FASE 1: Fundação - Paths Centralizados** (Est: 2-3h)

#### 1.1. Schema de Configuração
**Arquivo**: `src/utils/config.ts`

Adicionar ao `MCPSettingsSchema`:
```typescript
export const MCPSettingsSchema = z.object({
  // ... campos existentes
  paths: z.object({
    output_root: z.string().optional().describe('Diretório raiz para todas as saídas (padrão: qa/<product>)')
  }).optional()
});
```

#### 1.2. Helper Central de Paths
**Arquivo**: `src/utils/paths.ts` (NOVO)

```typescript
import { join } from 'path';
import type { MCPSettings } from './config.js';

export interface QAPaths {
  /** Raiz: qa/<product> */
  root: string;
  /** Análises brutas: qa/<product>/tests/analyses */
  analyses: string;
  /** Relatórios: qa/<product>/tests/reports */
  reports: string;
  /** Tests unitários: qa/<product>/tests/unit */
  unit: string;
  /** Tests integração: qa/<product>/tests/integration */
  integration: string;
  /** Tests E2E: qa/<product>/tests/e2e */
  e2e: string;
  /** Fixtures: qa/<product>/fixtures */
  fixtures: string;
  /** Dashboards: qa/<product>/dashboards */
  dashboards: string;
}

/**
 * Calcula paths padronizados para qa/<product>
 * @param repo - Caminho do repositório
 * @param product - Nome do produto
 * @param settings - Configurações MCP (opcional)
 * @returns Objeto com todos os paths necessários
 */
export function getPaths(
  repo: string,
  product: string,
  settings?: MCPSettings
): QAPaths {
  // Permite override via settings, fallback para qa/<product>
  const root = settings?.paths?.output_root 
    ? join(repo, settings.paths.output_root)
    : join(repo, 'qa', product);

  return {
    root,
    analyses: join(root, 'tests', 'analyses'),
    reports: join(root, 'tests', 'reports'),
    unit: join(root, 'tests', 'unit'),
    integration: join(root, 'tests', 'integration'),
    e2e: join(root, 'tests', 'e2e'),
    fixtures: join(root, 'fixtures'),
    dashboards: join(root, 'dashboards')
  };
}

/**
 * Garante que todos os diretórios existem
 */
export async function ensurePaths(paths: QAPaths): Promise<void> {
  const fs = await import('fs/promises');
  
  for (const [key, path] of Object.entries(paths)) {
    if (key !== 'root') {
      await fs.mkdir(path, { recursive: true });
    }
  }
}
```

#### 1.3. Adicionar Testes
**Arquivo**: `src/utils/__tests__/paths.test.ts` (NOVO)

```typescript
import { describe, it, expect } from 'vitest';
import { getPaths } from '../paths.js';

describe('getPaths', () => {
  it('deve usar qa/<product> como padrão', () => {
    const paths = getPaths('/repo', 'my-app');
    expect(paths.root).toBe('/repo/qa/my-app');
    expect(paths.analyses).toBe('/repo/qa/my-app/tests/analyses');
  });

  it('deve respeitar output_root do settings', () => {
    const settings = { paths: { output_root: 'custom/output' } };
    const paths = getPaths('/repo', 'my-app', settings);
    expect(paths.root).toBe('/repo/custom/output');
  });
});
```

---

### **FASE 2: Refatoração das Tools** (Est: 4-6h)

#### 2.1. Analyze Tool
**Arquivo**: `src/tools/analyze.ts`

**ANTES**:
```typescript
const outFile = options.out_file || join(repo, 'tests/analyses/analyze.json');
```

**DEPOIS**:
```typescript
import { getPaths } from '../utils/paths.js';

async function analyze(options: AnalyzeOptions): Promise<AnalyzeResult> {
  const { repo, product } = options;
  const settings = await loadSettings(repo);
  const paths = getPaths(repo, product, settings);
  
  const outFile = options.out_file || join(paths.analyses, 'analyze.json');
  // ... resto do código
}
```

#### 2.2. Tools a Refatorar (mesma lógica)
- ✅ `src/tools/analyze.ts` → `paths.analyses/analyze.json`
- ✅ `src/tools/run-coverage.ts` → `paths.analyses/coverage-analysis.json`
- ✅ `src/tools/analyze-test-logic.ts` → `paths.analyses/TEST-QUALITY-LOGICAL.json`
- ✅ `src/tools/plan.ts` → `paths.reports/PLAN.md`
- ✅ `src/tools/pyramid-report.ts` → `paths.reports/PYRAMID.{md,html,json}`
- ✅ `src/tools/dashboard.ts` → `paths.dashboards/dashboard.html`
- ✅ `src/tools/report.ts` → `paths.reports/QUALITY-REPORT.md`
- ✅ `src/tools/run-diff-coverage.ts` → `paths.reports/DIFF-COVERAGE.md`
- ✅ `src/tools/scaffold-*.ts` → `paths.unit|integration|e2e`

#### 2.3. Padrão de Migração
Para cada tool:
1. Adicionar `import { getPaths } from '../utils/paths.js'`
2. Calcular `const paths = getPaths(repo, product, settings)`
3. Substituir hardcoded `join(repo, 'tests/...')` por `paths.analyses|reports|dashboards`
4. Atualizar testes para mockear `getPaths()`

---

### **FASE 3: Auto.ts como Orquestrador Central** (Est: 3-4h)

#### 3.1. Garantir Estrutura no Início
**Arquivo**: `src/tools/auto.ts`

```typescript
import { getPaths, ensurePaths } from '../utils/paths.js';

export async function auto(options: AutoOptions): Promise<AutoResult> {
  const { repo, product, mode = 'full' } = options;
  
  // [NOVO] Calcular paths UMA VEZ
  const settings = await loadSettings(repo);
  const paths = getPaths(repo, product, settings);
  
  // [NOVO] Garantir que qa/<product> existe
  await ensurePaths(paths);
  
  // [NOVO] Se qa/<product>/tests não tiver estrutura, inicializar
  const hasStructure = await fs.access(join(paths.root, 'mcp-settings.json'))
    .then(() => true)
    .catch(() => false);
  
  if (!hasStructure) {
    console.log('🏗️  [0/11] Inicializando estrutura qa/<product>...');
    await initProduct({ repo, product });
  }
  
  // Continua com steps...
}
```

#### 3.2. Passar Paths para TODAS as Tools
```typescript
// Step 1: Analyze
const analyzeResult = await analyze({
  repo,
  product,
  out_file: join(paths.analyses, 'analyze.json'), // ← Forçar path
  ...options
});

// Step 2: Coverage
const coverageResult = await runCoverage({
  repo,
  product,
  out_file: join(paths.analyses, 'coverage-analysis.json'), // ← Forçar path
  ...options
});

// Step 2.5: Test Logic
const logicResult = await analyzeTestLogic({
  repo,
  product,
  out_file: join(paths.analyses, 'TEST-QUALITY-LOGICAL.json'), // ← Forçar path
  runMutation: false,
  generatePatches: true
});

// Step 4: Plan
const planResult = await plan({
  repo,
  product,
  in_dir: paths.analyses, // ← Forçar input
  out_file: join(paths.reports, 'PLAN.md') // ← Forçar output
});

// Step 7: Pyramid
const pyramidResult = await pyramidReport({
  repo,
  product,
  in_dir: paths.analyses,
  out_dir: paths.reports, // ← PYRAMID.md, PYRAMID.html
  format: ['md', 'html', 'json']
});

// Step 8: Dashboard
const dashboardResult = await dashboard({
  repo,
  product,
  in_dir: paths.analyses,
  out_file: join(paths.dashboards, 'dashboard.html')
});

// Step 10: Report
const reportResult = await buildReport({
  in_dir: paths.analyses,
  out_file: join(paths.reports, 'QUALITY-REPORT.md'),
  format: 'markdown'
});
```

#### 3.3. Retornar Índice Estruturado
```typescript
return {
  ok: true,
  outputs: {
    root: paths.root,
    reports: [
      'tests/reports/QUALITY-REPORT.md',
      'tests/reports/PLAN.md',
      'tests/reports/PYRAMID.md',
      'tests/reports/PYRAMID.html',
      ...(diffCoverageRan ? ['tests/reports/DIFF-COVERAGE.md'] : [])
    ],
    analyses: [
      'tests/analyses/analyze.json',
      'tests/analyses/coverage-analysis.json',
      'tests/analyses/TEST-QUALITY-LOGICAL.json',
      ...(riskMapExists ? ['tests/analyses/risk-map.json'] : [])
    ],
    dashboard: 'dashboards/dashboard.html',
    tests: {
      unit: 'tests/unit',
      integration: 'tests/integration',
      e2e: 'tests/e2e'
    }
  },
  steps: steps,
  duration: Date.now() - startTime
};
```

---

### **FASE 4: Self-Check Robusto** (Est: 2-3h)

#### 4.1. Validações Adicionais
**Arquivo**: `src/tools/self-check.ts`

Adicionar checks:
```typescript
export async function selfCheck(options: SelfCheckOptions): Promise<SelfCheckResult> {
  const issues: string[] = [];
  
  // [NOVO] Check 1: Playwright instalado
  const hasPlaywright = await checkCommand('npx playwright --version');
  if (!hasPlaywright) {
    issues.push('❌ Playwright não encontrado. Rode: npm i -D @playwright/test && npx playwright install');
  }
  
  // [NOVO] Check 2: Browsers instalados
  const hasBrowsers = await checkPlaywrightBrowsers();
  if (!hasBrowsers) {
    issues.push('❌ Browsers não instalados. Rode: npx playwright install');
  }
  
  // [NOVO] Check 3: Permissões de escrita em qa/<product>
  const paths = getPaths(repo, product);
  const canWrite = await checkWritePermission(paths.root);
  if (!canWrite) {
    issues.push(`❌ Sem permissão de escrita em ${paths.root}`);
  }
  
  // [NOVO] Check 4: Node/npm versions
  const nodeVersion = await getNodeVersion();
  if (nodeVersion < 18) {
    issues.push(`⚠️  Node ${nodeVersion} < 18. Recomendado: Node 18+`);
  }
  
  // Gerar relatório se houver issues
  if (issues.length > 0) {
    const reportPath = join(paths.reports, 'SELF-CHECK.md');
    await fs.writeFile(reportPath, generateSelfCheckReport(issues));
    console.log(`📋 Relatório de self-check salvo em: ${reportPath}`);
  }
  
  return { ok: issues.length === 0, issues };
}
```

---

### **FASE 5: Organização de Saídas por Categoria** (Est: 1-2h)

#### 5.1. Nomenclatura Padronizada

| Categoria | Diretório | Arquivos |
|-----------|-----------|----------|
| **Análises Brutas** | `tests/analyses/` | `analyze.json`, `coverage-analysis.json`, `risk-map.json`, `TEST-QUALITY-LOGICAL.json` |
| **Relatórios Legíveis** | `tests/reports/` | `QUALITY-REPORT.md`, `PLAN.md`, `PYRAMID.md`, `PYRAMID.html`, `DIFF-COVERAGE.md` |
| **Relatórios Playwright** | `tests/reports/playwright/` | `results.json`, `html-report/`, `trace.zip` |
| **Dashboards Interativos** | `dashboards/` | `dashboard.html` |
| **Fixtures de Teste** | `fixtures/` | `auth/storageState.json`, `mocks/*.json` |

#### 5.2. Playwright Reports
**Arquivo**: `playwright.config.ts` (gerado por init-product)

```typescript
export default defineConfig({
  reporter: [
    ['html', { outputFolder: 'qa/<product>/tests/reports/playwright/html-report' }],
    ['json', { outputFile: 'qa/<product>/tests/reports/playwright/results.json' }]
  ],
  use: {
    trace: 'on-first-retry',
    // Salvar traces em qa/<product>/tests/reports/playwright/
  }
});
```

---

### **FASE 6: Contrato MCP Simplificado** (Est: 1h)

#### 6.1. Tool Manifest
**Arquivo**: Atualizar schema do MCP Server

```typescript
{
  name: "auto",
  description: "Executa pipeline completo de qualidade e organiza TUDO em qa/<product>",
  inputSchema: {
    type: "object",
    properties: {
      repo: { 
        type: "string", 
        description: "Caminho do repositório" 
      },
      product: { 
        type: "string", 
        description: "Nome do produto (ex: mcp-Quality-CLI)" 
      },
      mode: { 
        enum: ["full", "analyze", "plan", "scaffold", "run"],
        default: "full",
        description: "Modo de execução (full = todas as etapas)"
      }
    },
    required: ["repo", "product"]
  },
  outputSchema: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      outputs: {
        type: "object",
        properties: {
          root: { type: "string" },
          reports: { type: "array", items: { type: "string" } },
          analyses: { type: "array", items: { type: "string" } },
          dashboard: { type: "string" }
        }
      }
    }
  }
}
```

---

## 📅 Cronograma

### Sprint 1 (Est: 1 semana)
- ✅ **Dia 1-2**: Fase 1 - Criar `utils/paths.ts` e schema
- ✅ **Dia 3-4**: Fase 2 - Refatorar 5 tools principais (analyze, coverage, plan, pyramid, dashboard)
- ✅ **Dia 5**: Fase 3 - Reforçar auto.ts com getPaths()

### Sprint 2 (Est: 3-4 dias)
- ✅ **Dia 1**: Fase 2 cont. - Refatorar tools restantes (scaffold, report, diff-coverage)
- ✅ **Dia 2**: Fase 4 - Melhorar self-check
- ✅ **Dia 3**: Fase 5 - Ajustar nomenclatura e Playwright
- ✅ **Dia 4**: Fase 6 - Atualizar MCP manifest + testes E2E

### Sprint 3 (Est: 2 dias)
- ✅ **Dia 1**: Documentação (README, QUICKSTART, exemplos)
- ✅ **Dia 2**: Dogfooding (rodar em mcp-Quality-CLI e corrigir issues)

---

## ✅ Critérios de Sucesso

### Must Have (Bloqueadores)
- [ ] **Comando único**: `quality auto --mode full` gera tudo em `qa/<product>/`
- [ ] **Zero configuração manual**: Nenhum `in_dir`/`out_dir` precisa ser passado
- [ ] **Estrutura previsível**: Sempre `analyses/`, `reports/`, `dashboards/`
- [ ] **Retorno estruturado**: JSON com índice de todos os arquivos gerados
- [ ] **Todos os testes passando**: 575+ testes verdes após refatoração

### Should Have (Importantes)
- [ ] **Self-check robusto**: Detecta Playwright, Node, permissões
- [ ] **Relatório de erros**: `SELF-CHECK.md` quando algo falhar
- [ ] **Playwright integrado**: Traces/reports dentro de `qa/<product>/`
- [ ] **Documentação atualizada**: README com novo fluxo

### Could Have (Desejáveis)
- [ ] **Dashboard mostra paths**: Links clicáveis para relatórios
- [ ] **CI/CD example**: `.github/workflows/quality.yml` usando novo fluxo
- [ ] **Migration script**: Converte estrutura antiga para nova

---

## 🚦 Validação Final

### Teste de Aceitação
```bash
# 1. Limpar tudo
rm -rf qa tests/analyses tests/reports

# 2. Rodar comando único
quality auto --repo . --product mcp-Quality-CLI --mode full

# 3. Validar estrutura
tree qa/mcp-Quality-CLI/
# Deve mostrar:
# qa/mcp-Quality-CLI/
# ├── tests/
# │   ├── analyses/ (4+ arquivos JSON)
# │   ├── reports/ (5+ arquivos MD/HTML)
# │   ├── unit/
# │   ├── integration/
# │   └── e2e/
# ├── dashboards/
# │   └── dashboard.html
# └── fixtures/

# 4. Verificar retorno
# JSON com outputs.root, outputs.reports[], outputs.analyses[]

# 5. Abrir dashboard
open qa/mcp-Quality-CLI/dashboards/dashboard.html
# Deve mostrar métricas completas
```

### Critério de Aprovação
✅ **"Rodei um comando, abri o dashboard, vi tudo organizado em qa/<product>. MÁGICO!"**

---

## 📚 Referências

- **Análise Original**: Feedback do usuário sobre inconsistência de paths
- **Schema MCPSettings**: `src/utils/config.ts` (MCPSettingsSchema)
- **Init Product**: `src/tools/init-product.ts` (estrutura de pastas)
- **Auto Orchestrator**: `src/tools/auto.ts` (pipeline principal)

---

## 🔄 Próximos Passos Imediatos

1. **Criar branch**: `git checkout -b feature/deixe-me-otimo`
2. **Implementar Fase 1**: `src/utils/paths.ts` + testes
3. **Validar build**: `npm run build && npm test`
4. **Commit incremental**: Commitar cada fase separadamente
5. **Dogfooding contínuo**: Rodar em mcp-Quality-CLI a cada fase

---

**Status**: 📝 PLANEJADO  
**Prioridade**: 🔥 ALTA (resolve gargalo principal)  
**Esforço Estimado**: 2 semanas (Sprint 1-3)  
**ROI**: ⭐⭐⭐⭐⭐ (experiência de uso transformada)
