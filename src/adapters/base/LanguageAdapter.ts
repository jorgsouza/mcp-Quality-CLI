/**
 * LanguageAdapter.ts
 * 
 * Interface unificada para adapters de linguagens.
 * Padroniza descoberta, execução, coverage, mutation e scaffolding de testes
 * para qualquer linguagem (TypeScript, Python, Go, Java, Ruby).
 * 
 * FASE A.1 - Unificação de Adapters
 * 
 * @see ROADMAP-V1-COMPLETO.md (Fase A)
 * @see PLANO-QUALITY-GATES.md (Lacuna #4)
 */

/**
 * Framework de testes detectado
 */
export interface Framework {
  name: string;
  version?: string;
  configFile?: string;
  testDir?: string;
  coverageTool?: string;
  mutationTool?: string;
}

/**
 * Arquivo de teste descoberto
 */
export interface TestFile {
  path: string;
  type: 'unit' | 'integration' | 'e2e' | 'contract' | 'property' | 'approval';
  language: string;
  framework: string;
  testCount?: number;
  coverage?: number;
}

/**
 * Opções para execução de testes
 */
export interface RunOptions {
  types?: Array<'unit' | 'integration' | 'e2e' | 'contract'>;
  files?: string[];
  coverage?: boolean;
  watch?: boolean;
  parallel?: boolean;
  maxWorkers?: number;
  timeout?: number;
  tags?: string[];
  env?: Record<string, string>;
}

/**
 * Resultado da execução de testes
 */
export interface TestResult {
  ok: boolean;
  framework: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: Coverage;
  failures?: TestFailure[];
  output?: string;
}

/**
 * Falha em teste
 */
export interface TestFailure {
  testName: string;
  file: string;
  line?: number;
  error: string;
  stack?: string;
}

/**
 * Cobertura de testes
 */
export interface Coverage {
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  statements: CoverageMetric;
  files?: FileCoverage[];
}

/**
 * Métrica de cobertura
 */
export interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

/**
 * Cobertura por arquivo
 */
export interface FileCoverage {
  path: string;
  lines: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  statements: CoverageMetric;
  uncoveredLines?: number[];
}

/**
 * Resultado de mutation testing
 */
export interface MutationResult {
  ok: boolean;
  framework: string;
  totalMutants: number;
  killed: number;
  survived: number;
  timeout: number;
  noCoverage: number;
  score: number;
  threshold?: number;
  mutations?: Mutation[];
}

/**
 * Mutação individual
 */
export interface Mutation {
  id: string;
  file: string;
  line: number;
  mutator: string;
  original: string;
  mutated: string;
  status: 'killed' | 'survived' | 'timeout' | 'no-coverage';
  killedBy?: string[];
}

/**
 * Alvo para scaffolding de testes
 */
export interface TestTarget {
  file: string;
  function?: string;
  class?: string;
  type: 'unit' | 'integration' | 'e2e' | 'contract' | 'property' | 'approval';
  outputPath?: string;
  template?: string;
}

/**
 * Interface unificada para adapters de linguagens.
 * 
 * Cada linguagem (TypeScript, Python, Go, Java, Ruby) implementa esta interface
 * para fornecer funcionalidades padronizadas de:
 * - Detecção de framework de testes
 * - Descoberta de arquivos de teste
 * - Execução de testes (unit, integration, e2e, contract)
 * - Parsing de cobertura (LCOV, Cobertura, JaCoCo, gocov)
 * - Mutation testing (Stryker, mutmut, go-mutesting, PIT)
 * - Scaffolding de testes
 * 
 * @example
 * ```typescript
 * const adapter = new TypeScriptAdapter();
 * 
 * // Detectar framework
 * const framework = await adapter.detectFramework('/path/to/repo');
 * console.log(framework.name); // 'vitest'
 * 
 * // Executar testes
 * const result = await adapter.runTests('/path/to/repo', { coverage: true });
 * console.log(`${result.passed}/${result.totalTests} passed`);
 * 
 * // Mutation testing
 * const mutation = await adapter.runMutation('/path/to/repo', ['src/core.ts']);
 * console.log(`Mutation score: ${mutation.score * 100}%`);
 * ```
 */
export interface LanguageAdapter {
  /**
   * Nome da linguagem suportada
   * @example 'typescript', 'python', 'go', 'java', 'ruby'
   */
  readonly language: string;

  /**
   * Extensões de arquivo suportadas
   * @example ['.ts', '.tsx', '.js', '.jsx']
   */
  readonly fileExtensions: string[];

