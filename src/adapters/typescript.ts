/**
 * TypeScript/JavaScript Language Adapter
 * 
 * Implementa LanguageAdapter para TypeScript/JavaScript usando:
 * - Vitest/Jest/Mocha para testes
 * - Coverage-v8 / istanbul para cobertura
 * - Stryker para mutation testing
 * 
 * FASE A.2 - Migração do adapter TypeScript
 * 
 * @see ROADMAP-V1-COMPLETO.md (Fase A)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { promises as fs } from 'node:fs';
import { glob } from 'glob';
import { execSync } from 'node:child_process';
import type {
  LanguageAdapter,
  Framework,
  TestFile,
  RunOptions,
  TestResult,
  Coverage,
  CoverageMetric,
  FileCoverage,
  MutationResult,
  Mutation,
  TestTarget,
} from './base/LanguageAdapter.js';

/**
 * TypeScript/JavaScript Adapter
 * 
 * Suporta:
 * - Frameworks: Vitest, Jest, Mocha
 * - Coverage: Coverage-v8 (Vitest), istanbul (Jest)
 * - Mutation: Stryker
 */
export class TypeScriptAdapter implements LanguageAdapter {
  readonly language = 'typescript';
  readonly fileExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  /**
   * Detecta framework de testes no repositório
   */
  async detectFramework(repo: string): Promise<Framework | null> {
    // 1. Verificar arquivos de configuração
    if (
      existsSync(join(repo, 'vitest.config.ts')) ||
      existsSync(join(repo, 'vitest.config.js')) ||
      existsSync(join(repo, 'vite.config.ts'))
    ) {
      const version = await this.getPackageVersion(repo, 'vitest');
      return {
        name: 'vitest',
        version,
        configFile: existsSync(join(repo, 'vitest.config.ts'))
          ? 'vitest.config.ts'
          : existsSync(join(repo, 'vitest.config.js'))
          ? 'vitest.config.js'
          : 'vite.config.ts',
        testDir: 'src',
        coverageTool: '@vitest/coverage-v8',
        mutationTool: '@stryker-mutator/core',
      };
    }

    if (
      existsSync(join(repo, 'jest.config.js')) ||
      existsSync(join(repo, 'jest.config.ts')) ||
      existsSync(join(repo, 'jest.config.json'))
    ) {
      const version = await this.getPackageVersion(repo, 'jest');
      return {
        name: 'jest',
        version,
        configFile: existsSync(join(repo, 'jest.config.ts'))
          ? 'jest.config.ts'
          : existsSync(join(repo, 'jest.config.js'))
          ? 'jest.config.js'
          : 'jest.config.json',
        testDir: '__tests__',
        coverageTool: 'jest',
        mutationTool: '@stryker-mutator/core',
      };
    }

    if (
      existsSync(join(repo, 'mocha.opts')) ||
      existsSync(join(repo, '.mocharc.js')) ||
      existsSync(join(repo, '.mocharc.json'))
    ) {
      const version = await this.getPackageVersion(repo, 'mocha');
      return {
        name: 'mocha',
        version,
        configFile: '.mocharc.js',
        testDir: 'test',
        coverageTool: 'nyc',
        mutationTool: '@stryker-mutator/core',
      };
    }

    // 2. Verificar package.json
    const packageJsonPath = join(repo, 'package.json');
    if (!existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if ('vitest' in deps) {
        return {
          name: 'vitest',
          version: deps['vitest'],
          coverageTool: '@vitest/coverage-v8',
          mutationTool: '@stryker-mutator/core',
        };
      }

      if ('jest' in deps || '@jest/core' in deps) {
        return {
          name: 'jest',
          version: deps['jest'] || deps['@jest/core'],
          coverageTool: 'jest',
          mutationTool: '@stryker-mutator/core',
        };
      }

      if ('mocha' in deps) {
        return {
          name: 'mocha',
          version: deps['mocha'],
          coverageTool: 'nyc',
          mutationTool: '@stryker-mutator/core',
        };
      }

      return null;
    } catch (error) {
      console.error('Erro ao ler package.json:', error);
      return null;
    }
  }

