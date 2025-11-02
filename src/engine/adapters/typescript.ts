/**
 * 🔵 TypeScript/JavaScript Language Adapter
 * 
 * Implementa todas as capabilities para TS/JS usando:
 * - Vitest/Jest para testes
 * - AST parsing para análise estática
 * - Stryker para mutation testing
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  LanguageAdapter,
  Capabilities,
  FunctionInfo,
  TestInfo,
  ScenarioMatrix,
  CoverageMetrics,
  MutationResult,
  MockInfo,
  QualityReport
} from '../capabilities.js';

/**
 * 🔍 Detecta se o repo é TypeScript/JavaScript
 */
async function detect(repo: string): Promise<boolean> {
  const indicators = [
    'package.json',
    'tsconfig.json',
    'vitest.config.ts',
    'jest.config.js',
  ];

  return indicators.some(file => existsSync(join(repo, file)));
}

/**
 * 🧪 Detecta framework de teste
 */
async function detectFramework(repo: string): Promise<string | null> {
  const packageJsonPath = join(repo, 'package.json');
  
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if ('vitest' in deps) return 'vitest';
    if ('jest' in deps || '@jest/core' in deps) return 'jest';
    if ('mocha' in deps) return 'mocha';

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 📦 Capability: Descobre funções (stub - integra com detectors existentes)
 */
async function discoverFunctions(repo: string): Promise<FunctionInfo[]> {
  // TODO: Integrar com detectors/language.ts existente
  // Por ora, retorna stub
  console.log('⚠️  discoverFunctions ainda é stub - integrar com language.ts');
  return [];
}

/**
 * 🧪 Capability: Descobre testes (stub - integra com detectors/tests.ts)
 */
async function discoverTests(repo: string, functions: FunctionInfo[]): Promise<TestInfo[]> {
  // TODO: Integrar com detectors/tests.ts existente
  console.log('⚠️  discoverTests ainda é stub - integrar com tests.ts');
  return [];
}

/**
 * 🎯 Capability: Valida cenários (stub - integra com analyze-test-logic)
 */
async function validateCases(functions: FunctionInfo[], tests: TestInfo[]): Promise<ScenarioMatrix[]> {
  // TODO: Integrar com tools/analyze-test-logic.ts
  console.log('⚠️  validateCases ainda é stub - integrar com analyze-test-logic.ts');
  return [];
}

/**
 * 📈 Capability: Cobertura (stub - integra com run-coverage)
 */
async function analyzeCoverage(repo: string): Promise<CoverageMetrics> {
  // TODO: Integrar com tools/run-coverage.ts
  console.log('⚠️  analyzeCoverage ainda é stub - integrar com run-coverage.ts');
  return {
    lines: 0,
    branches: 0,
    functions: 0,
    statements: 0,
    uncoveredLines: [],
  };
}

/**
 * 🧬 Capability: Mutation testing (stub - Stryker)
 */
async function runMutation(repo: string): Promise<MutationResult> {
  // TODO: Implementar com @stryker-mutator/core
  console.log('⚠️  runMutation ainda é stub - implementar com Stryker');
  return {
    score: 0,
    killed: 0,
    survived: 0,
    timeout: 0,
    noCoverage: 0,
    survivors: [],
  };
}

/**
 * 🎭 Capability: Analisa mocks (stub)
 */
async function analyzeMocks(tests: TestInfo[]): Promise<MockInfo[]> {
  // TODO: Implementar análise de vi.spyOn(), jest.fn(), etc.
  console.log('⚠️  analyzeMocks ainda é stub');
  return [];
}

/**
 * 📄 Capability: Gera relatório (stub - integra com report.ts)
 */
async function generateReport(report: QualityReport): Promise<string> {
  // TODO: Integrar com tools/report.ts ou pyramid-report.ts
  console.log('⚠️  generateReport ainda é stub - integrar com report.ts');
  return 'reports/quality-report.md';
}

/**
 * 📜 Capability: Valida schemas (stub - JSON Schema)
 */
async function validateSchemas(report: QualityReport): Promise<{ valid: boolean; errors: string[] }> {
  // TODO: Implementar validação com ajv ou Zod
  console.log('⚠️  validateSchemas ainda é stub');
  return { valid: true, errors: [] };
}

/**
 * 🔵 Adapter TypeScript/JavaScript
 */
export const TypeScriptAdapter: LanguageAdapter = {
  language: 'typescript',
  frameworks: ['vitest', 'jest', 'mocha'],
  
  detect,
  detectFramework,
  
  capabilities: {
    functions: discoverFunctions,
    tests: discoverTests,
    cases: validateCases,
    coverage: analyzeCoverage,
    mutation: runMutation,
    mocks: analyzeMocks,
    report: generateReport,
    schemas: validateSchemas,
  },
};

export default TypeScriptAdapter;
