# 🏗️ Arquitetura do MCP Quality CLI

## 📋 Visão Geral

O **MCP Quality CLI** é um sistema de análise de qualidade e geração automatizada de testes com suporte multi-linguagem.

**Linguagens Suportadas**: TypeScript, JavaScript, Java, Python, Go

**Arquitetura**: Polimórfica baseada em adapters + parsers normalizados

---

## 🎯 Componentes Principais

```
src/
├── adapters/          # 🌐 Language Adapters (polimórfico)
├── engine/            # 🔍 Engine de análise (usa adapters)
├── parsers/           # 📊 Parsers normalizados
├── runners/           # 🏃 Executores de testes
├── tools/             # 🛠️ Ferramentas CLI
├── contracts/         # 🤝 CDC/Pact verifiers
└── detectors/         # 🔎 Detectores de linguagem/framework
```

---

## 🌐 Sistema de Adapters

### Contrato Unificado: `LanguageAdapter`

**Localização**: `src/adapters/base/LanguageAdapter.ts`

```typescript
interface LanguageAdapter {
  // Identificação
  language: string;
  fileExtensions: string[];
  
  // 1. Detecção
  detectFramework(repo: string): Promise<Framework | null>;
  discoverTests(repo: string): Promise<TestFile[]>;
  
  // 2. Setup
  ensureDeps(repo: string, opts?: SetupOptions): Promise<SetupResult>;
  validate(repo: string, opts?: ValidateOptions): Promise<ValidationResult>;
  
  // 3. Build (Java/Go)
  build?(repo: string, opts?: BuildOptions): Promise<BuildResult>;
  
  // 4. Execução & Coverage
  runTests(repo: string, opts: RunOptions): Promise<TestResult>;
  parseCoverage(coverageFile: string): Promise<Coverage>;
  
  // 5. Mutation Testing
  runMutation(repo: string, targets: string[], opts?: MutationOptions): Promise<MutationResult>;
  
  // 6. Contracts CDC/Pact
  discoverContracts?(repo: string): Promise<Contract[]>;
  verifyContracts?(repo: string, opts?: ContractOptions): Promise<ContractResult>;
  
  // 7. Scaffolding
  scaffoldTest(target: TestTarget): Promise<string>;
}
```

### Adapters Implementados

| Adapter | Framework | Coverage | Mutation | Contracts | Status |
|---------|-----------|----------|----------|-----------|--------|
| **TypeScript** | Vitest, Jest, Mocha | LCOV | Stryker | Pact | ✅ 100% |
| **Java** | JUnit 5, Maven/Gradle | JaCoCo | PIT | Pact JVM | ✅ 100% |
| **Python** | pytest, unittest | coverage.py | mutmut | pact-python | ✅ 100% |
| **Go** | go test | coverprofile | go-mutesting | pact-go | ✅ 100% |

**Arquivos**:
- `src/adapters/typescript.ts` (685 linhas)
- `src/adapters/java.ts` (620 linhas)
- `src/adapters/python.ts` (690 linhas)
- `src/adapters/go.ts` (614 linhas)

### Adapter Factory

**Localização**: `src/adapters/adapter-factory.ts`

```typescript
// Registro de adapters
const ADAPTER_REGISTRY = {
  'typescript': typescriptAdapter,
  'javascript': typescriptAdapter,
  'java': javaAdapter,
  'python': pythonAdapter,
  'go': goAdapter,
};

// Obter adapter por linguagem
export function getAdapter(language: string): LanguageAdapter | null;

// Criar novo adapter (factory pattern)
export function createAdapter(language: string): LanguageAdapter | null;

// Listar todos os adapters
export function listAdapters(): string[];
```

---

## 📊 Sistema de Parsers

### Parsers Normalizados

Todos os parsers retornam o **mesmo schema** de `Coverage`, independente do formato de entrada.

#### 1. LCOV Parser (TypeScript/JS/Python/Go)

**Arquivo**: `src/parsers/lcov-line-parser.ts`

```typescript
// Parse LCOV completo
export function parseLCOV(content: string): LCOVReport;

// Encontrar arquivo no report
export function findFileInReport(report: LCOVReport, targetFile: string): string | null;

// Calcular coverage de linhas específicas (DIFF COVERAGE)
export function calculateLineCoverage(
  report: LCOVReport,
  file: string,
  lineNumbers: number[]
): { total: number; covered: number; percentage: number };
```

