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

### **✅ FASE 1: Fundação - Paths Centralizados** (CONCLUÍDA - Commit: 3e85952)

**Status**: ✅ COMPLETA  
**Duração**: 2h  
**Commit**: `3e85952` - "feat(paths): FASE 1 - infraestrutura de paths centralizados"

#### 1.1. ✅ Schema de Configuração
**Arquivo**: `src/utils/config.ts`

~~Adicionar~~ **ADICIONADO** ao `MCPSettingsSchema`:
```typescript
export const MCPSettingsSchema = z.object({
  // ... campos existentes
  paths: z.object({
    output_root: z.string().optional().describe('Diretório raiz para todas as saídas (padrão: qa/<product>)')
  }).optional()
});
```

#### 1.2. ✅ Helper Central de Paths
**Arquivo**: `src/utils/paths.ts` ~~(NOVO)~~ **CRIADO**

**Implementado com**:
- Interface `QAPaths` com 11 paths padronizados
- 5 funções core: `getPaths()`, `ensurePaths()`, `isWithinQARoot()`, `getOutputPath()`, `getRelativePath()`
- Documentação JSDoc completa
- Type-safe e cross-platform (Windows/Unix)

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

#### 1.3. ✅ Adicionar Testes
**Arquivo**: `src/utils/__tests__/paths.test.ts` ~~(NOVO)~~ **CRIADO**

**Implementado**:
- 26 testes cobrindo todas as funções
- Edge cases: espaços, caracteres especiais, Windows/Unix paths
- Testes de idempotência e validação
- 100% dos testes passando (601/601 total)

---

### **FASE 2: Refatoração das Tools** ✅ CONCLUÍDA (6h)

**Commits**: `144006a`, `4bdc5e7`, `3c189bc`, `520e2fa` (2025-11-02)  
**Status**: 601/601 testes passando ✅  
**Tools Refatoradas**: 12/12 (100%)

#### 2.1. Tools Refatoradas (12/12 = 100% COMPLETO!)
- ✅ `analyze.ts` → `paths.analyses/analyze.json`
- ✅ `coverage.ts` → `paths.analyses/coverage-analysis.json` + `paths.reports/COVERAGE-REPORT.md`
- ✅ `plan.ts` → lê `paths.analyses`, escreve `paths.reports/PLAN.md`
- ✅ `pyramid-report.ts` → lê `paths.analyses`, escreve `paths.reports/PYRAMID-REPORT.*`
- ✅ `dashboard.ts` → lê `paths.analyses`, escreve `paths.dashboards/dashboard.html`
- ✅ `run-coverage.ts` → `paths.reports/COVERAGE-ANALYSIS.md` (+ breaking change: requer `product`)
- ✅ `scaffold-integration.ts` → `paths.integration` + `paths.reports/INTEGRATION-TESTING-GUIDE.md`
- ✅ `auto.ts` → calcula `getPaths()` uma vez, usa `paths.analyses` em buildReport
- ✅ `analyze-test-logic.ts` → `paths.patches`, `paths.reports`, `paths.analyses`
- ✅ `run-diff-coverage.ts` → `paths.reports/DIFF-COVERAGE-REPORT.md`
- ✅ `catalog.ts` → `paths.analyses/scenario-catalog.json`, `paths.reports/{SCENARIO-CATALOG.md, RESPONSIBILITY-MATRIX.md}`
- ✅ `scaffold-unit.ts` → `paths.reports/UNIT-TESTING-GUIDE.md`

#### 2.2. Mudanças Estruturais
- **RunCoverageParams**: Adicionado campo obrigatório `product: string`
- **loadAnalysisData**: Mudou de `(repoPath: string, product?: string)` para `(paths: QAPaths)`
- **ensurePaths()**: Todas as tools agora chamam após `getPaths()` para garantir diretórios
- **Estrutura de testes**: Movida de `tests/` para `qa/mcp-Quality-CLI/tests/`

#### 2.3. Arquivos Modificados
- 6 tools refatoradas
- 5 arquivos de teste atualizados (fixtures para qa/<product>)
- 9 testes de integração/e2e movidos e imports corrigidos
- `.gitignore` atualizado para nova estrutura

#### 2.4. Breaking Changes
- `RunCoverageParams` agora requer campo `product`
- Outputs movidos: `tests/analyses` → `qa/<product>/tests/analyses`
- Nome de arquivo: `PLAN.md` (não `TEST-PLAN.md`)

---

### **FASE 3: Auto.ts como Orquestrador Central** ✅ CONCLUÍDA (1h)

**Commit**: `e9b004c` (2025-11-02)  
**Status**: 601/601 testes passando ✅

#### 3.1. ✅ Auto-Inicialização de Estrutura
**Arquivo**: `src/tools/auto.ts`

**Implementado**:
- Auto.ts verifica existência de `qa/<product>/mcp-settings.json`
- Se não existir, chama `initProduct()` automaticamente
- Defaults sensatos: `base_url: 'http://localhost:3000'`
- Adiciona step 'init-product' ao resultado
- Validação de repositório inválido com erro claro

```typescript
// [FASE 3] Auto-inicializar estrutura qa/<product> se não existir
const mcpSettingsPath = join(paths.root, 'mcp-settings.json');
const hasStructure = await fileExists(mcpSettingsPath);

if (!hasStructure) {
  const repoExists = await fileExists(repoPath);
  if (!repoExists) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }
  
  console.log(`🏗️  [0/11] Inicializando estrutura qa/${product}...`);
  await initProduct({ 
    repo: repoPath, 
    product,
    base_url: 'http://localhost:3000',
    domains: [],
    critical_flows: []
  });
  steps.push('init-product');
}
```

#### 3.2. ✅ Zero Configuração Manual
```bash
# Antes (FASE 2): Usuário tinha que rodar init-product primeiro
quality init-product --repo . --product MyApp --base-url http://localhost:3000
quality auto --repo . --product MyApp --mode full

# Agora (FASE 3): Um único comando faz TUDO
quality auto --repo . --product MyApp --mode full
# ✅ Detecta que qa/MyApp não existe
# ✅ Cria estrutura completa automaticamente  
# ✅ Roda análise completa
# ✅ Gera todos os relatórios em qa/MyApp/
```

---

### **FASE 3: Auto.ts como Orquestrador Central** (Est: 3-4h) [PLANEJAMENTO ORIGINAL]

#### 3.1. Garantir Estrutura no Início [JÁ IMPLEMENTADO ✅]
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
- ✅ **Dia 1-2**: Fase 1 - Criar `utils/paths.ts` e schema (**CONCLUÍDA** - 2h, Commit: 3e85952)
- 🔄 **Dia 3-4**: Fase 2 - Refatorar 5 tools principais (analyze, coverage, plan, pyramid, dashboard) - **EM ANDAMENTO**
- ⏳ **Dia 5**: Fase 3 - Reforçar auto.ts com getPaths()

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
