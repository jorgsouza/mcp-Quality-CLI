/**
 * Go Language Adapter
 * 
 * Implementa LanguageAdapter para Go usando:
 * - go test para testes
 * - go test -cover para cobertura
 * - go-mutesting para mutation testing
 * 
 * FASE A.4 - Implementação do GoAdapter
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
 * Go Adapter
 * 
 * Suporta:
 * - Framework: go test (built-in)
 * - Coverage: go test -cover (built-in)
 * - Mutation: go-mutesting
 */
export class GoAdapter implements LanguageAdapter {
  readonly language = 'go';
  readonly fileExtensions = ['.go'];

  /**
   * Detecta framework de testes Go (sempre go test)
   */
  async detectFramework(repo: string): Promise<Framework | null> {
    // Verificar se é projeto Go
    if (!existsSync(join(repo, 'go.mod')) && !existsSync(join(repo, 'go.sum'))) {
      return null;
    }

    // Verificar se tem arquivos *_test.go
    const testFiles = await glob('**/*_test.go', {
      cwd: repo,
      ignore: ['**/vendor/**', '**/node_modules/**'],
    });

    if (testFiles.length === 0) {
      return null;
    }

    // Go test é built-in
    const version = await this.getGoVersion(repo);

    return {
      name: 'go test',
      version,
      testDir: '.', // Go tests vivem junto com o código
      coverageTool: 'go test -cover',
      mutationTool: 'go-mutesting',
    };
  }

