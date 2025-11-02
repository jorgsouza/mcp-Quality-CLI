/**
 * 🔧 Engine de Capabilities - Arquitetura Modular
 * 
 * Define interfaces para análise de qualidade extensível e poliglota.
 * Cada linguagem implementa um LanguageAdapter com suas capabilities.
 */

/**
 * 📊 Informações sobre uma função/método
 */
export interface FunctionInfo {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  params: string[];
  isExported: boolean;
  isAsync: boolean;
  complexity?: number;
  criticality?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * 🧪 Informações sobre um teste
 */
export interface TestInfo {
  name: string;
  filePath: string;
  targetFunction?: string;
  assertions: AssertionInfo[];
  hasSpies: boolean;
  hasMocks: boolean;
}

/**
 * ✅ Informação sobre uma assertion
 */
export interface AssertionInfo {
  type: string; // toBe, toEqual, toThrow, etc.
  value?: any;
  line: number;
  isWeak: boolean; // toBeDefined, toBeTruthy, etc.
}

/**
 * 🎯 Cenários de teste para uma função
 */
export interface ScenarioMatrix {
  functionName: string;
  happy: boolean;       // Testa caminho feliz
  error: boolean;       // Testa lançamento de erros
  edge: boolean;        // Testa casos limite
  sideEffects: boolean; // Testa efeitos colaterais com spies
  gaps: string[];       // Cenários faltantes
}

/**
 * 📈 Métricas de cobertura
 */
export interface CoverageMetrics {
  lines: number;
  branches: number;
  functions: number;
  statements: number;
  uncoveredLines: string[]; // "file.ts:10-15"
}

/**
 * 🧬 Resultado de mutation testing
 */
export interface MutationResult {
  score: number; // 0-100
  killed: number;
  survived: number;
  timeout: number;
  noCoverage: number;
  survivors: MutantInfo[];
}

/**
 * 👾 Informações sobre um mutante
 */
export interface MutantInfo {
  id: string;
  file: string;
  line: number;
  mutator: string; // ConditionalExpression, BlockStatement, etc.
  original: string;
  mutated: string;
  status: 'Survived' | 'Killed' | 'Timeout' | 'NoCoverage';
  killingSuggestion?: string;
}

/**
 * 🎭 Informações sobre mocks em um teste
 */
export interface MockInfo {
  type: 'spy' | 'mock' | 'stub';
  target: string;
  method?: string;
  filePath: string;
  line: number;
  hasAssertions: boolean;
}

/**
 * 📝 Schema de contrato (JSON Schema)
 */
export interface SchemaDefinition {
  $schema: string;
  type: string;
  required: string[];
  properties: Record<string, any>;
}

/**
 * 📄 Relatório consolidado
 */
export interface QualityReport {
  product: string;
  language: string;
  framework: string;
  timestamp: string;
  metrics: {
    qualityScore: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    coverage: CoverageMetrics;
    branchCoverageCritical: number;
    mutationScore: number;
    scenarioMatrixCritical: number;
  };
  functions: Array<FunctionInfo & { scenarios: ScenarioMatrix }>;
  tests: TestInfo[];
  gaps: string[];
  warnings: {
    weakAssertions: string[];
    mocks: string[];
    uncoveredBranches: string[];
  };
  recommendations: string[];
  reportPath: string;
  patches?: string[];
}

/**
 * 🔧 Capabilities disponíveis por linguagem
 */
export interface Capabilities {
  /** Descobre funções/métodos exportados no código */
  functions?: (repo: string) => Promise<FunctionInfo[]>;
  
  /** Encontra testes e assertions associadas */
  tests?: (repo: string, functions: FunctionInfo[]) => Promise<TestInfo[]>;
  
  /** Valida cenários de teste (happy/error/edge/side) */
  cases?: (functions: FunctionInfo[], tests: TestInfo[]) => Promise<ScenarioMatrix[]>;
  
  /** Executa e analisa cobertura de código */
  coverage?: (repo: string) => Promise<CoverageMetrics>;
  
  /** Executa mutation testing */
  mutation?: (repo: string) => Promise<MutationResult>;
  
  /** Valida contra schemas (JSON Schema, Zod, etc.) */
  schemas?: (report: QualityReport) => Promise<{ valid: boolean; errors: string[] }>;
  
  /** Gera relatório consolidado */
  report?: (data: QualityReport) => Promise<string>;
  
  /** Analisa uso de mocks (over/under-mocking) */
  mocks?: (tests: TestInfo[]) => Promise<MockInfo[]>;
}

/**
 * 🌐 Adapter de linguagem
 * 
 * Cada linguagem (TS, Python, Go, Java) implementa este adapter
 */
export interface LanguageAdapter {
  /** Nome da linguagem */
  language: string;
  
  /** Frameworks suportados */
  frameworks: string[]; // ['vitest', 'jest'], ['pytest'], ['go test'], etc.
  
  /** Capabilities disponíveis para esta linguagem */
  capabilities: Capabilities;
  
  /** Detecta se o repo usa esta linguagem */
  detect: (repo: string) => Promise<boolean>;
  
  /** Detecta framework de teste usado */
  detectFramework: (repo: string) => Promise<string | null>;
}

/**
 * 🚀 Opções de execução do pipeline
 */
export interface PipelineOptions {
  repo: string;
  product: string;
  language?: string; // Auto-detectado se omitido
  profile?: 'ci-fast' | 'ci-strict' | 'local-dev';
  flags?: {
    skipMutation?: boolean;
    skipSchemas?: boolean;
    skipMocks?: boolean;
    generatePatches?: boolean;
  };
}

/**
 * 📦 Resultado agregado do pipeline
 */
export interface AggregatedResult {
  ok: boolean;
  language: string;
  framework: string;
  report: QualityReport;
  execution: {
    started: string;
    finished: string;
    duration: number; // ms
    profile: string;
    stepsExecuted: string[];
    stepsSkipped: string[];
  };
  errors: string[];
}
