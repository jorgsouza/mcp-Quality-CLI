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
import { glob } from 'glob';
import { promises as fs } from 'node:fs';
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
  // Primeiro, verificar arquivos de configuração
  if (existsSync(join(repo, 'vitest.config.ts')) || 
      existsSync(join(repo, 'vitest.config.js')) ||
      existsSync(join(repo, 'vite.config.ts'))) {
    return 'vitest';
  }
  
  if (existsSync(join(repo, 'jest.config.js')) || 
      existsSync(join(repo, 'jest.config.ts'))) {
    return 'jest';
  }
  
  if (existsSync(join(repo, 'mocha.opts')) ||
      existsSync(join(repo, '.mocharc.js'))) {
    return 'mocha';
  }
  
  // Se não encontrou config, verificar package.json
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
 * 📦 Capability: Descobre funções (implementação real)
 */
async function discoverFunctions(repo: string): Promise<FunctionInfo[]> {
  const functions: FunctionInfo[] = [];
  
  // Buscar arquivos TypeScript/JavaScript (excluindo testes)
  const files = await glob('src/**/*.{ts,js}', {
    cwd: repo,
    ignore: ['**/node_modules/**', '**/dist/**', '**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
  });
  
  for (const file of files) {
    const filePath = join(repo, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Extrair funções exportadas
    const extracted = extractTypescriptFunctions(content, file, lines);
    functions.push(...extracted);
  }
  
  return functions;
}

/**
 * Extrai funções TypeScript/JavaScript de um arquivo
 */
function extractTypescriptFunctions(content: string, filePath: string, lines: string[]): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  
  // Regex para funções exportadas: export function name(...)
  const exportFnRegex = /export\s+(async\s+)?function\s+(\w+)\s*\((.*?)\)/g;
  let match;
  
  while ((match = exportFnRegex.exec(content)) !== null) {
    const isAsync = !!match[1];
    const name = match[2];
    const paramsStr = match[3];
    const startLine = content.substring(0, match.index).split('\n').length;
    
    // Encontrar linha de fechamento (heurística simples)
    const endLine = findFunctionEnd(content, match.index, lines);
    
    // Parsear parâmetros
    const params = paramsStr
      .split(',')
      .map(p => p.trim().split(':')[0].trim())
      .filter(p => p.length > 0);
    
    // Determinar criticality
    const criticality = determineCriticality(name, content.substring(match.index, match.index + 500));
    
    functions.push({
      name,
      filePath,
      startLine,
      endLine,
      params,
      isExported: true,
      isAsync,
      criticality,
    });
  }
  
  // Regex para arrow functions exportadas: export const name = (async)? (...) =>
  const arrowRegex = /export\s+const\s+(\w+)\s*=\s*(async\s+)?\((.*?)\)\s*=>/g;
  
  while ((match = arrowRegex.exec(content)) !== null) {
    const name = match[1];
    const isAsync = !!match[2];
    const paramsStr = match[3];
    const startLine = content.substring(0, match.index).split('\n').length;
    const endLine = findFunctionEnd(content, match.index, lines);
    
    const params = paramsStr
      .split(',')
      .map(p => p.trim().split(':')[0].trim())
      .filter(p => p.length > 0);
    
    const criticality = determineCriticality(name, content.substring(match.index, match.index + 500));
    
    functions.push({
      name,
      filePath,
      startLine,
      endLine,
      params,
      isExported: true,
      isAsync,
      criticality,
    });
  }
  
  return functions;
}

/**
 * Encontra linha de fechamento de função (heurística)
 */
function findFunctionEnd(content: string, startIndex: number, lines: string[]): number {
  const startLine = content.substring(0, startIndex).split('\n').length;
  let braceCount = 0;
  let foundStart = false;
  
  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i];
    
    for (const char of line) {
      if (char === '{') {
        braceCount++;
        foundStart = true;
      } else if (char === '}') {
        braceCount--;
        if (foundStart && braceCount === 0) {
          return i + 1;
        }
      }
    }
  }
  
  return startLine + 20; // Fallback
}

/**
 * Determina criticality de uma função
 */
