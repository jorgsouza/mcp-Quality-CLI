# Arquitetura de Adapters

## Visão Geral

O MCP Quality CLI possui **dois sistemas de adapters** que coexistem:

1. **Engine Adapters** (`src/engine/`) - Focado em análise e descoberta
2. **Language Adapters** (`src/adapters/`) - Focado em execução e scaffolding

## 🔧 Engine Adapters

**Localização**: `src/engine/capabilities.ts` + `src/engine/adapters/`

**Propósito**: Análise e descoberta de código

**Interface Principal**: `LanguageAdapter` (engine)

```typescript
interface LanguageAdapter {
  discoverFunctions(repo: string): Promise<FunctionInfo[]>;
  discoverTests(repo: string): Promise<TestInfo[]>;
  analyzeScenarios(repo: string): Promise<ScenarioMatrix[]>;
  detectLanguage(repo: string): Promise<LanguageDetection>;
  // ... mais métodos de análise
}
```

**Características**:
- Descoberta de funções e estruturas
- Análise de cenários de teste
- Detecção de complexidade
- Mapeamento de riscos

**Adapters Existentes**:
- `src/engine/adapters/typescript.ts` - Adapter TypeScript/JavaScript

## 🌐 Language Adapters

**Localização**: `src/adapters/base/LanguageAdapter.ts` + `src/adapters/`

**Propósito**: Execução, coverage, mutation e scaffolding

**Interface Principal**: `LanguageAdapter` (adapters)

```typescript
interface LanguageAdapter {
  detectFramework(repo: string): Promise<Framework>;
  discoverTests(repo: string): Promise<TestFile[]>;
  runTests(repo: string, options: RunOptions): Promise<TestResult>;
  parseCoverage(coverageFile: string): Promise<Coverage>;
  runMutation(repo: string, targets: string[]): Promise<MutationResult>;
  scaffoldTest(target: TestTarget): Promise<string>;
  validate(repo: string, options: ValidateOptions): Promise<ValidationResult>;
}
```

**Características**:
- Execução de testes (pytest, go test, mvn test, etc.)
- Parsing de coverage (Cobertura, JaCoCo, LCOV, etc.)
- Mutation testing (Stryker, mutmut, go-mutesting, PIT)
- Scaffolding de testes (unit, integration, e2e)

**Adapters Existentes**:
- `src/adapters/typescript.ts` - TypeScript/JavaScript
- `src/adapters/python.ts` - Python (pytest, unittest)
- `src/adapters/go.ts` - Go (go test)
- `src/adapters/java.ts` - Java (JUnit, Maven, Gradle)

## 🔄 Como os Dois Sistemas Interagem

### Pipeline `auto.ts`

1. **Fase de Análise** → Usa **Engine Adapters**
   - `analyze()` → `engine/index.ts` → `engine/adapters/typescript.ts`
   - Descobre funções, rotas, eventos
   - Analisa cenários de teste

2. **Fase de Execução/Scaffolding** → Usa **Language Adapters**
   - `scaffoldUnitTests()` → `adapters/typescript.ts`
   - `runMutationTests()` → `adapters/python.ts`, `adapters/go.ts`, etc.
   - `runCoverageAnalysis()` → Usa runners específicos

### Tools que Usam Engine Adapters

- `analyze.ts` - Análise de código
- `analyze-test-logic.ts` - Análise de qualidade de testes
- `risk-register.ts` - Mapa de riscos
- `catalog-cujs.ts` - Catálogo de CUJs

### Tools que Usam Language Adapters

- `scaffold-unit.ts` - Scaffolding de testes unitários
- `scaffold-integration.ts` - Scaffolding de testes de integração
- `run-mutation-tests.ts` - Mutation testing
- `run-coverage.ts` - Execução de coverage
- `self-check.ts` - Validação de ambiente

## 🎯 Status Atual

### ✅ Funcional
- Ambos os sistemas funcionam corretamente
- Não há conflitos ou sobreposição problemática
- Cada um tem seu propósito bem definido

### ⚠️ Duplicidade
- Dois `LanguageAdapter` com nomes iguais mas interfaces diferentes
- Código TypeScript está duplicado:
  - `src/engine/adapters/typescript.ts` (análise)
  - `src/adapters/typescript.ts` (execução)

## 🔮 Roadmap Futuro (V2.0+)

### Unificação Proposta

**Opção 1: Interface Única** (Recomendado)

```typescript
// src/adapters/unified/LanguageAdapter.ts
interface UnifiedLanguageAdapter {
  // Capabilities de Análise (do engine)
  discoverFunctions(repo: string): Promise<FunctionInfo[]>;
  analyzeScenarios(repo: string): Promise<ScenarioMatrix[]>;
  
  // Capabilities de Execução (dos adapters)
  runTests(repo: string, options: RunOptions): Promise<TestResult>;
  parseCoverage(coverageFile: string): Promise<Coverage>;
  runMutation(repo: string, targets: string[]): Promise<MutationResult>;
  scaffoldTest(target: TestTarget): Promise<string>;
}
```

**Opção 2: Composição**

```typescript
// engine e adapters usam a mesma base
import { LanguageAdapter } from '../adapters/base/LanguageAdapter.js';

// engine/index.ts
const adapter = getLanguageAdapter('typescript');
const functions = await adapter.discoverFunctions(repo);
const testResult = await adapter.runTests(repo, {coverage: true});
```

### Benefícios da Unificação

1. **Menos Código Duplicado**: Um único adapter TypeScript
2. **Consistência**: Interface única para todos os tools
3. **Extensibilidade**: Adicionar nova linguagem requer um único adapter
4. **Manutenibilidade**: Mudanças em um lugar só

### Etapas para Unificação (Futuro)

1. Mover `engine/adapters/typescript.ts` para `adapters/typescript-analyzer.ts`
2. Combinar com `adapters/typescript.ts` existente
3. Atualizar `engine/index.ts` para importar de `adapters/`
4. Depreciar `engine/adapters/` e remover após migração
5. Atualizar testes e documentação

## 📝 Notas para Contribuidores

### Ao Adicionar Nova Linguagem

**Atualmente** (V1.0), você precisa criar:

1. **Analyzer** (opcional): `src/engine/adapters/<lang>.ts`
   - Se quiser análise completa de código
   - Implementar `LanguageAdapter` (engine)

2. **Executor** (obrigatório): `src/adapters/<lang>.ts`
   - Para executar testes, coverage, mutation, scaffolding
   - Implementar `LanguageAdapter` (adapters)

**No Futuro** (V2.0+), você criará apenas:

1. **Unified Adapter**: `src/adapters/<lang>.ts`
   - Interface única com todos os métodos
   - Usado por engine e tools

### Ao Fazer Modificações

- **Engine Adapters**: Impacta análise e descoberta
- **Language Adapters**: Impacta execução e scaffolding
- Teste ambos se suas mudanças afetam detecção de linguagem

---

## 🤝 Contribuindo

Se você quer ajudar com a unificação, abra uma issue ou PR referenciando este documento!

**Versão**: 1.0.0  
**Status**: Documentado - Unificação planejada para V2.0  
**Atualizado**: 2024-11-04