  /**
   * Detecta o framework de testes no repositório.
   * 
   * @param repo - Caminho do repositório
   * @returns Framework detectado ou null se nenhum encontrado
   * 
   * @example
   * ```typescript
   * const framework = await adapter.detectFramework('/my-project');
   * // { name: 'vitest', version: '1.0.0', configFile: 'vitest.config.ts' }
   * ```
   */
  detectFramework(repo: string): Promise<Framework | null>;

  /**
   * Descobre arquivos de teste no repositório.
   * 
   * @param repo - Caminho do repositório
   * @param options - Opções de descoberta (tipos, padrões, etc)
   * @returns Lista de arquivos de teste encontrados
   * 
   * @example
   * ```typescript
   * const tests = await adapter.discoverTests('/my-project');
   * // [{ path: 'src/core.test.ts', type: 'unit', language: 'typescript' }]
   * ```
   */
  discoverTests(
    repo: string,
    options?: { types?: string[]; patterns?: string[] }
  ): Promise<TestFile[]>;

  /**
   * Executa testes no repositório.
   * 
   * @param repo - Caminho do repositório
   * @param options - Opções de execução (coverage, watch, parallel, etc)
   * @returns Resultado da execução
   * 
   * @example
   * ```typescript
   * const result = await adapter.runTests('/my-project', { 
   *   coverage: true, 
   *   types: ['unit', 'integration'] 
   * });
   * // { ok: true, passed: 150, failed: 0, coverage: { lines: { pct: 85 } } }
   * ```
   */
  runTests(repo: string, options?: RunOptions): Promise<TestResult>;

  /**
   * Faz parsing de arquivo de cobertura e retorna métricas padronizadas.
   * 
   * @param coverageFile - Caminho do arquivo de cobertura (LCOV, XML, JSON)
   * @returns Métricas de cobertura padronizadas
   * 
   * @example
   * ```typescript
   * const coverage = await adapter.parseCoverage('coverage/lcov.info');
   * // { lines: { total: 1000, covered: 850, pct: 85 } }
   * ```
   */
  parseCoverage(coverageFile: string): Promise<Coverage>;

  /**
   * Executa mutation testing nos módulos especificados.
   * 
   * @param repo - Caminho do repositório
   * @param targets - Arquivos/módulos para aplicar mutações
   * @param options - Opções de mutation (threshold, timeout, etc)
   * @returns Resultado do mutation testing
   * 
   * @example
   * ```typescript
   * const mutation = await adapter.runMutation('/my-project', ['src/billing.ts']);
   * // { score: 0.78, killed: 156, survived: 44, totalMutants: 200 }
   * ```
   */
  runMutation(
    repo: string,
    targets: string[],
    options?: { threshold?: number; timeout?: number }
  ): Promise<MutationResult>;

  /**
   * Gera scaffold de teste para um módulo/função específica.
   * 
   * @param target - Alvo do scaffolding (arquivo, função, tipo de teste)
   * @returns Código do teste gerado
   * 
   * @example
   * ```typescript
   * const testCode = await adapter.scaffoldTest({
   *   file: 'src/billing.ts',
   *   function: 'calculateTotal',
   *   type: 'unit'
   * });
   * // "import { describe, it, expect } from 'vitest'; ..."
   * ```
   */
  scaffoldTest(target: TestTarget): Promise<string>;

  /**
   * Valida se o ambiente está configurado corretamente.
   * Verifica se framework de testes, runners e ferramentas estão instalados.
   * 
   * @param repo - Caminho do repositório
   * @returns Diagnóstico de validação
   * 
   * @example
   * ```typescript
   * const validation = await adapter.validate('/my-project');
   * // { ok: false, missing: ['vitest', '@vitest/coverage-v8'] }
   * ```
   */
  validate(repo: string): Promise<{
    ok: boolean;
    framework?: Framework;
    missing?: string[];
    warnings?: string[];
  }>;
}

/**
 * Factory para criar adapter baseado na linguagem detectada.
 * 
 * @param language - Nome da linguagem ('typescript', 'python', 'go', etc)
 * @returns Adapter correspondente ou null se não suportado
 * 
 * @example
 * ```typescript
 * const adapter = createAdapter('typescript');
 * if (adapter) {
 *   const tests = await adapter.discoverTests('/my-project');
 * }
 * ```
 */
export type AdapterFactory = (language: string) => LanguageAdapter | null;

/**
 * Detecta linguagem principal do repositório.
 * 
 * @param repo - Caminho do repositório
 * @returns Linguagem detectada e percentual de confiança
 * 
 * @example
 * ```typescript
 * const lang = await detectLanguage('/my-project');
 * // { language: 'typescript', confidence: 0.95 }
 * ```
 */
export interface LanguageDetection {
  language: string;
  confidence: number;
  framework?: string;
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'go mod' | 'maven' | 'gradle';
}