function determineCriticality(name: string, snippet: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const lowerName = name.toLowerCase();
  const lowerSnippet = snippet.toLowerCase();
  
  // CRITICAL: Parsers, validadores de input externo, autenticação, segurança
  const criticalKeywords = [
    'parse', 'validate', 'auth', 'security', 'permission',
    'sanitize', 'verify', 'decrypt', 'encrypt', 'token'
  ];
  
  if (criticalKeywords.some(kw => lowerName.includes(kw))) {
    return 'CRITICAL';
  }
  
  // HIGH: Escrita de dados, API calls, transformações complexas
  const highKeywords = [
    'write', 'save', 'create', 'update', 'delete', 'api', 'fetch',
    'post', 'put', 'patch', 'transform', 'convert', 'process'
  ];
  
  if (highKeywords.some(kw => lowerName.includes(kw))) {
    return 'HIGH';
  }
  
  // MEDIUM: Leitura, formatação, utilidades
  const mediumKeywords = [
    'read', 'get', 'find', 'format', 'render', 'display'
  ];
  
  if (mediumKeywords.some(kw => lowerName.includes(kw))) {
    return 'MEDIUM';
  }
  
  // LOW: Helpers, getters simples
  return 'LOW';
}

/**
 * 🧪 Capability: Descobre testes (implementação real)
 */
