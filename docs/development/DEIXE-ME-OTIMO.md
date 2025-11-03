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

**Commits**: `e9b004c`, `a4813ed`, `fdf2dff` (2025-11-02)  
**Status**: 601/601 testes passando ✅  
**CRÍTICO**: Fix do MCP Server forçando qa/<product>/

#### 3.1. ✅ Auto-Inicialização de Estrutura
**Arquivo**: `src/tools/auto.ts`

**Implementado**:
- Auto.ts verifica existência de `qa/<product>/mcp-settings.json`
- Se não existir, chama `initProduct()` automaticamente
- Defaults sensatos: `base_url: 'http://localhost:3000'`
- Adiciona step 'init-product' ao resultado
- Validação de repositório inválido com erro claro

#### 3.2. ✅ MCP Server Forçando Paths Corretos (CRÍTICO - fdf2dff)
**Arquivos**: `src/server.ts`, `src/mcp-tools.manifest.ts`

**PROBLEMA DESCOBERTO**:
- Usuário rodou MCP em projeto Python (spotifyCli)
- Copilot passou paths absolutos: `outFile: "/Volumes/Dev/spotifyCli/QUALITY_REPORT.md"`
- MCP Server ACEITAVA qualquer path → arquivos criados FORA de qa/<product>/
- Estrutura quebrada, relatórios na raiz

**SOLUÇÃO IMPLEMENTADA**:
```typescript
// src/server.ts
import { getPaths, ensurePaths } from './utils/paths.js';
import { loadMCPSettings } from './utils/config.js';

case 'report': {
  // FORÇAR paths em qa/<product>/ - ignorar args.inDir/outFile
  if (!args.repo || !args.product) {
    throw new Error('report requer repo e product');
  }
  
  const settings = await loadMCPSettings(args.repo, args.product).catch(() => undefined);
  const paths = getPaths(args.repo, args.product, settings || undefined);
  await ensurePaths(paths);
  
  result = await buildReport({
    repo: args.repo,
    product: args.product,
    in_dir: paths.analyses,  // ← FORÇADO (ignora args.inDir)
    out_file: `${paths.reports}/QUALITY-REPORT.md`, // ← FORÇADO (ignora args.outFile)
    thresholds: { ... }
  });
}
```

**RESULTADO**:
- ✅ Copilot pode passar QUALQUER path → MCP SOBRESCREVE para qa/<product>/
- ✅ 100% dos relatórios em `qa/<product>/tests/reports/`
- ✅ 100% das análises em `qa/<product>/tests/analyses/`
- ✅ Estrutura previsível em QUALQUER projeto (Python, Node, Go, etc.)

#### 3.3. ✅ Zero Configuração Manual
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
# ✅ MCP Server FORÇA paths corretos (ignora paths do Copilot)
```

#### 3.4. ✅ Validação Real (Projeto Python)
**Cenário**: Usuário rodou MCP em `/Volumes/Dev/spotifyCli` (projeto Python)

**Antes do fix**:
```
/Volumes/Dev/spotifyCli/
├── QUALITY_REPORT.md  ← ❌ Criado na raiz (errado)
├── tests/analyses/     ← ❌ Recriado (estrutura antiga)
└── qa/spotifyCli/      ← Estrutura vazia
```

**Depois do fix** (fdf2dff):
```
/Volumes/Dev/spotifyCli/
└── qa/spotifyCli/
    ├── tests/
    │   ├── analyses/  ← ✅ JSON data aqui
    │   └── reports/
    │       └── QUALITY-REPORT.md  ← ✅ Relatório aqui
    ├── dashboards/
    └── fixtures/
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

### **FASE 4: Self-Check Robusto** ✅ CONCLUÍDA (2h)

**Commit**: `[próximo]` (2025-11-03)  
**Status**: 621/621 testes passando ✅  
**Implementação**: Validações robustas + relatório automático

#### 4.1. ✅ Validações Adicionadas

**Implementado em**: `src/tools/self-check.ts`

