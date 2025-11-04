# 📐 Status da Arquitetura - Análise Técnica

## ✅ O que está funcionando (MUITO BEM!)

### 1. CDC/Pact Integrado no Pipeline ✅
- **Local**: `src/tools/auto.ts` linhas 700-750
- **Status**: `runContractsVerify()` chamado no modo `full`
- **Artefatos**: Gera `contract-catalog.json` e `contracts-verify.json`
- **Quality Gates**: Integrado com `validate.ts` (linha 166)

### 2. Diff Coverage Implementado ✅
- **Local**: `src/tools/run-diff-coverage.ts`
- **Status**: Totalmente funcional, integrado no `auto.ts` (linha 651)
- **Artefatos**: `diff-coverage.json`, `DIFF-COVERAGE-REPORT.md`
- **Quality Gates**: Integrado com `validate.ts` (linha 155)
- **PR-Aware**: Calcula coverage apenas para linhas alteradas

### 3. Detectors Multi-Stack ✅
- **Next.js**: `src/detectors/next-detector.ts`
- **Express**: `src/detectors/express-detector.ts`
- **Events**: `src/detectors/event-detector.ts`
- **Parsers**: Suporta Istanbul/LCOV, JaCoCo, Go, SimpleCov

### 4. CLI & MCP Tools por Manifesto ✅
- **CLI**: `src/commands.manifest.ts` - 7 comandos
- **MCP**: `src/mcp-tools.manifest.ts` - 9 tools
- **Flags úteis**: `--min-diff-coverage`, `--base-branch`, `--require-contracts-passing`

### 5. Self-Check & Organização ✅
- **Self-Check**: `src/tools/self-check.ts` - Valida Node, Vitest, etc.
- **Estrutura**: `qa/<product>/analyses|tests|reports|dashboards`
- **Limpa**: Remove relatórios redundantes após consolidação

---

## ⚠️ Arquitetura: Dois Sistemas de Adapters (Duplicidade)

### Problema Identificado
Existem **dois** contratos de `LanguageAdapter`:

#### 1. `src/engine/capabilities.ts` (Engine antigo)
```typescript
// Engine antigo - focado em análise
export interface LanguageDetection {
  language: string;
  confidence: number;
  files: string[];
  testFramework?: string;
  buildTool?: string;
  packageManager?: string;
}

export interface LanguageCapabilities {
  language: string;
  canAnalyze: boolean;
  canRunTests: boolean;
  canGenerateCoverage: boolean;
  canRunMutation: boolean;
}
```

**Usado por**:
- `src/engine/index.ts` (runPipeline)
- Análise de código
- Descoberta de funções

#### 2. `src/adapters/base/LanguageAdapter.ts` (Novo sistema unificado)
```typescript
// Sistema novo - completo
export interface LanguageAdapter {
  language: string;
  fileExtensions: string[];
  
  detectFramework(repo: string): Promise<Framework>;
  discoverTests(repo: string): Promise<TestFile[]>;
  runTests(repo: string, options: RunOptions): Promise<TestResult>;
  parseCoverage(coverageFile: string): Promise<Coverage>;
  runMutation(repo: string, targets: string[]): Promise<MutationResult>;
  scaffoldTest(target: TestTarget): Promise<string>;
  validate(repo: string, options: ValidateOptions): Promise<ValidationResult>;
}
```

**Usado por**:
- `src/adapters/typescript.ts`
- `src/adapters/python.ts`
- `src/adapters/go.ts`
- `src/adapters/java.ts`
- `src/tools/scaffold-unit.ts`
- `src/runners/python-runner.ts`
- `src/runners/go-runner.ts`
- `src/runners/java-runner.ts`

### Impacto
- ⚠️ **Drift**: Mudanças em um não refletem no outro
- ⚠️ **Acoplamento duplo**: Dificulta plugar Python/Go/Java de ponta a ponta
- ⚠️ **Engine não usa novos adapters**: `auto.ts` não chama `runPipeline` com os adapters modernos

---

## 🔧 Plano de Unificação (Próximos Passos)

### Opção 1: Unificar em `src/adapters/` (RECOMENDADO)
1. **Manter** `src/adapters/base/LanguageAdapter.ts` como contrato único
2. **Migrar** `src/engine/adapters/typescript.ts` → `src/adapters/typescript-adapter.ts`
3. **Criar wrapper** para backward compatibility temporária
4. **Atualizar** `src/engine/index.ts` para consumir `src/adapters/adapter-factory.ts`
5. **Integrar** `runPipeline()` no `auto.ts` para análise multi-linguagem

### Opção 2: Criar Bridge/Facade (Intermediário)
1. **Criar** `src/adapters/adapter-bridge.ts` (já existe!)
2. **Mapear** `LanguageDetection` (antigo) → `LanguageAdapter` (novo)
3. **Manter** ambos temporariamente até full migration