async function discoverTests(repo: string): Promise<TestInfo[]> {
  const tests: TestInfo[] = [];
  
  // Buscar arquivos de teste
  const testFiles = await glob('**/*.{test,spec}.{ts,js}', {
    cwd: repo,
    ignore: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
  });
  
  for (const file of testFiles) {
    const filePath = join(repo, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Extrair testes
    const extracted = extractTests(content, filePath, lines);
    tests.push(...extracted);
  }
  
  return tests;
}

/**
 * Extrai testes de um arquivo
 */
function extractTests(content: string, filePath: string, lines: string[]): TestInfo[] {
  const tests: TestInfo[] = [];
  
  // Regex para blocos de teste: it('...', ...) ou test('...', ...)
  const testBlockRegex = /(?:it|test)\s*\(\s*['"`](.*?)['"`]\s*,/g;
  let match;
  
  while ((match = testBlockRegex.exec(content)) !== null) {
    const name = match[1];
    const startLine = content.substring(0, match.index).split('\n').length;
    const endLine = findTestEnd(content, match.index, lines);
    
    // Extrair snippet do teste (do início até ~500 chars depois)
    const testEndIndex = Math.min(match.index + 1000, content.length);
    const testSnippet = content.substring(match.index, testEndIndex);
    
    // Detectar função testada (heurística)
    const targetFunction = detectTestedFunction(name, content, filePath);
    
    // Detectar asserções
    const assertions = detectAssertions(testSnippet, startLine);
    
    // Detectar spies/mocks
    const hasSpies = /vi\.spyOn|jest\.spyOn|vi\.fn|jest\.fn|vi\.mock|jest\.mock/.test(testSnippet);
    const hasMocks = /mockReturnValue|mockImplementation|mockResolvedValue|mockRejectedValue/.test(testSnippet);
    
    tests.push({
      name,
      filePath,
      targetFunction,
      assertions,
      hasSpies,
      hasMocks,
    });
  }
  
  return tests;
}

/**
 * Encontra fim do bloco de teste
 */
function findTestEnd(content: string, startIndex: number, lines: string[]): number {
  const startLine = content.substring(0, startIndex).split('\n').length;
  let parenCount = 0;
  let foundStart = false;
  
  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i];
    
    for (const char of line) {
      if (char === '(') {
        parenCount++;
        foundStart = true;
      } else if (char === ')') {
        parenCount--;
        if (foundStart && parenCount === 0) {
          return i + 1;
        }
      }
    }
  }
  
  return startLine + 10; // Fallback
}

/**
 * Detecta função testada (heurística baseada em nome do teste ou imports)
 */
function detectTestedFunction(testName: string, content: string, filePath: string): string {
  // Estratégia 1: Buscar chamadas de função no próprio teste
  // Procurar por palavras que parecem funções (camelCase) no conteúdo do arquivo
  const functionCallRegex = /\b([a-z][a-zA-Z0-9]*)\s*\(/g;
  const matches = content.match(functionCallRegex);
  
  if (matches) {
    // Filtrar funções conhecidas de teste (it, test, expect, etc.)
    const testKeywords = ['it', 'test', 'describe', 'expect', 'toBe', 'toEqual', 'beforeEach', 'afterEach', 'vi', 'jest'];
    const functionCalls = matches
      .map(m => m.replace(/\s*\(/, ''))
      .filter(fn => !testKeywords.includes(fn) && /^[a-z]/.test(fn));
    
    // Se encontrou alguma função, retornar a primeira
    if (functionCalls.length > 0) {
      return functionCalls[0];
    }
  }
  
  // Estratégia 2: Nome do teste contém nome da função
  const words = testName.split(/\s+/);
  const possibleFunction = words.find(w => /^[a-z][a-zA-Z0-9]*$/.test(w));
  
  if (possibleFunction) {
    // Verificar se função é importada no arquivo
    const importRegex = new RegExp(`import\\s+.*\\b${possibleFunction}\\b`, 'g');
    if (importRegex.test(content)) {
      return possibleFunction;
    }
  }
  
  // Estratégia 3: Extrair de describe()
  const describeRegex = /describe\s*\(\s*['"`](.*?)['"`]/g;
  const describeMatch = describeRegex.exec(content);
  if (describeMatch) {
    const describeName = describeMatch[1];
    // Se describe tem nome de função (camelCase), usar
    if (/^[a-z][a-zA-Z0-9]*$/.test(describeName)) {
      return describeName;
    }
  }
  
  // Estratégia 4: Extrair de import (primeira função importada)
  const importRegex = /import\s+{?\s*([a-z][a-zA-Z0-9]*)/;
  const importMatch = content.match(importRegex);
  if (importMatch) {
    return importMatch[1];
  }
  
  // Fallback: Nome do arquivo de teste (sem extensão)
  const fileName = filePath.split('/').pop()?.replace(/\.(test|spec)\.(ts|js)$/, '') || 'unknown';
  return fileName;
}

/**
 * Detecta asserções em um snippet de teste
 */
function detectAssertions(snippet: string, baseLineNumber: number = 1): Array<{ type: string; isWeak: boolean; line: number }> {
  const assertions: Array<{ type: string; isWeak: boolean; line: number }> = [];
  const lines = snippet.split('\n');
  
  // Asserções fortes
  const strongAssertions = [
    'toEqual', 'toBe', 'toStrictEqual', 'toMatchObject', 'toHaveBeenCalledWith',
    'toHaveBeenNthCalledWith', 'toThrow', 'toThrowError', 'rejects', 'reject'
  ];
  
  lines.forEach((line, lineIndex) => {
    for (const assertType of strongAssertions) {
      const regex = new RegExp(`\\b${assertType}\\b`, 'g');
      if (regex.test(line)) {
        assertions.push({ 
          type: assertType, 
          isWeak: false,
          line: baseLineNumber + lineIndex
        });
      }
    }
  });
  
  // Asserções fracas
  const weakAssertions = [
    'toBeTruthy', 'toBeFalsy', 'toBeDefined', 'toBeUndefined',
    'toHaveBeenCalled', 'toHaveProperty'
  ];
  
  lines.forEach((line, lineIndex) => {
    for (const assertType of weakAssertions) {
      const regex = new RegExp(`\\b${assertType}\\b`, 'g');
      if (regex.test(line)) {
        assertions.push({ 
          type: assertType, 
          isWeak: true,
          line: baseLineNumber + lineIndex
        });
      }
    }
  });
  
  return assertions;
}

/**
 * 🎯 Capability: Valida cenários (integra com analyze-test-logic)
 */
async function validateCases(functions: FunctionInfo[], tests: TestInfo[]): Promise<ScenarioMatrix[]> {
  const scenarios: ScenarioMatrix[] = [];
  
  // Para cada função, verificar se testes cobrem todos os cenários
  for (const fn of functions) {
    // Melhorar matching de testes relacionados com múltiplas estratégias
    const relatedTests = tests.filter(test => {
      // Estratégia 1: targetFunction exato
      if (test.targetFunction === fn.name) return true;
      
      // Estratégia 2: nome da função aparece no nome do teste
      if (test.name.toLowerCase().includes(fn.name.toLowerCase())) return true;
      
      // Estratégia 3: arquivo de teste corresponde ao arquivo fonte
      const fnFileBase = fn.filePath.replace(/^.*\//, '').replace(/\.(ts|js)$/, '');
      const testFileBase = test.filePath.replace(/^.*\//, '').replace(/\.(test|spec)\.(ts|js)$/, '');
      if (fnFileBase === testFileBase) return true;
      
      // Estratégia 4: caminho parcial do arquivo
      if (test.filePath.includes(fnFileBase)) return true;
      
      return false;
    });
    
    // Analisar assertions dos testes relacionados
    const scenarioMatrix: ScenarioMatrix = {
      functionName: fn.name,
      happy: false,
      error: false,
      edge: false,
      sideEffects: false,
      gaps: [],
    };
    
    for (const test of relatedTests) {
      // Detectar cenário happy path
      if (test.assertions.some(a => 
        ['toEqual', 'toBe', 'toMatchObject', 'toStrictEqual'].includes(a.type) &&
        !a.isWeak
      )) {
        scenarioMatrix.happy = true;
      }
      
      // Detectar cenário error handling
      if (test.assertions.some(a => 
        ['toThrow', 'toThrowError', 'rejects', 'reject'].includes(a.type) ||
        a.type.includes('Throw') ||
        a.type.includes('reject')
      )) {
        scenarioMatrix.error = true;
      }
      
      // Detectar cenário edge cases (valores limite, vazios, null, undefined)
      const testContent = test.name.toLowerCase();
      if (
        testContent.includes('edge') ||
        testContent.includes('empty') ||
        testContent.includes('null') ||
        testContent.includes('undefined') ||
        testContent.includes('limite') ||
        testContent.includes('boundary') ||
        testContent.includes('zero') ||
        testContent.includes('vazio')
      ) {
        scenarioMatrix.edge = true;
      }
      
      // Detectar cenário side effects (usa spies/mocks)
      if (test.hasSpies || test.hasMocks) {
        // Verificar se há assertions sobre os spies
        const hasSpyAssertions = test.assertions.some(a =>
          a.type.includes('toHaveBeenCalled') ||
          a.type.includes('toHaveBeenCalledWith') ||
          a.type.includes('toHaveBeenNthCalledWith')
        );
        
        if (hasSpyAssertions) {
          scenarioMatrix.sideEffects = true;
        }
      }
    }
    
    // Identificar gaps
    if (!scenarioMatrix.happy) {
      scenarioMatrix.gaps.push('Falta cenário: Happy Path');
    }
    
    if (!scenarioMatrix.error && (fn.isAsync || fn.params.length > 0)) {
      scenarioMatrix.gaps.push('Falta cenário: Error Handling');
    }
    
    if (!scenarioMatrix.edge && fn.params.length > 0) {
      scenarioMatrix.gaps.push('Falta cenário: Edge Cases');
    }
    
    if (!scenarioMatrix.sideEffects && hasLikelySideEffects(fn)) {
      scenarioMatrix.gaps.push('Falta cenário: Side Effects (função tem efeitos colaterais)');
    }
    
    scenarios.push(scenarioMatrix);
  }
  
  return scenarios;
}

/**
 * Heurística: Função provavelmente tem side effects
 */
function hasLikelySideEffects(fn: FunctionInfo): boolean {
  const name = fn.name.toLowerCase();
  
  // Verbos que indicam side effects
  const sideEffectVerbs = [
    'write', 'create', 'update', 'delete', 'save', 'send',
    'log', 'emit', 'publish', 'execute', 'run', 'call',
    'mkdir', 'rm', 'copy', 'move', 'fetch', 'post'
  ];
  
  return sideEffectVerbs.some(verb => name.includes(verb));
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