  /**
   * Descobre arquivos de teste Go
   */
  async discoverTests(
    repo: string,
    options?: { types?: string[]; patterns?: string[] }
  ): Promise<TestFile[]> {
    const tests: TestFile[] = [];

    // Padrões padrão para Go
    const defaultPatterns = ['**/*_test.go'];

    const patterns = options?.patterns || defaultPatterns;

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: repo,
        ignore: ['**/vendor/**', '**/node_modules/**'],
      });

      for (const file of files) {
        const filePath = join(repo, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Detectar tipo de teste
        const type = this.detectTestType(file, content);

        // Contar testes
        const testCount = this.countTests(content);

        tests.push({
          path: relative(repo, filePath),
          type,
          language: 'go',
          framework: 'go test',
          testCount,
        });
      }
    }

    return tests;
  }

  /**
   * Executa testes Go
   */
  async runTests(repo: string, options: RunOptions = {}): Promise<TestResult> {
    const framework = await this.detectFramework(repo);

    if (!framework) {
      throw new Error('Nenhum projeto Go detectado (falta go.mod ou *_test.go)');
    }

    let command = 'go test';
    let output = '';

    try {
      // Opções go test
      if (options.coverage) {
        command += ' -cover -coverprofile=coverage.out';
      }

      command += ' -v'; // verbose

      if (options.parallel !== false) {
        command += ` -parallel ${options.maxWorkers || 4}`;
      }

      if (options.timeout) {
        command += ` -timeout ${options.timeout}ms`;
      }

      if (options.tags && options.tags.length > 0) {
        // Go usa build tags: -tags=integration,smoke
        command += ` -tags=${options.tags.join(',')}`;
      }

      // Testar todos os pacotes
      if (options.files && options.files.length > 0) {
        command += ` ${options.files.join(' ')}`;
      } else {
        command += ' ./...'; // Todos os pacotes
      }

      output = execSync(command, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, ...options.env },
      });

      // Parsear resultado
      return this.parseTestOutput(output, true, options.coverage);
    } catch (error: any) {
      // Teste falhou
      output = error.stdout || error.stderr || '';
      return this.parseTestOutput(output, false, options.coverage);
    }
  }

  /**
   * Faz parsing de arquivo de cobertura Go
   */
  async parseCoverage(coverageFile: string): Promise<Coverage> {
    // Go gera coverage.out (formato próprio)
    // Pode ser convertido para HTML com: go tool cover -html=coverage.out

    if (!existsSync(coverageFile)) {
      throw new Error(`Arquivo de cobertura não encontrado: ${coverageFile}`);
    }

    if (coverageFile.endsWith('.out')) {
      return this.parseGoCoverageOut(coverageFile);
    }

    throw new Error(`Formato de cobertura não suportado: ${coverageFile}`);
  }

  /**
   * Executa mutation testing com go-mutesting
   */
  async runMutation(
    repo: string,
    targets: string[],
    options?: { threshold?: number; timeout?: number }
  ): Promise<MutationResult> {
    // Verificar se go-mutesting está instalado
    const hasMutesting = await this.hasGoPackage('github.com/zimmski/go-mutesting');

    if (!hasMutesting) {
      console.warn('⚠️  go-mutesting não instalado. Execute: go install github.com/zimmski/go-mutesting/cmd/go-mutesting@latest');
      return {
        ok: false,
        framework: 'go-mutesting',
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
      // Executar go-mutesting
      const targetPaths = targets.length > 0 ? targets.join(' ') : './...';
      const command = `go-mutesting ${targetPaths}`;

      const output = execSync(command, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: options?.timeout || 300000, // 5 min default
      });

      // Parsear relatório
      return this.parseMutationOutput(output, options?.threshold);
    } catch (error: any) {
      console.error('Erro ao executar go-mutesting:', error.message);
      // Tentar parsear output mesmo se falhou
      const output = error.stdout || error.stderr || '';
      return this.parseMutationOutput(output, options?.threshold);
    }
  }

  /**
   * Gera scaffold de teste Go
   */
  async scaffoldTest(target: TestTarget): Promise<string> {
    const functionName = target.function || 'MyFunction';

    if (target.type === 'unit') {
      return this.generateGoUnitScaffold(target.file, functionName);
    }

    if (target.type === 'integration') {
      return this.generateGoIntegrationScaffold(target.file, functionName);
    }

    if (target.type === 'e2e') {
      return this.generateGoE2EScaffold(target.file, functionName);
    }

    return this.generateGoUnitScaffold(target.file, functionName);
  }

  /**
   * 🆕 Garante dependências Go instaladas
   */
  async ensureDeps(repo: string, options?: { bootstrap?: boolean }): Promise<{
    ok: boolean;
    installed: string[];
    missing: string[];
    commands?: string[];
  }> {
    const installed: string[] = [];
    const missing: string[] = [];
    const commands: string[] = [];

    // Verificar Go
    try {
      const goVersion = execSync('go version', { encoding: 'utf-8', stdio: 'pipe' });
      installed.push(`Go: ${goVersion.trim()}`);
    } catch {
      missing.push('Go 1.19+');
      commands.push('# Ubuntu/Debian:\nsudo apt-get install -y golang');
      commands.push('# macOS:\nbrew install go');
    }

    // Verificar go.mod
    if (existsSync(join(repo, 'go.mod'))) {
      installed.push('go.mod');
    } else {
      missing.push('go.mod');
      commands.push('# Inicializar módulo Go:\ngo mod init <module-name>');
    }

    // Verificar go-mutesting (opcional)
    if (await this.hasGoPackage('github.com/zimmski/go-mutesting')) {
      installed.push('go-mutesting');
    }

    // Verificar gotestsum (opcional)
    if (await this.hasGoPackage('gotest.tools/gotestsum')) {
      installed.push('gotestsum');
    }

    // Verificar pact-go (opcional)
    if (await this.hasGoPackage('github.com/pact-foundation/pact-go')) {
      installed.push('pact-go');
    }

    return {
      ok: missing.length === 0,
      installed,
      missing,
      commands: missing.length > 0 ? commands : undefined,
    };
  }

  /**
   * 🆕 Descobre contratos Pact (Go)
   */
  async discoverContracts(repo: string): Promise<Array<{
    file: string;
    consumer: string;
    provider: string;
    type: 'consumer' | 'provider';
  }>> {
    const contracts: Array<{
      file: string;
      consumer: string;
      provider: string;
      type: 'consumer' | 'provider';
    }> = [];

    // Go Pact: pacts/*.json
    const pactDirs = [
      join(repo, 'pacts'),
      join(repo, 'test', 'pacts'),
    ];

    for (const pactDir of pactDirs) {
      if (!existsSync(pactDir)) continue;

      try {
        const files = await glob('*.json', { cwd: pactDir });

        for (const file of files) {
          try {
            const fullPath = join(pactDir, file);
            const content = readFileSync(fullPath, 'utf-8');
            const pact = JSON.parse(content);

            contracts.push({
              file: fullPath.replace(repo + '/', ''),
              consumer: pact.consumer?.name || 'unknown',
              provider: pact.provider?.name || 'unknown',
              type: 'consumer',
            });
          } catch {
            // Ignorar arquivos inválidos
          }
        }
      } catch {
        // Ignorar erro de glob
      }
    }

    return contracts;
  }

  /**
   * 🆕 Verifica contratos Pact (Go)
   */
  async verifyContracts(repo: string, options?: {
    broker?: string;
    token?: string;
    provider?: string;
  }): Promise<{
    ok: boolean;
    total: number;
    verified: number;
    failed: number;
    results: Array<{
      contract: string;
      status: 'passed' | 'failed';
      message?: string;
    }>;
  }> {
    // Go Pact: executar testes que usam pact-go verifier
    const contracts = await this.discoverContracts(repo);

    if (contracts.length === 0) {
      return {
        ok: true,
        total: 0,
        verified: 0,
        failed: 0,
        results: [],
      };
    }

    // Executar testes provider (Go usa testes normais com pact-go)
    let output = '';
    let ok = true;

    try {
      output = execSync('go test ./... -v -tags=provider', {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 120000, // 2 min
      });
    } catch (error: any) {
      ok = false;
      output = error.stdout || error.stderr || error.message;
    }

    // Parse output (básico)
    const verified = ok ? contracts.length : 0;
    const failed = contracts.length - verified;

    return {
      ok,
      total: contracts.length,
      verified,
      failed,
      results: [], // TODO: Parsear resultados detalhados
    };
  }

  /**
   * Valida ambiente Go
   */
  async validate(repo: string): Promise<{
    ok: boolean;
    framework?: Framework;
    missing?: string[];
    warnings?: string[];
  }> {
    const depsResult = await this.ensureDeps(repo);
    const framework = await this.detectFramework(repo);

    return {
      ok: depsResult.ok,
      framework: framework || undefined,
      missing: depsResult.missing,
      warnings: [],
    };
  }

  // ==================== Helpers ====================

  private async getGoVersion(repo: string): Promise<string | undefined> {
    try {
      const output = execSync('go version', {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      // Output: "go version go1.21.0 linux/amd64"
      const versionMatch = output.match(/go(\d+\.\d+\.\d+)/);
      return versionMatch ? versionMatch[1] : undefined;
    } catch {
      return undefined;
    }
  }

  private async hasGoPackage(packageName: string): Promise<boolean> {
    try {
      execSync(`go list -m ${packageName}`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  private detectTestType(
    file: string,
    content: string
  ): 'unit' | 'integration' | 'e2e' | 'contract' | 'property' | 'approval' {
    // Go usa build tags para separar tipos de teste
    if (content.includes('//go:build integration') || content.includes('// +build integration')) {
      return 'integration';
    }
    if (content.includes('//go:build e2e') || content.includes('// +build e2e')) {
      return 'e2e';
    }
    if (file.includes('_contract_test.go')) return 'contract';
    return 'unit';
  }

  private countTests(content: string): number {
    // Contar funções que começam com Test
    const testRegex = /func Test\w+\(/g;
    const matches = content.match(testRegex);
    return matches ? matches.length : 0;
  }

  private parseTestOutput(output: string, ok: boolean, coverage?: boolean): TestResult {
    // Parsing simplificado - go test output
    // Exemplo: "PASS\nok  \tpackage\t0.123s"
    // Exemplo com falha: "FAIL\tpackage\t0.456s"

    const passedMatch = output.match(/PASS/g);
    const failedMatch = output.match(/FAIL/g);
    const durationMatch = output.match(/(\d+\.\d+)s/);

    const passed = passedMatch ? passedMatch.length : 0;
    const failed = failedMatch ? failedMatch.length : 0;
    const totalTests = passed + failed;
    const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;

    // Extrair cobertura se disponível
    // "coverage: 85.5% of statements"
    let coverageData: Coverage | undefined;
    if (coverage) {
      const coverageMatch = output.match(/coverage:\s+([\d.]+)%/);
      if (coverageMatch) {
        const coveragePct = parseFloat(coverageMatch[1]);
        coverageData = {
          lines: { total: 100, covered: Math.round(coveragePct), skipped: 0, pct: coveragePct },
          functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
          branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
          statements: { total: 100, covered: Math.round(coveragePct), skipped: 0, pct: coveragePct },
        };
      }
    }

    return {
      ok,
      framework: 'go test',
      totalTests,
      passed,
      failed,
      skipped: 0,
      duration,
      coverage: coverageData,
      output,
    };
  }

  private async parseGoCoverageOut(filePath: string): Promise<Coverage> {
    // Parse coverage.out format
    // mode: set
    // package/file.go:10.5,12.2 1 1
    // package/file.go:14.5,16.2 2 0

    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line && !line.startsWith('mode:'));

    let totalStatements = 0;
    let coveredStatements = 0;

    for (const line of lines) {
      const parts = line.split(' ');
      if (parts.length >= 3) {
        const statements = parseInt(parts[1]);
        const covered = parseInt(parts[2]);

        totalStatements += statements;
        if (covered > 0) {
          coveredStatements += statements;
        }
      }
    }

    const pct = totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0;

    return {
      lines: { total: totalStatements, covered: coveredStatements, skipped: 0, pct },
      functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
      branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
      statements: { total: totalStatements, covered: coveredStatements, skipped: 0, pct },
    };
  }

  private parseMutationOutput(output: string, threshold = 0.5): MutationResult {
    // go-mutesting output format
    // "12 passed, 3 failed, 2 skipped"

    const passedMatch = output.match(/(\d+)\s+passed/);
    const failedMatch = output.match(/(\d+)\s+failed/);
    const skippedMatch = output.match(/(\d+)\s+skipped/);

    const killed = passedMatch ? parseInt(passedMatch[1]) : 0;
    const survived = failedMatch ? parseInt(failedMatch[1]) : 0;
    const timeout = skippedMatch ? parseInt(skippedMatch[1]) : 0;
    const noCoverage = 0;

    const totalMutants = killed + survived + timeout;
    const score = totalMutants > 0 ? killed / totalMutants : 0;
    const ok = score >= threshold;

    return {
      ok,
      framework: 'go-mutesting',
      totalMutants,
      killed,
      survived,
      timeout,
      noCoverage,
      score,
      threshold,
    };
  }

  private generateGoUnitScaffold(file: string, functionName: string): string {
    const packageName = 'main'; // Simplificado - em produção, extrair do arquivo

    return `package ${packageName}

import (
\t"testing"
)

// Test${functionName} tests the ${functionName} function
func Test${functionName}(t *testing.T) {
\t// Arrange
\tinput := ""

\t// Act
\tresult := ${functionName}(input)

\t// Assert
\tif result == "" {
\t\tt.Errorf("Expected non-empty result, got empty string")
\t}
}

// Test${functionName}_ErrorCase tests error handling
func Test${functionName}_ErrorCase(t *testing.T) {
\t// Arrange
\tinvalidInput := ""

\t// Act
\tresult, err := ${functionName}(invalidInput)

\t// Assert
\tif err == nil {
\t\tt.Errorf("Expected error, got nil")
\t}
\tif result != "" {
\t\tt.Errorf("Expected empty result on error, got %s", result)
\t}
}

// Test${functionName}_EdgeCases tests edge cases
func Test${functionName}_EdgeCases(t *testing.T) {
\ttestCases := []struct {
\t\tname     string
\t\tinput    string
\t\texpected string
\t}{
\t\t{"empty string", "", ""},
\t\t{"single char", "a", "a"},
\t\t{"unicode", "你好", "你好"},
\t}

\tfor _, tc := range testCases {
\t\tt.Run(tc.name, func(t *testing.T) {
\t\t\tresult := ${functionName}(tc.input)
\t\t\tif result != tc.expected {
\t\t\t\tt.Errorf("Expected %s, got %s", tc.expected, result)
\t\t\t}
\t\t})
\t}
}
`;
  }

  private generateGoIntegrationScaffold(file: string, functionName: string): string {
    const packageName = 'main';

    return `//go:build integration
// +build integration

package ${packageName}

import (
\t"testing"
)

// Test${functionName}Integration tests ${functionName} with real dependencies
func Test${functionName}Integration(t *testing.T) {
\t// Skip if running in short mode
\tif testing.Short() {
\t\tt.Skip("Skipping integration test")
\t}

\t// Arrange
\t// Setup real dependencies here
\tinput := ""

\t// Act
\tresult := ${functionName}(input)

\t// Assert
\tif result == "" {
\t\tt.Errorf("Expected non-empty result")
\t}
}
`;
  }

  private generateGoE2EScaffold(file: string, functionName: string): string {
    const packageName = 'main';

    return `//go:build e2e
// +build e2e

package ${packageName}

import (
\t"testing"
)

// Test${functionName}E2E tests ${functionName} end-to-end
func Test${functionName}E2E(t *testing.T) {
\t// Skip if running in short mode
\tif testing.Short() {
\t\tt.Skip("Skipping E2E test")
\t}

\t// Arrange
\t// Setup complete system
\tinput := ""

\t// Act
\tresult := ${functionName}(input)

\t// Assert
\tif result == "" {
\t\tt.Errorf("Expected non-empty result")
\t}

\t// Cleanup
\t// Teardown system
}
`;
  }
}

/**
 * Singleton instance
 */
export const goAdapter = new GoAdapter();

/**
 * Default export
 */
export default GoAdapter;