  /**
   * Descobre arquivos de teste
   */
  async discoverTests(
    repo: string,
    options?: { types?: string[]; patterns?: string[] }
  ): Promise<TestFile[]> {
    const tests: TestFile[] = [];

    // Padrões padrão
    const defaultPatterns = [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.test.js',
      '**/*.test.jsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.spec.js',
      '**/*.spec.jsx',
    ];

    const patterns = options?.patterns || defaultPatterns;

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: repo,
        ignore: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/build/**'],
      });

      for (const file of files) {
        const filePath = join(repo, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Detectar tipo de teste
        const type = this.detectTestType(file, content);

        // Contar testes
        const testCount = this.countTests(content);

        // Detectar framework
        const framework = this.detectTestFramework(content);

        tests.push({
          path: relative(repo, filePath),
          type,
          language: file.endsWith('.ts') || file.endsWith('.tsx') ? 'typescript' : 'javascript',
          framework,
          testCount,
        });
      }
    }

    return tests;
  }

  /**
   * Executa testes
   */
  async runTests(repo: string, options: RunOptions = {}): Promise<TestResult> {
    const framework = await this.detectFramework(repo);

    if (!framework) {
      throw new Error('Nenhum framework de testes detectado');
    }

    let command = '';
    let output = '';

    try {
      if (framework.name === 'vitest') {
        command = `npx vitest run`;
        if (options.coverage) command += ' --coverage';
        if (options.watch) command += ' --watch';
        if (options.parallel !== false) command += ' --threads';
        if (options.maxWorkers) command += ` --maxWorkers=${options.maxWorkers}`;
        if (options.files && options.files.length > 0) {
          command += ` ${options.files.join(' ')}`;
        }
      } else if (framework.name === 'jest') {
        command = `npx jest`;
        if (options.coverage) command += ' --coverage';
        if (options.watch) command += ' --watch';
        if (options.maxWorkers) command += ` --maxWorkers=${options.maxWorkers}`;
        if (options.files && options.files.length > 0) {
          command += ` ${options.files.join(' ')}`;
        }
      } else if (framework.name === 'mocha') {
        command = `npx mocha`;
        if (options.files && options.files.length > 0) {
          command += ` ${options.files.join(' ')}`;
        }
      }

      output = execSync(command, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      // Parsear resultado
      return this.parseTestOutput(framework.name, output, options.coverage);
    } catch (error: any) {
      // Teste falhou
      output = error.stdout || error.stderr || '';
      return this.parseTestOutput(framework.name, output, options.coverage, false);
    }
  }

  /**
   * Faz parsing de arquivo de cobertura
   */
  async parseCoverage(coverageFile: string): Promise<Coverage> {
    // Suporta:
    // - coverage/coverage-summary.json (Vitest/Jest)
    // - coverage/lcov.info (LCOV format)

    if (!existsSync(coverageFile)) {
      throw new Error(`Arquivo de cobertura não encontrado: ${coverageFile}`);
    }

    if (coverageFile.endsWith('coverage-summary.json')) {
      return this.parseCoverageSummaryJson(coverageFile);
    }

    if (coverageFile.endsWith('lcov.info')) {
      return this.parseLcov(coverageFile);
    }

    throw new Error(`Formato de cobertura não suportado: ${coverageFile}`);
  }

  /**
   * Executa mutation testing
   */
  async runMutation(
    repo: string,
    targets: string[],
    options?: { threshold?: number; timeout?: number }
  ): Promise<MutationResult> {
    const framework = await this.detectFramework(repo);

    if (!framework) {
      throw new Error('Nenhum framework de testes detectado');
    }

    // Verificar se Stryker está instalado
    const hasStryker = await this.hasPackage(repo, '@stryker-mutator/core');

    if (!hasStryker) {
      console.warn('⚠️  Stryker não instalado. Execute: npm i -D @stryker-mutator/core');
      return {
        ok: false,
        framework: 'stryker',
        totalMutants: 0,
        killed: 0,
        survived: 0,
        timeout: 0,
        noCoverage: 0,
        score: 0,
        threshold: options?.threshold || 0.5,
      };
    }

    try {
      // Executar Stryker
      const command = `npx stryker run`;
      const output = execSync(command, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: options?.timeout || 300000, // 5 min default
      });

      // Parsear relatório
      return this.parseMutationReport(repo, options?.threshold);
    } catch (error: any) {
      console.error('Erro ao executar Stryker:', error.message);
      return this.parseMutationReport(repo, options?.threshold);
    }
  }

  /**
   * Gera scaffold de teste
   */
  async scaffoldTest(target: TestTarget): Promise<string> {
    const framework = await this.detectFramework(target.file);

    if (!framework) {
      // Default: Vitest
      return this.generateVitestScaffold(target);
    }

    if (framework.name === 'vitest') {
      return this.generateVitestScaffold(target);
    }

    if (framework.name === 'jest') {
      return this.generateJestScaffold(target);
    }

    if (framework.name === 'mocha') {
      return this.generateMochaScaffold(target);
    }

    return this.generateVitestScaffold(target);
  }

  /**
   * Valida ambiente
   */
  async validate(repo: string): Promise<{
    ok: boolean;
    framework?: Framework;
    missing?: string[];
    warnings?: string[];
  }> {
    const missing: string[] = [];
    const warnings: string[] = [];

    // 1. Detectar framework
    const framework = await this.detectFramework(repo);

    if (!framework) {
      missing.push('Framework de testes (vitest, jest ou mocha)');
      return { ok: false, missing, warnings };
    }

    // 2. Verificar dependências do framework
    if (framework.name === 'vitest') {
      if (!(await this.hasPackage(repo, 'vitest'))) {
        missing.push('vitest');
      }
      if (!(await this.hasPackage(repo, '@vitest/coverage-v8'))) {
        warnings.push('@vitest/coverage-v8 (cobertura)');
      }
    } else if (framework.name === 'jest') {
      if (!(await this.hasPackage(repo, 'jest'))) {
        missing.push('jest');
      }
    } else if (framework.name === 'mocha') {
      if (!(await this.hasPackage(repo, 'mocha'))) {
        missing.push('mocha');
      }
      if (!(await this.hasPackage(repo, 'nyc'))) {
        warnings.push('nyc (cobertura)');
      }
    }

    // 3. Verificar Stryker
    if (!(await this.hasPackage(repo, '@stryker-mutator/core'))) {
      warnings.push('@stryker-mutator/core (mutation testing)');
    }

    const ok = missing.length === 0;

    return { ok, framework, missing, warnings };
  }

  // ==================== Helpers ====================

  private async getPackageVersion(repo: string, packageName: string): Promise<string | undefined> {
    const packageJsonPath = join(repo, 'package.json');
    if (!existsSync(packageJsonPath)) return undefined;

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      return deps[packageName]?.replace(/[\^~]/, '');
    } catch {
      return undefined;
    }
  }

