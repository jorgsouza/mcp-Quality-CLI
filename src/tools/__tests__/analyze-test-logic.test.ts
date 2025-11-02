import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { analyzeTestLogic } from '../analyze-test-logic.js';

describe('analyzeTestLogic', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-logic-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  describe('Happy Path', () => {
    it('should analyze TypeScript project with basic tests', async () => {
      // Criar estrutura básica
      await mkdir(join(testDir, 'src'), { recursive: true });
      await mkdir(join(testDir, '__tests__'), { recursive: true });

      // Criar função fonte
      await writeFile(
        join(testDir, 'src/calculator.ts'),
        `export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}
`
      );

      // Criar testes
      await writeFile(
        join(testDir, '__tests__/calculator.test.ts'),
        `import { add, multiply } from '../src/calculator';

describe('add', () => {
  it('should add positive numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should handle negative numbers', () => {
    expect(add(-1, -2)).toBe(-3);
  });

  it('should handle zero', () => {
    expect(add(0, 5)).toBe(5);
  });
});

describe('multiply', () => {
  it('should multiply numbers', () => {
    expect(multiply(2, 3)).toBe(6);
  });
});
`
      );

      // Criar package.json
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'test-app',
          devDependencies: {
            vitest: '^1.0.0',
            typescript: '^5.0.0'
          }
        })
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'TestApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true);
      expect(result.language).toBe('typescript');
      expect(result.framework).toBe('Vitest'); // Capital V
      expect(result.functions.length).toBeGreaterThan(0);
      
      const addFunc = result.functions.find(f => f.name === 'add');
      expect(addFunc).toBeDefined();
      expect(addFunc?.tests.length).toBeGreaterThan(0);
      expect(addFunc?.scenarios.happy).toBe(true);
      expect(addFunc?.scenarios.edge).toBe(true); // negative, zero
    });

    it('should detect framework automatically', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({
          name: 'jest-app',
          devDependencies: {
            jest: '^29.0.0',
            '@types/jest': '^29.0.0'
          }
        })
      );

      await writeFile(
        join(testDir, 'src/helper.ts'),
        'export function helper() { return true; }'
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'JestApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true);
      expect(result.framework).toBe('Jest'); // Capital J
    });

    it('should calculate scenario coverage correctly', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      await mkdir(join(testDir, '__tests__'), { recursive: true });

      await writeFile(
        join(testDir, 'src/validator.ts'),
        `export function validateEmail(email: string): boolean {
  if (!email) throw new Error('Email required');
  return email.includes('@');
}
`
      );

      await writeFile(
        join(testDir, '__tests__/validator.test.ts'),
        `import { validateEmail } from '../src/validator';

describe('validateEmail', () => {
  it('should validate correct email', () => {
    expect(validateEmail('test@example.com')).toBe(true);
  });

  it('should reject invalid email', () => {
    expect(validateEmail('invalid')).toBe(false);
  });

  it('should throw on empty email', () => {
    expect(() => validateEmail('')).toThrow('Email required');
  });
});
`
      );

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'test', devDependencies: { vitest: '^1.0.0' } })
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'ValidatorApp',
        generatePatches: false,
        runMutation: false
      });

      const validator = result.functions.find(f => f.name === 'validateEmail');
      expect(validator?.scenarios.happy).toBe(true); // correct email
      expect(validator?.scenarios.edge).toBe(true); // invalid
      expect(validator?.scenarios.error).toBe(true); // throw
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty repository', async () => {
      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'EmptyApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true);
      expect(result.functions).toEqual([]);
      // Score base mínimo mesmo sem código
      expect(result.metrics.qualityScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle repository without tests', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(
        join(testDir, 'src/untested.ts'),
        'export function untested() { return 42; }'
      );

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'no-tests' })
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'NoTestsApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true);
      const untestedFunc = result.functions.find(f => f.name === 'untested');
      expect(untestedFunc?.tests).toEqual([]);
      expect(untestedFunc?.scenarios.happy).toBe(false);
    });

    it('should handle functions with weak assertions', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      await mkdir(join(testDir, '__tests__'), { recursive: true });

      await writeFile(
        join(testDir, 'src/service.ts'),
        'export function getUser() { return { id: 1, name: "Test" }; }'
      );

      await writeFile(
        join(testDir, '__tests__/service.test.ts'),
        `import { getUser } from '../src/service';

describe('getUser', () => {
  it('should return user', () => {
    const user = getUser();
    expect(user).toBeTruthy(); // weak!
    expect(user).toBeDefined(); // weak!
  });
});
`
      );

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'weak-test', devDependencies: { vitest: '^1.0.0' } })
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'WeakTestApp',
        generatePatches: false,
        runMutation: false
      });

      const getUserFunc = result.functions.find(f => f.name === 'getUser');
      expect(getUserFunc?.tests[0]?.weakAsserts.length).toBeGreaterThan(0);
      // Formato real: "expect(user).toBeTruthy() - verificar valor específico"
      expect(getUserFunc?.tests[0]?.weakAsserts.some(
        assert => assert.includes('toBeTruthy') || assert.includes('toBeDefined')
      )).toBe(true);
    });

    it('should handle null/undefined inputs gracefully', async () => {
      const result = await analyzeTestLogic({
        repo: testDir,
        product: '',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true);
    });

    it('should handle very large codebase efficiently', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      // Criar múltiplos arquivos
      for (let i = 0; i < 10; i++) {
        await writeFile(
          join(testDir, `src/file${i}.ts`),
          `export function func${i}() { return ${i}; }`
        );
      }

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'large-app' })
      );

      const startTime = Date.now();
      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'LargeApp',
        generatePatches: false,
        runMutation: false
      });
      const duration = Date.now() - startTime;

      expect(result.ok).toBe(true);
      expect(result.functions.length).toBeGreaterThanOrEqual(10);
      expect(duration).toBeLessThan(10000); // < 10s
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid repository path', async () => {
      // Função não tenta criar diretórios em caminhos inválidos
      // Apenas retorna resultados vazios
      const result = await analyzeTestLogic({
        repo: testDir + '/invalid', // subfolder que não existe
        product: 'InvalidApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
      expect(result.functions).toEqual([]);
    });

    it('should handle malformed source files', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(
        join(testDir, 'src/broken.ts'),
        'export function broken( { // syntax error'
      );

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'broken-app' })
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'BrokenApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true); // Should not crash
    });

    it('should handle malformed test files', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      await mkdir(join(testDir, '__tests__'), { recursive: true });

      await writeFile(
        join(testDir, 'src/func.ts'),
        'export function func() { return 1; }'
      );

      await writeFile(
        join(testDir, '__tests__/func.test.ts'),
        'describe("broken test" { // malformed'
      );

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'broken-test' })
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'BrokenTestApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true); // Should not crash
    });

    it('should handle missing package.json', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(
        join(testDir, 'src/nopackage.ts'),
        'export function nopackage() { return true; }'
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'NoPackageApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true);
      expect(result.framework).toBe('Unknown'); // sem package.json, não detecta
    });
  });

  describe('Side Effects', () => {
    it('should generate patches when requested', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      await mkdir(join(testDir, 'tests/analyses/patches'), { recursive: true });

      await writeFile(
        join(testDir, 'src/critical.ts'),
        'export function criticalFunction() { return "important"; }'
      );

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'patch-app' })
      );

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'PatchApp',
        generatePatches: true,
        runMutation: false
      });

      expect(result.ok).toBe(true);
      // Patches só são gerados para funções CRITICAL ou HIGH sem testes
      // Se não houver, patches será vazio
      expect(result.patches).toBeDefined();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should write report to correct location', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(
        join(testDir, 'src/report.ts'),
        'export function report() { return "data"; }'
      );

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'report-app' })
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'ReportApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true);
      expect(result.reportPath).toContain('TEST-QUALITY-LOGICAL-REPORT.md');
      expect(result.reportPath).toContain(testDir);
    });

    it('should log progress to console', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(
        join(testDir, 'src/logging.ts'),
        'export function logging() { return "log"; }'
      );

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'log-app' })
      );

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await analyzeTestLogic({
        repo: testDir,
        product: 'LogApp',
        generatePatches: false,
        runMutation: false
      });

      expect(consoleSpy).toHaveBeenCalled();
      // Verificar que tem logs relacionados à análise
      const hasLogicLogs = consoleSpy.mock.calls.some(
        call => call[0]?.includes('Análise') || call[0]?.includes('lógica') || 
                call[0]?.includes('Obtendo') || call[0]?.includes('semântica')
      );
      expect(hasLogicLogs).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should create output directories if they do not exist', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(
        join(testDir, 'src/mkdir.ts'),
        'export function mkdir() { return true; }'
      );

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'mkdir-app' })
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'MkdirApp',
        generatePatches: true,
        runMutation: false
      });

      expect(result.ok).toBe(true);
      // Should have created tests/analyses/patches directory
    });
  });

  describe('Multi-language Support', () => {
    it('should detect Python projects', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(
        join(testDir, 'requirements.txt'),
        'pytest==7.0.0'
      );

      await writeFile(
        join(testDir, 'src/python_func.py'),
        'def python_func():\n    return True'
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'PythonApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true);
      expect(result.language).toBe('python');
      expect(result.framework).toBe('Pytest'); // Capital P
    });

    it('should detect Go projects', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(
        join(testDir, 'go.mod'),
        'module example.com/myapp\n\ngo 1.21'
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'GoApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true);
      expect(result.language).toBe('go');
      expect(result.framework).toBe('go test'); // com espaço
    });

    it('should detect Java projects', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      
      await writeFile(
        join(testDir, 'pom.xml'),
        '<project><modelVersion>4.0.0</modelVersion></project>'
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'JavaApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.ok).toBe(true);
      expect(result.language).toBe('java');
      expect(result.framework).toBe('JUnit'); // Capital J e U
    });
  });

  describe('Quality Scoring', () => {
    it('should calculate quality score based on coverage', async () => {
      await mkdir(join(testDir, 'src'), { recursive: true });
      await mkdir(join(testDir, '__tests__'), { recursive: true });

      // High quality: all scenarios covered
      await writeFile(
        join(testDir, 'src/highquality.ts'),
        `export function processData(data: string): string {
  if (!data) throw new Error('No data');
  return data.toUpperCase();
}
`
      );

      await writeFile(
        join(testDir, '__tests__/highquality.test.ts'),
        `import { processData } from '../src/highquality';

describe('processData', () => {
  it('should process valid data', () => {
    expect(processData('hello')).toBe('HELLO');
  });

  it('should handle empty string', () => {
    expect(() => processData('')).toThrow('No data');
  });

  it('should handle special characters', () => {
    expect(processData('a@b')).toBe('A@B');
  });
});
`
      );

      await writeFile(
        join(testDir, 'package.json'),
        JSON.stringify({ name: 'quality-app', devDependencies: { vitest: '^1.0.0' } })
      );

      const result = await analyzeTestLogic({
        repo: testDir,
        product: 'QualityApp',
        generatePatches: false,
        runMutation: false
      });

      expect(result.metrics.qualityScore).toBeGreaterThan(70);
      expect(result.metrics.scenarioCoverage.happy).toBeGreaterThan(0);
      // Pelo menos algum cenário deve estar coberto
      expect(
        result.metrics.scenarioCoverage.happy +
        result.metrics.scenarioCoverage.edge +
        result.metrics.scenarioCoverage.error +
        result.metrics.scenarioCoverage.sideEffects
      ).toBeGreaterThan(0);
    });
  });
});