**Precisão**: Linha-a-linha (100% preciso)

#### 2. JaCoCo Parser (Java)

**Arquivo**: `src/parsers/jacoco-detailed-parser.ts`

```typescript
// Parse JaCoCo XML detalhado
export async function parseJaCoCoDetailedXml(filePath: string): Promise<JaCoCoDetailedReport>;

// Encontrar arquivo no report (fuzzy matching)
export function findJaCoCoFile(report: JaCoCoDetailedReport, targetFile: string): string | null;

// Calcular coverage de linhas específicas (DIFF COVERAGE)
export function calculateJaCoCoLineCoverage(
  report: JaCoCoDetailedReport,
  file: string,
  lineNumbers: number[]
): { total: number; covered: number; percentage: number };
```

**Precisão**: Linha-a-linha via XML parsing

**Fuzzy Matching**:
- Git diff: `src/main/java/com/example/UserService.java`
- JaCoCo: `com/example/UserService.java`
- Match: ✅ (remove prefixos, match por basename/sufixo)

#### 3. PIT Parser (Java Mutation)

**Arquivo**: `src/parsers/pit-parser.ts`

```typescript
// Parse PIT XML
export async function parsePITXml(filePath: string): Promise<PITReport>;

// Parse PIT stdout (fallback)
export function parsePITStdout(output: string): PITReport;

// Parse automático (tenta XML, fallback stdout)
export async function parsePITReport(
  filePathOrOutput: string,
  isFile: boolean
): Promise<MutationResult>;
```

**Formatos suportados**:
- `mutations.xml` (preferido)
- stdout text (fallback)

#### 4. Coverage Parsers Multi-Formato

**Arquivo**: `src/parsers/coverage-parsers.ts`

```typescript
// Parse automático (detecta formato)
export async function parseCoverageAuto(filePath: string): Promise<Coverage>;

// Parsers específicos
export async function parseIstanbulJson(filePath: string): Promise<Coverage>;
export async function parseCoberturaXml(filePath: string): Promise<Coverage>;
export async function parseJaCoCoXml(filePath: string): Promise<Coverage>;
export async function parseGoCoverprofile(filePath: string): Promise<Coverage>;
export async function parseSimpleCovJson(filePath: string): Promise<Coverage>;
export async function parseCloverXml(filePath: string): Promise<Coverage>;
export async function parseTarpaulinJson(filePath: string): Promise<Coverage>;
```

**Formatos suportados**: 7+ formatos

---

## 🔧 Engine de Análise

### Arquitetura do Engine

**Localização**: `src/engine/`

```
engine/
├── index.ts              # Pipeline principal
├── capabilities.ts       # Interface EngineAdapter
├── adapter-to-engine.ts  # 🆕 Wrapper unificador
└── adapters/
    └── typescript.ts     # Adapter TypeScript do engine
```

### Integration Pattern

**Antes**: 2 sistemas independentes (engine + adapters)

**Agora**: Engine usa adapters modernos via wrapper

```typescript
// src/engine/adapter-to-engine.ts

// Converte adapter moderno → engine adapter
export function wrapAdapterForEngine(modern: LanguageAdapter): EngineAdapter;

// Retorna todos os adapters modernos prontos para o engine
export function getAllEngineAdapters(): EngineAdapter[];
```

```typescript
// src/engine/index.ts

import { getAllEngineAdapters } from './adapter-to-engine.js';

export async function runPipeline(
  options: PipelineOptions,
  adapters?: LanguageAdapter[] // 🆕 Opcional
): Promise<AggregatedResult> {
  // 🆕 Usa adapters modernos por padrão
  const adaptersList = adapters || getAllEngineAdapters();
  
  // Detecta linguagem e usa adapter apropriado
  const adapter = await detectLanguage(options.repo, adaptersList);
  
  // Executa análise
  return runAnalysis(adapter, options);
}
```

**Benefícios**:
- ✅ Backward compatibility mantida
- ✅ Engine multi-linguagem automaticamente
- ✅ Sem código duplicado
- ✅ Adapters modernos como "source of truth"