  private async hasPackage(repo: string, packageName: string): Promise<boolean> {
    const version = await this.getPackageVersion(repo, packageName);
    return !!version;
  }

  private detectTestType(
    file: string,
    content: string
  ): 'unit' | 'integration' | 'e2e' | 'contract' | 'property' | 'approval' {
    if (file.includes('/e2e/') || file.includes('.e2e.')) return 'e2e';
    if (file.includes('/integration/') || file.includes('.integration.')) return 'integration';
    if (file.includes('/contract/') || content.includes('pactWith')) return 'contract';
    if (file.includes('/property/') || content.includes('fc.property')) return 'property';
    if (file.includes('/approval/') || content.includes('toMatchSnapshot')) return 'approval';
    return 'unit';
  }

  private countTests(content: string): number {
    const testRegex = /(?:it|test)\s*\(/g;
    const matches = content.match(testRegex);
    return matches ? matches.length : 0;
  }

  private detectTestFramework(content: string): string {
    if (content.includes('vitest') || content.includes("from 'vitest'")) return 'vitest';
    if (content.includes('jest') || content.includes("from '@jest")) return 'jest';
    if (content.includes('mocha') || content.includes("from 'mocha'")) return 'mocha';
    return 'unknown';
  }

  private parseTestOutput(
    framework: string,
    output: string,
    coverage?: boolean,
    ok = true
  ): TestResult {
    // Parsing simplificado - em produção, usar parser robusto
    const totalTests = parseInt(output.match(/(\d+)\s+tests?/)?.[1] || '0');
    const passed = parseInt(output.match(/(\d+)\s+passed/)?.[1] || (ok ? totalTests.toString() : '0'));
    const failed = parseInt(output.match(/(\d+)\s+failed/)?.[1] || (!ok ? '1' : '0'));
    const skipped = parseInt(output.match(/(\d+)\s+skipped/)?.[1] || '0');
    const duration = parseFloat(output.match(/Time:\s+([\d.]+)s/)?.[1] || '0');

    return {
      ok,
      framework,
      totalTests,
      passed,
      failed,
      skipped,
      duration,
      output,
    };
  }

  private async parseCoverageSummaryJson(filePath: string): Promise<Coverage> {
    const content = await fs.readFile(filePath, 'utf-8');
    const summary = JSON.parse(content);

    const total = summary.total || summary;

    return {
      lines: this.parseCoverageMetric(total.lines),
      functions: this.parseCoverageMetric(total.functions),
      branches: this.parseCoverageMetric(total.branches),
      statements: this.parseCoverageMetric(total.statements),
    };
  }

  private parseCoverageMetric(metric: any): CoverageMetric {
    return {
      total: metric.total || 0,
      covered: metric.covered || 0,
      skipped: metric.skipped || 0,
      pct: metric.pct || 0,
    };
  }

  private async parseLcov(filePath: string): Promise<Coverage> {
    // TODO: Implementar parser LCOV completo
    // Por enquanto, retorna estrutura vazia
    return {
      lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
      functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
      branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
      statements: { total: 0, covered: 0, skipped: 0, pct: 0 },
    };
  }

  private async parseMutationReport(repo: string, threshold = 0.5): Promise<MutationResult> {
    const reportPath = join(repo, 'reports/mutation/mutation.json');

    if (!existsSync(reportPath)) {
      return {
        ok: false,
        framework: 'stryker',
        totalMutants: 0,
        killed: 0,
        survived: 0,
        timeout: 0,
        noCoverage: 0,
        score: 0,
        threshold,
      };
    }

    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      const report = JSON.parse(content);

      const mutations: Mutation[] =
        report.files?.flatMap((file: any) =>
          file.mutants?.map((m: any) => ({
            id: m.id,
            file: file.source || '',
            line: m.location?.start?.line || 0,
            mutator: m.mutatorName || 'Unknown',
            original: m.replacement || '',
            mutated: m.mutatedLines || '',
            status: m.status.toLowerCase(),
            killedBy: m.killedBy || [],
          }))
        ) || [];

      const killed = mutations.filter((m) => m.status === 'killed').length;
      const survived = mutations.filter((m) => m.status === 'survived').length;
      const timeout = mutations.filter((m) => m.status === 'timeout').length;
      const noCoverage = mutations.filter((m) => m.status === 'no-coverage').length;
      const totalMutants = killed + survived + timeout + noCoverage;
      const score = totalMutants > 0 ? killed / totalMutants : 0;
      const ok = score >= threshold;

      return {
        ok,
        framework: 'stryker',
        totalMutants,
        killed,
        survived,
        timeout,
        noCoverage,
        score,
        threshold,
        mutations,
      };
    } catch (error) {
      console.error('Erro ao ler relatório de mutation:', error);
      return {
        ok: false,
        framework: 'stryker',
        totalMutants: 0,
        killed: 0,
        survived: 0,
        timeout: 0,
        noCoverage: 0,
        score: 0,
        threshold,
      };
    }
  }