**Novas verificações**:
- ✅ **npm version**: Verifica npm >= 8, sugere `npm install -g npm@latest`
- ✅ **Playwright**: Detecta `@playwright/test` no package.json
- ✅ **Playwright Browsers**: Verifica se `npx playwright --version` funciona
- ✅ **Permissões em qa/<product>/**: Valida escrita em qa/<product>/ se product fornecido
- ✅ **Relatório SELF-CHECK.md**: Gerado automaticamente em `qa/<product>/tests/reports/`

#### 4.2. ✅ Estrutura do Relatório

**Arquivo**: `qa/<product>/tests/reports/SELF-CHECK.md`

**Conteúdo**:
```markdown
# Self-Check Report 🔍

**Gerado em**: 2025-11-03T18:30:00.000Z
**Produto**: mcp-Quality-CLI
**Repositório**: /Volumes/Dev/mcp-Quality-CLI

## 📊 Resumo

- ✅ **OK**: 7
- ⚠️ **Avisos**: 2
- ❌ **Erros**: 0

## ⚠️ Avisos (2)

### Playwright
**Problema**: Playwright não instalado (opcional para E2E)
**Solução**:
```bash
npm i -D @playwright/test && npx playwright install
```

## ✅ Verificações OK (7)

- **Node.js Version**: v20.11.0 (requerido: >=18)
- **npm Version**: 10.2.4 (requerido: >=8)
- **Permissões de Escrita**: Pode escrever em /Volumes/Dev/mcp-Quality-CLI e qa/mcp-Quality-CLI/
- **Test Runner**: vitest instalado
- **Git**: Git instalado e repositório inicializado
- **Estrutura de Diretórios**: Todos os diretórios necessários existem

---

**Próximos passos**:
1. (Opcional) Corrija os 2 aviso(s) listado(s) acima
2. Rode análise completa: `quality auto --repo . --product mcp-Quality-CLI --mode full`
```

#### 4.3. ✅ Integração com Auto.ts

**Arquivo**: `src/tools/auto.ts`

**Mudança**:
```typescript
const selfCheckResult = await selfCheck({
  repo: repoPath,
  product,  // ← [FASE 4] Passa product para validar qa/<product>/
  fix: false
});
```

**Benefícios**:
- ✅ Valida permissões em `qa/<product>/` antes de rodar análise
- ✅ Gera relatório automático se houver problemas
- ✅ Usuário sabe exatamente o que precisa corrigir

#### 4.4. ✅ Novas Funções

**Implementadas**:
- `checkNpmVersion()`: Valida npm >= 8
- `checkPlaywright(repo)`: Detecta @playwright/test
- `checkPlaywrightBrowsers()`: Verifica browsers instalados
- `checkWritePermissions(repo, product?)`: Valida escrita em qa/<product>/
- `generateSelfCheckReport(repo, product, results)`: Gera SELF-CHECK.md

---

### **FASE 4: Self-Check Robusto** (Est: 2-3h) [PLANEJAMENTO ORIGINAL]

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

### **FASE 5: Organização de Saídas por Categoria** ✅ CONCLUÍDA (FASE 2)

**Commit**: Implementada na FASE 2  
**Status**: ✅ JÁ IMPLEMENTADA NA FASE 2  
**Motivo**: Nomenclatura padronizada foi definida durante refatoração das tools

#### 5.1. ✅ Nomenclatura Padronizada (JÁ IMPLEMENTADA)

**Definida em**: FASE 2 (Commits: 144006a, 4bdc5e7, 3c189bc, 520e2fa)

| Categoria | Diretório | Arquivos |
|-----------|-----------|----------|
| **Análises Brutas** | `tests/analyses/` | `analyze.json`, `coverage-analysis.json`, `risk-map.json`, `TEST-QUALITY-LOGICAL.json` |
| **Relatórios Legíveis** | `tests/reports/` | `QUALITY-REPORT.md`, `PLAN.md`, `PYRAMID.md`, `PYRAMID.html`, `DIFF-COVERAGE.md`, `SELF-CHECK.md` |
| **Dashboards Interativos** | `dashboards/` | `dashboard.html` |
| **Fixtures de Teste** | `fixtures/` | `auth/storageState.json`, `mocks/*.json` |
| **Tests** | `tests/unit/`, `tests/integration/`, `tests/e2e/` | Testes gerados pelos scaffolds |

**Implementado em**:
- `src/utils/paths.ts`: Interface `QAPaths` define todos os diretórios
- 12 tools refatoradas usam `getPaths()` para obter diretórios corretos
- 100% das saídas organizadas em `qa/<product>/`

#### 5.2. ⚠️ Playwright Reports (PENDENTE - Opcional)

**Nota**: Playwright config não é gerado automaticamente pelo fluxo principal.  
O scaffold.ts tem template, mas não é chamado no modo `auto --mode full`.

**Decisão**: MOVER PARA "COULD HAVE"
- Playwright é opcional para E2E
- Usuário pode rodar manualmente `quality scaffold --type e2e` se quiser
- Não bloqueia objetivo principal do plano

---

### **FASE 5: Organização de Saídas por Categoria** (Est: 1-2h) [PLANEJAMENTO ORIGINAL]

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

### **FASE 6: Retorno Estruturado do Auto** ✅ CONCLUÍDA (1h)

**Commit**: `e06a0c6` (2025-11-03)  
**Status**: ✅ COMPLETA - 621/621 testes passando  
**Implementação**: Interface AutoResult com outputs organizados

#### 6.1. ✅ Interface AutoResult

**Arquivo**: `src/tools/auto.ts`

**Implementado**:
```typescript
export interface AutoResult {
  /** Sucesso da operação */
  ok: boolean;
  /** Outputs organizados por categoria */
  outputs: {
    /** Diretório raiz: qa/<product> */
    root: string;
    /** Relatórios legíveis (MD/HTML) */
    reports: string[];
    /** Análises brutas (JSON) */
    analyses: string[];
    /** Dashboard interativo (opcional) */
    dashboard?: string;
    /** Diretórios de testes (opcional) */
    tests?: {
      unit?: string;
      integration?: string;
      e2e?: string;
    };
  };
  /** Steps executados */
  steps: string[];
  /** Tempo de execução em ms */
  duration: number;
  /** Contexto do repositório */
  context: RepoContext;
}
```

**Mudanças de Interface**:
- `success: boolean` → `ok: boolean` (AutoResult)
- `outputs: Record<string, string>` → `outputs: { root, reports[], analyses[], dashboard, tests }`
- Adicionado: `duration: number`
- Mantido: `steps`, `context`

#### 6.2. ✅ Mapeamento de Interfaces

**Arquivo**: `src/tools/nl-command.ts`

**Problema**: `nlCommand()` retorna `NLCommandResult` com `success`, mas `autoQualityRun()` retorna `AutoResult` com `ok`.

**Solução Implementada**:
```typescript
// Line 198: Mapeia AutoResult → NLCommandResult
return {
  success: result.ok,  // ← Mapeia ok para success
  detected_mode: mode,
  extracted_params: extractedParams,
  final_params: finalParams,
  result: result
};
```

#### 6.3. ✅ Correção de Testes

**Arquivos Corrigidos**:

1. **src/tools/__tests__/nl-command.test.ts**:
   - Mock atualizado para retornar `AutoResult` completo
   - Testes usam `result.success` (NLCommandResult)
   - 23/23 testes passando ✅

2. **qa/mcp-Quality-CLI/tests/e2e/nl-command-flow.spec.ts**:
   - Corrigido: `result.ok` → `result.success`
   - 16/16 testes E2E passando ✅

3. **src/utils/__tests__/config.test.ts**:
   - Mantido: `result.success` (Zod safeParse retorna `success`)

**Resultado Final**:
- ✅ 621/621 testes passando (100%)
- ✅ Build limpo (0 erros TypeScript)
- ✅ Todas as interfaces consistentes

#### 6.4. ✅ Benefícios da Estrutura

**Para Clientes MCP**:
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
  },
  "duration": 45230
}
```