---

## 🚀 Status de Implementação por Linguagem

| Linguagem | Detect | Run Tests | Coverage | Mutation | Scaffold | Status |
|-----------|--------|-----------|----------|----------|----------|--------|
| **TypeScript** | ✅ | ✅ | ✅ | ✅ (Stryker) | ✅ | 🟢 Completo |
| **JavaScript** | ✅ | ✅ | ✅ | ✅ (Stryker) | ✅ | 🟢 Completo |
| **Python** | ✅ | ✅ | ✅ | ✅ (mutmut) | ✅ | 🟢 Completo |
| **Go** | ✅ | ✅ | ✅ | ✅ (go-mutesting) | ✅ | 🟢 Completo |
| **Java** | ✅ | ✅ | ✅ (JaCoCo) | ✅ (PIT) | ✅ | 🟢 Completo |
| **Ruby** | ✅ | ⚠️ | ⚠️ (SimpleCov) | ❌ | ⚠️ | 🟡 Parcial |

---

## 📊 Dashboard - Métricas Faltantes

### Status Atual
`src/tools/dashboard.ts` exibe:
- ✅ Coverage global (lines, branches, functions)
- ✅ Mutation score
- ✅ Quality score
- ✅ Test pyramid
- ❌ **Diff Coverage** (faltando!)
- ❌ **Contracts Status** (faltando!)

### O que adicionar
```typescript
// Em dashboard.ts, adicionar:

// 1. Card de Diff Coverage
const diffCoveragePath = join(paths.analyses, 'diff-coverage.json');
if (existsSync(diffCoveragePath)) {
  const diffData = JSON.parse(await fs.readFile(diffCoveragePath, 'utf-8'));
  html += `
    <div class="card">
      <h3>📐 Diff Coverage (PR-Aware)</h3>
      <div class="big-number ${diffData.diffCoverage >= 80 ? 'success' : 'warning'}">
        ${diffData.diffCoverage.toFixed(1)}%
      </div>
      <p>Base: ${diffData.baseBranch}</p>
      <p>Linhas adicionadas: ${diffData.linesAdded}</p>
      <p>Linhas cobertas: ${diffData.linesCovered}</p>
    </div>
  `;
}

// 2. Card de Contracts
const contractsPath = join(paths.analyses, 'contracts-verify.json');
if (existsSync(contractsPath)) {
  const contracts = JSON.parse(await fs.readFile(contractsPath, 'utf-8'));
  const status = contracts.failed === 0 ? 'success' : 'error';
  html += `
    <div class="card ${status}">
      <h3>🤝 Contracts (CDC/Pact)</h3>
      <div class="big-number">${contracts.verified}/${contracts.total}</div>
      <p>${contracts.failed > 0 ? '❌ ' + contracts.failed + ' falhas' : '✅ Todos passando'}</p>
    </div>
  `;
}
```

---

## 🧪 Smoke Test Recomendado

### TypeScript/JS (End-to-End)
```bash
quality analyze --repo . --product Demo --mode full --scaffold --run
quality validate --repo . --product Demo \
  --min-mutation 70 \
  --min-branch 80 \
  --min-diff-coverage 80 \
  --require-contracts-passing \
  --base-branch main
```

**Esperado**: Reprovar se Pact falhar OU se diff coverage < 80%.

### Python/Go (Sanity)
```bash
quality analyze --repo . --product PyApp --mode run
quality analyze --repo . --product GoApp --mode run
```

**Esperado**: Gerar cobertura e relatórios. Quando adapters forem plugados no engine, o `full` fecha.

---

## 📌 Resumo Executivo

### ✅ Acertos
1. CDC integrado no `auto.ts` ✅
2. Diff-coverage tool pronta ✅
3. Parsers multi-formato ✅
4. Manifests bem feitos ✅
5. Self-check robusto ✅
6. Estrutura `qa/` limpa ✅
7. **validate.ts com gates de Diff Coverage e Contracts** ✅

### ⚠️ Ajustes Finais (Prioridade MÉDIA)
1. **Dashboard**: Adicionar cards de Diff Coverage e Contracts
2. **Unificar Adapters**: Migrar engine antigo para usar `src/adapters/`
3. **Integrar Engine no Auto**: Chamar `runPipeline()` com adapters unificados
4. **Ruby Support**: Completar adapter de Ruby (baixa prioridade)

### 🎯 Próxima Ação (15min)
**Adicionar Diff Coverage e Contracts ao Dashboard** - Impacto visual máximo!

---

**Status Geral**: ✅ **SÓLIDO & FUNCIONAL**  
**Bloqueadores**: ❌ Nenhum  
**Tech Debt**: ⚠️ Duplicidade de adapters (não urgente)