  private generateVitestScaffold(target: TestTarget): string {
    const functionName = target.function || 'myFunction';

    return `import { describe, it, expect } from 'vitest';
import { ${functionName} } from './${target.file.replace(/\.(ts|js)$/, '')}';

describe('${functionName}', () => {
  it('should handle happy path', () => {
    // Arrange
    const input = {};

    // Act
    const result = ${functionName}(input);

    // Assert
    expect(result).toBeDefined();
  });

  it('should handle error cases', () => {
    // Arrange
    const invalidInput = null;

    // Act & Assert
    expect(() => ${functionName}(invalidInput)).toThrow();
  });

  it('should handle edge cases', () => {
    // Arrange
    const edgeInput = [];

    // Act
    const result = ${functionName}(edgeInput);

    // Assert
    expect(result).toEqual([]);
  });
});
`;
  }

  private generateJestScaffold(target: TestTarget): string {
    const functionName = target.function || 'myFunction';

    return `import { ${functionName} } from './${target.file.replace(/\.(ts|js)$/, '')}';

describe('${functionName}', () => {
  it('should handle happy path', () => {
    // Arrange
    const input = {};

    // Act
    const result = ${functionName}(input);

    // Assert
    expect(result).toBeDefined();
  });

  it('should handle error cases', () => {
    // Arrange
    const invalidInput = null;

    // Act & Assert
    expect(() => ${functionName}(invalidInput)).toThrow();
  });

  it('should handle edge cases', () => {
    // Arrange
    const edgeInput = [];

    // Act
    const result = ${functionName}(edgeInput);

    // Assert
    expect(result).toEqual([]);
  });
});
`;
  }

  private generateMochaScaffold(target: TestTarget): string {
    const functionName = target.function || 'myFunction';

    return `import { expect } from 'chai';
import { ${functionName} } from './${target.file.replace(/\.(ts|js)$/, '')}';

describe('${functionName}', () => {
  it('should handle happy path', () => {
    // Arrange
    const input = {};

    // Act
    const result = ${functionName}(input);

    // Assert
    expect(result).to.exist;
  });

  it('should handle error cases', () => {
    // Arrange
    const invalidInput = null;

    // Act & Assert
    expect(() => ${functionName}(invalidInput)).to.throw();
  });

  it('should handle edge cases', () => {
    // Arrange
    const edgeInput = [];

    // Act
    const result = ${functionName}(edgeInput);

    // Assert
    expect(result).to.deep.equal([]);
  });
});
`;
  }
}

/**
 * Singleton instance
 */
export const typescriptAdapter = new TypeScriptAdapter();

/**
 * Default export
 */
export default TypeScriptAdapter;