**Vantagens**:
- ✅ Paths organizados por categoria (reports vs analyses)
- ✅ Arrays permitem múltiplos arquivos por tipo
- ✅ Cliente pode construir UI com links clicáveis
- ✅ Estrutura previsível para todos os modos (full, analyze, plan, scaffold, run)
- ✅ Tracking de performance com `duration`

---

### **FASE 6: Contrato MCP Simplificado** (Est: 1h) [PLANEJAMENTO ORIGINAL - SUBSTITUÍDO]

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

### ✅ Sprint 1 - COMPLETO (Nov 2, 2025)
- ✅ **Fase 1**: Criar `utils/paths.ts` e schema (2h, Commit: 3e85952)
- ✅ **Fase 2**: Refatorar 12/12 tools (6h, Commits: 144006a, 4bdc5e7, 3c189bc, 520e2fa)
- ✅ **Fase 3**: Auto.ts orquestrador + MCP Server paths forçados (1h, Commits: e9b004c, a4813ed, fdf2dff)

### ✅ Sprint 2 - COMPLETO (Nov 3, 2025)
- ✅ **Fase 4**: Self-check robusto (2h, Commit: 9bfe244)
- ✅ **Fase 5**: Nomenclatura padronizada (já implementada na Fase 2)
- ✅ **Fase 6**: AutoResult com outputs estruturados (1h, Commit: e06a0c6)