---

## 🛠️ Orquestrador: `auto.ts`

### Pipeline Completo (11 Fases)

**Arquivo**: `src/tools/auto.ts`

```typescript
export async function auto(options: AutoOptions): Promise<AutoResult> {
  // 0. Init & Self-Check
  await runInitPhase(ctx);
  
  // 1. CUJ/SLO/Risk Discovery
  await runDiscoveryPhase(ctx);
  
  // 2. Portfolio Planning
  await runPortfolioPlanningPhase(ctx);
  
  // 3. Contract Testing (CDC/Pact)
  await runContractTestingPhase(ctx);
  
  // 4. Analysis (código, rotas, eventos)
  await runAnalysisPhase(ctx);
  
  // 5. Coverage Analysis
  await runCoverageAnalysisPhase(ctx);
    // 5.1. Global Coverage
    // 5.2. Pyramid Analysis
    // 5.3. Test Logic Analysis
    // 5.4. Suite Health
    // 5.5. Mutation Testing
    // 5.6. Diff Coverage (PR-aware) 🆕
  
  // 6. Strategy & Planning
  await runPlanningPhase(ctx);
  
  // 7. Consolidated Reports
  await runConsolidatedReporting(ctx);
  
  // 8. Scaffold (opcional)
  if (mode === 'scaffold') {
    await runScaffoldPhase(ctx);
  }
  
  // 9. Run & Validate (opcional)
  if (mode === 'full' || mode === 'run') {
    await runTestsPhase(ctx);
  }
  
  // 10. Production Metrics (Quality Gates)
  await runProdMetricsPhase(ctx);
  
  // 11. Quality Gates
  await runQualityGatesPhase(ctx);
  
  return buildFinalResult(ctx);
}
```

### Características Polimórficas

**Sem `if (language === ...)` no orquestrador!**

```typescript
// ❌ Antes (acoplado)
if (language === 'java') {
  await runMavenTests(repo);
} else if (language === 'python') {
  await runPytestTests(repo);
} else if (language === 'go') {
  await runGoTests(repo);
}

// ✅ Agora (polimórfico)
const adapter = getAdapter(language);
await adapter.runTests(repo, options);
```

---

## 📦 Runners

**Localização**: `src/runners/`

Executores concretos de testes por linguagem:

- `python-runner.ts` - pytest + coverage.py
- `go-runner.ts` - go test + coverprofile
- `java-runner.ts` - Maven/Gradle + JaCoCo
- `mutation-runner.ts` - Stryker, mutmut, go-mutesting, PIT

**Uso**: Chamados pelos adapters, não diretamente pelo orquestrador.

---

## 🤝 Contract Testing

### Verificadores CDC/Pact

**Localização**: `src/contracts/`

```typescript
// Java
export async function verifyJavaPactContracts(
  options: PactVerifyOptions
): Promise<PactVerifyResult>;

// Python (no adapter)
pythonAdapter.verifyContracts(repo, options);

// Go (no adapter)
goAdapter.verifyContracts(repo, options);
```

**Normalização**: Todos retornam mesmo schema `ContractResult`

---

## 🔍 Detecção de Linguagem

**Arquivo**: `src/detectors/language.ts`

```typescript
export async function detectLanguage(repo: string): Promise<LanguageDetection | null>;
```

**Lógica**:
1. Verifica arquivos marcadores (`package.json`, `pom.xml`, `go.mod`, etc.)
2. Conta arquivos por extensão (`.ts`, `.java`, `.py`, `.go`)
3. Retorna linguagem dominante + confidence score

---

## 📊 Diff Coverage (PR-Aware)

**Arquivo**: `src/tools/run-diff-coverage.ts`

**Fluxo**:

```typescript
// 1. Obter arquivos alterados
const changedFiles = await getChangedFiles(repo, baseBranch);

// 2. Obter linhas alteradas por arquivo
const diffData = await getDiffLinesPerFile(repo, baseBranch, changedFiles);

// 3. Detectar tipo de projeto e carregar coverage apropriado
if (isJavaProject) {
  const jacocoFile = await findJaCoCoFile(repo);
  jacocoReport = await parseJaCoCoDetailedXml(jacocoFile);
} else {
  const lcovFile = await findLCOVFile(repo);
  lcovReport = parseLCOV(lcovContent);
}

// 4. Calcular coverage PRECISO do diff linha-a-linha
for (const [file, lines] of diffData) {
  if (jacocoReport) {
    const result = calculateJaCoCoLineCoverage(jacocoReport, file, lines);
  } else if (lcovReport) {
    const result = calculateLineCoverage(lcovReport, file, lines);
  }
}
```

