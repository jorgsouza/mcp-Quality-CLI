/**
 * 🧪 Testes para TypeScript Adapter
 * Valida capabilities: discoverFunctions, discoverTests, validateCases
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { TypeScriptAdapter } from '../typescript';
import type { LanguageAdapter } from '../../capabilities';

describe('TypeScriptAdapter', () => {
  let tmpDir: string;
  let adapter: LanguageAdapter;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ts-adapter-test-'));
    adapter = TypeScriptAdapter;
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('detect()', () => {
    it('deve detectar projeto TypeScript com package.json', async () => {
      writeFileSync(join(tmpDir, 'package.json'), '{}');
      const result = await adapter.detect(tmpDir);
      expect(result).toBe(true);
    });

    it('deve detectar projeto TypeScript com tsconfig.json', async () => {
      writeFileSync(join(tmpDir, 'tsconfig.json'), '{}');
      const result = await adapter.detect(tmpDir);
      expect(result).toBe(true);
    });

    it('deve retornar false para diretório sem arquivos TypeScript', async () => {
      const result = await adapter.detect(tmpDir);
      expect(result).toBe(false);
    });
  });

  describe('detectFramework()', () => {
    it('deve detectar vitest via vitest.config.ts', async () => {
      writeFileSync(join(tmpDir, 'vitest.config.ts'), 'export default {}');
      const result = await adapter.detectFramework(tmpDir);
      expect(result).toBe('vitest');
    });

    it('deve detectar jest via jest.config.js', async () => {
      writeFileSync(join(tmpDir, 'jest.config.js'), 'module.exports = {}');
      const result = await adapter.detectFramework(tmpDir);
      expect(result).toBe('jest');
    });

    it('deve retornar null se não detectar framework', async () => {
      const result = await adapter.detectFramework(tmpDir);
      expect(result).toBeNull();
    });
  });

  describe('discoverFunctions()', () => {
    it('deve descobrir função exportada simples', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'utils.ts'),
        `export function parseJson(data: string) {
  return JSON.parse(data);
}`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      
      expect(functions).toHaveLength(1);
      expect(functions[0]).toMatchObject({
        name: 'parseJson',
        isExported: true,
        isAsync: false,
        params: ['data'],
      });
      expect(functions[0].criticality).toBe('CRITICAL'); // parse* é CRITICAL
    });

    it('deve descobrir função async', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'api.ts'),
        `export async function fetchUser(id: number) {
  return await fetch(\`/api/users/\${id}\`);
}`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      
      expect(functions).toHaveLength(1);
      expect(functions[0]).toMatchObject({
        name: 'fetchUser',
        isExported: true,
        isAsync: true,
        params: ['id'],
        criticality: 'HIGH', // fetch* é HIGH
      });
    });

    it('deve descobrir arrow function exportada', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'helpers.ts'),
        `export const formatDate = (date: Date) => {
  return date.toISOString();
}`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      
      expect(functions).toHaveLength(1);
      expect(functions[0]).toMatchObject({
        name: 'formatDate',
        isExported: true,
        isAsync: false,
        params: ['date'],
        criticality: 'MEDIUM', // format* é MEDIUM
      });
    });

    it('deve determinar criticality CRITICAL para validadores', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'validators.ts'),
        `export function validateEmail(email: string) {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      
      expect(functions[0].criticality).toBe('CRITICAL');
    });

    it('deve determinar criticality HIGH para funções de escrita', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'db.ts'),
        `export function saveUser(user: User) {
  return db.users.insert(user);
}`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      
      expect(functions[0].criticality).toBe('HIGH');
    });

    it('deve ignorar arquivos de teste', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'utils.test.ts'),
        `export function testHelper() { return 'test'; }`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      
      expect(functions).toHaveLength(0);
    });
  });

  describe('discoverTests()', () => {
    it('deve descobrir testes com it()', async () => {
      writeFileSync(
        join(tmpDir, 'utils.test.ts'),
        `import { parseJson } from './utils';

it('should parse valid JSON', () => {
  const result = parseJson('{"name": "test"}');
  expect(result).toEqual({ name: 'test' });
});`
      );

      const functions: any[] = []; // Mock para testar só discoverTests
      const tests = await adapter.capabilities.tests!(tmpDir, functions);
      
      expect(tests).toHaveLength(1);
      expect(tests[0]).toMatchObject({
        name: 'should parse valid JSON',
        targetFunction: 'parseJson',
        hasSpies: false,
        hasMocks: false,
      });
      expect(tests[0].assertions).toHaveLength(1);
      expect(tests[0].assertions[0].type).toBe('toEqual');
      expect(tests[0].assertions[0].isWeak).toBe(false);
    });

    it('deve descobrir testes com test()', async () => {
      writeFileSync(
        join(tmpDir, 'math.spec.ts'),
        `test('adds two numbers', () => {
  expect(1 + 1).toBe(2);
});`
      );

      const tests = await adapter.capabilities.tests!(tmpDir, []);
      
      expect(tests).toHaveLength(1);
      expect(tests[0].name).toBe('adds two numbers');
    });

    it('deve detectar spies', async () => {
      writeFileSync(
        join(tmpDir, 'logger.test.ts'),
        `import { vi } from 'vitest';

it('should log message', () => {
  const spy = vi.spyOn(console, 'log');
  logMessage('test');
  expect(spy).toHaveBeenCalledWith('test');
});`
      );

      const tests = await adapter.capabilities.tests!(tmpDir, []);
      
      expect(tests[0].hasSpies).toBe(true);
    });

    it('deve detectar mocks', async () => {
      writeFileSync(
        join(tmpDir, 'api.test.ts'),
        `import { vi } from 'vitest';

it('should fetch user', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ id: 1 });
  const user = await fetchUser(1);
  expect(user).toEqual({ id: 1 });
});`
      );

      const tests = await adapter.capabilities.tests!(tmpDir, []);
      
      expect(tests[0].hasMocks).toBe(true);
    });

    it('deve detectar asserções fracas', async () => {
      writeFileSync(
        join(tmpDir, 'weak.test.ts'),
        `it('should be truthy', () => {
  expect(someValue).toBeTruthy();
});`
      );

      const tests = await adapter.capabilities.tests!(tmpDir, []);
      
      expect(tests[0].assertions[0].isWeak).toBe(true);
      expect(tests[0].assertions[0].type).toBe('toBeTruthy');
    });

    it('deve detectar múltiplas asserções', async () => {
      writeFileSync(
        join(tmpDir, 'multi.test.ts'),
        `it('validates user', () => {
  expect(user.name).toBe('John');
  expect(user.age).toEqual(30);
  expect(user.email).toMatch(/@/);
});`
      );

      const tests = await adapter.capabilities.tests!(tmpDir, []);
      
      expect(tests[0].assertions).toHaveLength(2); // toBe + toEqual (toMatch não está na lista)
    });
  });

  describe('validateCases()', () => {
    it('deve detectar happy path com asserções fortes', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'math.ts'),
        `export function add(a: number, b: number) { return a + b; }`
      );

      writeFileSync(
        join(tmpDir, 'math.test.ts'),
        `it('adds two numbers', () => {
  expect(add(1, 2)).toBe(3);
});`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      const tests = await adapter.capabilities.tests!(tmpDir, functions);
      
      const matrix = await adapter.capabilities.cases!(functions, tests);
      
      expect(matrix).toHaveLength(1);
      expect(matrix[0]).toMatchObject({
        functionName: 'add',
        happy: true,
        error: false,
        edge: false,
        sideEffects: false,
      });
    });

    it('deve detectar error handling', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'validators.ts'),
        `export function validateAge(age: number) {
  if (age < 0) throw new Error('Invalid age');
  return true;
}`
      );

      writeFileSync(
        join(tmpDir, 'validators.test.ts'),
        `it('throws on negative age', () => {
  expect(() => validateAge(-1)).toThrow('Invalid age');
});`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      const tests = await adapter.capabilities.tests!(tmpDir, functions);
      
      const matrix = await adapter.capabilities.cases!(functions, tests);
      
      expect(matrix[0].error).toBe(true);
    });

    it('deve detectar edge cases por nome do teste', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'utils.ts'),
        `export function getLength(str: string) { return str.length; }`
      );

      writeFileSync(
        join(tmpDir, 'utils.test.ts'),
        `it('handles empty string', () => {
  expect(getLength('')).toBe(0);
});`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      const tests = await adapter.capabilities.tests!(tmpDir, functions);
      
      const matrix = await adapter.capabilities.cases!(functions, tests);
      
      expect(matrix[0].edge).toBe(true);
    });

    it('deve detectar side effects com spies', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'logger.ts'),
        `export function logMessage(msg: string) {
  console.log(msg);
}`
      );

      writeFileSync(
        join(tmpDir, 'logger.test.ts'),
        `import { vi } from 'vitest';

it('logs message to console', () => {
  const spy = vi.spyOn(console, 'log');
  logMessage('test');
  expect(spy).toHaveBeenCalledWith('test');
});`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      const tests = await adapter.capabilities.tests!(tmpDir, functions);
      
      const matrix = await adapter.capabilities.cases!(functions, tests);
      
      expect(matrix[0].sideEffects).toBe(true);
    });

    it('deve identificar gaps de cenários faltantes', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'api.ts'),
        `export async function fetchData(url: string) {
  return await fetch(url);
}`
      );

      writeFileSync(
        join(tmpDir, 'api.test.ts'),
        `it('fetches data', async () => {
  const result = await fetchData('/api/test');
  expect(result).toBeDefined();
});`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      const tests = await adapter.capabilities.tests!(tmpDir, functions);
      
      const matrix = await adapter.capabilities.cases!(functions, tests);
      
      // fetchData é async e tem params → precisa de error handling e edge cases
      expect(matrix[0].gaps).toContain('Falta cenário: Error Handling');
      expect(matrix[0].gaps).toContain('Falta cenário: Edge Cases');
    });

    it('deve sugerir side effects para funções com verbos de ação', async () => {
      const srcDir = join(tmpDir, 'src');
      mkdirSync(srcDir, { recursive: true });
      
      writeFileSync(
        join(srcDir, 'db.ts'),
        `export function createUser(name: string) {
  return db.insert({ name });
}`
      );

      writeFileSync(
        join(tmpDir, 'db.test.ts'),
        `it('creates user', () => {
  const user = createUser('John');
  expect(user.name).toBe('John');
});`
      );

      const functions = await adapter.capabilities.functions!(tmpDir);
      const tests = await adapter.capabilities.tests!(tmpDir, functions);
      
      const matrix = await adapter.capabilities.cases!(functions, tests);
      
      expect(matrix[0].gaps).toContain('Falta cenário: Side Effects (função tem efeitos colaterais)');
    });
  });
});