### ⏳ Sprint 3 - PENDENTE (Est: 2 dias)
- ⏳ **Dia 1**: Documentação (README, QUICKSTART, exemplos)
- ⏳ **Dia 2**: Dogfooding final + CI/CD examples

---

## ✅ Critérios de Sucesso

### Must Have (Bloqueadores)
- ✅ **Comando único**: `quality auto --mode full` gera tudo em `qa/<product>/`
- ✅ **Zero configuração manual**: Nenhum `in_dir`/`out_dir` precisa ser passado
- ✅ **Estrutura previsível**: Sempre `analyses/`, `reports/`, `dashboards/`
- ✅ **Retorno estruturado**: JSON com índice de todos os arquivos gerados
- ✅ **Todos os testes passando**: 621/621 testes verdes após refatoração

### Should Have (Importantes)
- ✅ **Self-check robusto**: Detecta Playwright, Node, npm, permissões
- ✅ **Relatório de erros**: `SELF-CHECK.md` quando algo falhar
- ⚠️ **Playwright integrado**: Traces/reports dentro de `qa/<product>/` (estrutura pronta, geração manual)
- ⏳ **Documentação atualizada**: README com novo fluxo (PENDENTE)

### Could Have (Desejáveis)
- ⏳ **Dashboard mostra paths**: Links clicáveis para relatórios (estrutura existe, UI pendente)
- ⏳ **CI/CD example**: `.github/workflows/quality.yml` usando novo fluxo
- ⏳ **Migration script**: Converte estrutura antiga para nova

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

### ✅ Fases 1-6: COMPLETAS

**Status Geral**: 🎉 OBJETIVO PRINCIPAL ALCANÇADO!

**Conquistas**:
- ✅ 6/6 Fases implementadas
- ✅ 621/621 testes passando (100%)
- ✅ Build limpo (0 erros TypeScript)
- ✅ Comando único funcional: `quality auto --mode full`
- ✅ Estrutura 100% organizada em `qa/<product>/`
- ✅ Zero configuração manual necessária
- ✅ Retorno estruturado com AutoResult

**Commits**:
- `3e85952` - FASE 1: Paths centralizados
- `144006a`, `4bdc5e7`, `3c189bc`, `520e2fa` - FASE 2: 12 tools refatoradas
- `e9b004c`, `a4813ed`, `fdf2dff` - FASE 3: Auto.ts + MCP Server
- `9bfe244` - FASE 4: Self-check robusto
- `e06a0c6` - FASE 6: AutoResult estruturado

### ⏳ Próximos Passos (Opcional - Documentação)

1. **Atualizar README.md**:
   - Documentar novo fluxo one-shot
   - Exemplos de uso do AutoResult
   - Estrutura de `qa/<product>/`

2. **Atualizar QUICKSTART.md**:
   - Guia de 5 minutos com novo comando
   - Explicar outputs estruturados

3. **CI/CD Examples**:
   - Template `.github/workflows/quality.yml`
   - Exemplo de validação de thresholds

4. **Migration Guide** (opcional):
   - Script para converter estrutura antiga → nova
   - Documentar breaking changes

---

**Status Atual**: 📝 PRONTO PARA PRODUÇÃO  
**Prioridade Documentação**: � MÉDIA (funcionalidade completa, docs podem vir depois)  
**Esforço Restante**: ~4h (apenas documentação)  
**ROI**: ⭐⭐⭐⭐⭐ (objetivo transformado em realidade!)