**Precisão**: 100% linha-a-linha (não aproximado!)

**Base Branch**: Dinâmico via `--base-branch` ou `BASE_BRANCH` env var

---

## ✅ Quality Gates

**Arquivo**: `src/tools/validate.ts`

**Gates Implementados**:

| Gate | Threshold | Bloqueante? |
|------|-----------|-------------|
| **Coverage** | Lines ≥80%, Branches ≥75% | ⚠️ Warning |
| **Diff Coverage** | ≥80% | ❌ Blocking |
| **Mutation** | Overall ≥50%, Critical ≥60% | ❌ Blocking (critical) |
| **Contracts** | Verified ≥95%, Breaking = 0 | ❌ Blocking (breaking) |
| **Suite Health** | Flakiness ≤3%, Runtime ≤12min | ⚠️ Warning |
| **Portfolio** | E2E ≤15%, Unit ≥60% | ⚠️ Warning |
| **Production** | CFR ≤15%, MTTR ≤60min | ❌ Blocking (CFR) |

**Exit Codes**:
- `0` → ✅ All gates passed
- `1` → ❌ BLOCKED (deploy parado!)
- `2` → ⚠️ WARNINGS (deploy com cautela)

---

## 📈 Dashboard

**Arquivo**: `src/tools/dashboard.ts`

**Visualização**: HTML interativo com 8 cards

1. **Coverage Global** - Lines, branches, functions
2. **Diff Coverage** - PR-aware coverage
3. **Mutation Score** - Stryker/PIT/mutmut/go-mutesting
4. **Contracts** - CDC/Pact verification
5. **Suite Health** - Flakiness, runtime, parallelism
6. **Portfolio** - Pyramid (unit/integration/e2e)
7. **Production** - DORA metrics
8. **Quality Gates** - Status geral

**Renderização**: Agnóstica de linguagem (dados normalizados)

---

## 🎯 Princípios Arquiteturais

### 1. Polimorfismo
- **Contrato único** (`LanguageAdapter`)
- **Sem `if/else` de linguagem** no orquestrador
- **Factory pattern** para obter adapters

### 2. Normalização
- **Parsers retornam mesmo schema** (`Coverage`, `MutationResult`)
- **Dashboard agnóstico** de formato de entrada
- **Quality Gates uniformes** para todas linguagens

### 3. Extensibilidade
- **Adicionar nova linguagem**: Implementar `LanguageAdapter`
- **Adicionar novo parser**: Implementar função que retorna `Coverage`
- **Adicionar novo gate**: Adicionar validação em `validate.ts`

### 4. Separação de Responsabilidades
- **Adapters**: Detecção + Execução
- **Parsers**: Normalização de formatos
- **Runners**: Lógica de execução concreta
- **Tools**: Orquestração + Relatórios

---

## 🔮 Evolução Futura

### Q1 2026: Performance & Security
- [ ] Performance testing (k6, JMeter)
- [ ] Security scanning (OWASP, Snyk)
- [ ] Parallel test execution

### Q2 2026: Novas Linguagens
- [ ] Ruby adapter (RSpec, SimpleCov)
- [ ] C#/.NET adapter (xUnit, Coverlet)
- [ ] Rust adapter (cargo test)

### Q3 2026: AI & Automation
- [ ] AI-powered test generation
- [ ] Auto-fix flaky tests
- [ ] Distributed tracing integration

---

## 📚 Referências

- **README**: Documentação principal
- **HISTORY**: Histórico de desenvolvimento
- **QUALITY-GATES-GUIDE**: Guia completo de Quality Gates
- **SETUP-BY-LANGUAGE**: Setup por linguagem
- **USAGE-BY-STACK**: Guias de uso por stack

---

**Última atualização**: 2025-11-04
**Versão**: v2.0.0
**Status**: ✅ Produção

