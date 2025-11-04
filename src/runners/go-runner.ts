/**
 * Go Test Runner
 * 
 * Executa testes Go (go test) e coleta métricas de cobertura.
 * Suporta build tags, paralelismo e coverage nativo.
 * 
 * FASE C.2 - Go Runner
 * 
 * @see ROADMAP-V1-COMPLETO.md (Fase C.2)
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TestResult, RunOptions } from '../adapters/base/LanguageAdapter.js';

/**
 * Opções específicas para go test
 */
export interface GoTestRunOptions extends RunOptions {
  /** Build tags para compilação condicional */
  buildTags?: string[];
  /** Modo short (pula testes longos) */
  short?: boolean;
  /** Modo race detector */
  race?: boolean;
  /** Gerar profile de CPU */
  cpuProfile?: string;
  /** Gerar profile de memória */
  memProfile?: string;
  /** Modo bench (executar benchmarks) */
  bench?: boolean;
  /** Pattern de benchmarks */
  benchPattern?: string;
}

/**
 * Executa testes Go com coverage
 * 
 * @param repo - Caminho do repositório
 * @param options - Opções de execução
 * @returns Resultado dos testes
 * 
 * @example
 * ```typescript
 * const result = await runGoTest('/my-project', {
 *   coverage: true,
 *   buildTags: ['integration'],
 *   race: true,
 *   parallel: true,
 *   maxWorkers: 8
 * });
 * 
 * console.log(`${result.passed}/${result.totalTests} passed`);
 * console.log(`Coverage: ${result.coverage?.statements.pct}%`);
 * ```
 */
export async function runGoTest(
  repo: string,
  options: GoTestRunOptions = {}
): Promise<TestResult> {
  // Verificar se Go está instalado
  try {
    execSync('go version', { stdio: 'pipe', cwd: repo });
  } catch {
    throw new Error('Go não encontrado. Instale Go: https://golang.org/dl/');
  }

  // Verificar se é projeto Go
  if (!existsSync(join(repo, 'go.mod')) && !existsSync(join(repo, 'go.sum'))) {
    throw new Error('Não é um projeto Go (falta go.mod). Execute: go mod init');
  }

  // Construir comando
  let command = 'go test';

  // Adicionar flags
  command += ' -v'; // verbose

  // Coverage
  if (options.coverage) {
    command += ' -cover -coverprofile=coverage.out -covermode=atomic';
  }

  // Race detector
  if (options.race) {
    command += ' -race';
  }

  // Short mode
  if (options.short) {
    command += ' -short';
  }

  // Paralelismo
  if (options.parallel !== false) {
    const workers = options.maxWorkers || 4;
    command += ` -parallel ${workers}`;
  }

  // Timeout
  if (options.timeout) {
    const timeoutSec = Math.floor(options.timeout / 1000);
    command += ` -timeout ${timeoutSec}s`;
  }

  // Build tags
  if (options.buildTags && options.buildTags.length > 0) {
    command += ` -tags=${options.buildTags.join(',')}`;
  }

  // CPU Profile
  if (options.cpuProfile) {
    command += ` -cpuprofile=${options.cpuProfile}`;
  }

  // Memory Profile
  if (options.memProfile) {
    command += ` -memprofile=${options.memProfile}`;
  }

  // Benchmarks
  if (options.bench) {
    const pattern = options.benchPattern || '.';
    command += ` -bench=${pattern}`;
  }

  // Arquivos/pacotes específicos
  if (options.files && options.files.length > 0) {
    command += ` ${options.files.join(' ')}`;
  } else {
    command += ' ./...'; // Todos os pacotes
  }

  // Executar go test
  let output = '';
  let ok = true;

  try {
    output = execSync(command, {
      cwd: repo,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: {
        ...process.env,
        ...options.env,
      },
    });
  } catch (error: any) {
    ok = false;
    output = error.stdout || error.stderr || '';
  }

  // Parsear resultado
  return parseGoTestOutput(output, ok, options.coverage);
}

/**
 * Executa apenas testes de unidade (sem build tags)
 * 
 * @param repo - Caminho do repositório
 * @param options - Opções de execução
 * @returns Resultado dos testes
 */
export async function runGoUnitTests(
  repo: string,
  options: Omit<GoTestRunOptions, 'buildTags'> = {}
): Promise<TestResult> {
  return runGoTest(repo, {
    ...options,
    short: true, // Pula testes longos
  });
}

/**
 * Executa testes de integração (com build tag 'integration')
 * 
 * @param repo - Caminho do repositório
 * @param options - Opções de execução
 * @returns Resultado dos testes
 */
export async function runGoIntegrationTests(
  repo: string,
  options: Omit<GoTestRunOptions, 'buildTags'> = {}
): Promise<TestResult> {
  return runGoTest(repo, {
    ...options,
    buildTags: ['integration'],
  });
}

/**
 * Executa testes E2E (com build tag 'e2e')
 * 
 * @param repo - Caminho do repositório
 * @param options - Opções de execução
 * @returns Resultado dos testes
 */
export async function runGoE2ETests(
  repo: string,
  options: Omit<GoTestRunOptions, 'buildTags'> = {}
): Promise<TestResult> {
  return runGoTest(repo, {
    ...options,
    buildTags: ['e2e'],
  });
}

/**
 * Parseia output do go test
 */
function parseGoTestOutput(output: string, ok: boolean, hasCoverage?: boolean): TestResult {
  // Formato go test:
  // "=== RUN   TestFunction"
  // "--- PASS: TestFunction (0.00s)"
  // "PASS"
  // "ok  \tpackage\t0.123s\tcoverage: 85.5% of statements"

  const lines = output.split('\n');
  
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let duration = 0;
  const failures: Array<{
    testName: string;
    file: string;
    line?: number;
    error: string;
    stack?: string;
  }> = [];

  for (const line of lines) {
    // Contar PASS
    if (line.includes('--- PASS:')) {
      passed++;
    }

    // Contar FAIL
    if (line.includes('--- FAIL:')) {
      failed++;
      const testName = line.match(/--- FAIL:\s+(.+?)\s+\(/)?.[1] || 'unknown';
      failures.push({
        testName,
        file: '',
        error: 'Test failed',
      });
    }

    // Contar SKIP
    if (line.includes('--- SKIP:')) {
      skipped++;
    }

    // Extrair duração
    const durationMatch = line.match(/(\d+\.\d+)s/);
    if (durationMatch && line.includes('ok')) {
      duration = parseFloat(durationMatch[1]);
    }
  }

  const totalTests = passed + failed + skipped;

  // Extrair cobertura (se disponível)
  let coverage;
  if (hasCoverage) {
    const coverageMatch = output.match(/coverage:\s+([\d.]+)%\s+of\s+statements/);
    if (coverageMatch) {
      const coveragePct = parseFloat(coverageMatch[1]);
      coverage = {
        lines: { total: 0, covered: 0, skipped: 0, pct: 0 },
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
    skipped,
    duration,
    coverage,
    failures: failures.length > 0 ? failures : undefined,
    output,
  };
}

/**
 * Verifica se Go está disponível
 * 
 * @param repo - Caminho do repositório
 * @returns True se Go está instalado
 */
export function isGoAvailable(repo?: string): boolean {
  try {
    execSync('go version', { stdio: 'pipe', cwd: repo });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica se é um projeto Go válido
 * 
 * @param repo - Caminho do repositório
 * @returns True se tem go.mod
 */
export function isGoProject(repo: string): boolean {
  return existsSync(join(repo, 'go.mod'));
}

/**
 * Verifica versão do Go
 * 
 * @param repo - Caminho do repositório
 * @returns Versão do Go (ex: "1.21.0")
 */
export function getGoVersion(repo?: string): string | null {
  try {
    const output = execSync('go version', { encoding: 'utf-8', stdio: 'pipe', cwd: repo });
    const match = output.match(/go(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Lista pacotes Go no projeto
 * 
 * @param repo - Caminho do repositório
 * @returns Lista de pacotes
 */
export function listGoPackages(repo: string): string[] {
  try {
    const output = execSync('go list ./...', {
      cwd: repo,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Lista arquivos de teste Go
 * 
 * @param repo - Caminho do repositório
 * @returns Lista de arquivos *_test.go
 */
export function listGoTestFiles(repo: string): string[] {
  try {
    const output = execSync('find . -name "*_test.go" -type f', {
      cwd: repo,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return output.trim().split('\n').filter(Boolean).map(f => f.replace('./', ''));
  } catch {
    return [];
  }
}

/**
 * Baixa dependências Go
 * 
 * @param repo - Caminho do repositório
 * @returns True se sucesso
 */
export function downloadGoDeps(repo: string): boolean {
  try {
    execSync('go mod download', {
      cwd: repo,
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica se gotestsum está disponível (melhor output)
 * 
 * @returns True se gotestsum está instalado
 */
export function isGotestsumAvailable(): boolean {
  try {
    execSync('gotestsum --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Executa testes com gotestsum (se disponível)
 * 
 * @param repo - Caminho do repositório
 * @param options - Opções de execução
 * @returns Resultado dos testes
 */
export async function runGoTestWithGotestsum(
  repo: string,
  options: GoTestRunOptions = {}
): Promise<TestResult> {
  if (!isGotestsumAvailable()) {
    console.warn('⚠️  gotestsum não instalado. Usando go test padrão.');
    console.warn('   Execute: go install gotest.tools/gotestsum@latest');
    return runGoTest(repo, options);
  }

  // gotestsum wrapper around go test
  let command = 'gotestsum --format testname';

  // Passar flags para go test
  command += ' --';

  // Adicionar mesmas flags do go test
  if (options.coverage) {
    command += ' -cover -coverprofile=coverage.out';
  }

  if (options.race) {
    command += ' -race';
  }

  if (options.short) {
    command += ' -short';
  }

  if (options.parallel !== false) {
    const workers = options.maxWorkers || 4;
    command += ` -parallel ${workers}`;
  }

  if (options.buildTags && options.buildTags.length > 0) {
    command += ` -tags=${options.buildTags.join(',')}`;
  }

  command += ' ./...';

  // Executar
  let output = '';
  let ok = true;

  try {
    output = execSync(command, {
      cwd: repo,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: { ...process.env, ...options.env },
    });
  } catch (error: any) {
    ok = false;
    output = error.stdout || error.stderr || '';
  }

  // Parse (gotestsum tem output similar ao go test)
  return parseGoTestOutput(output, ok, options.coverage);
}

/**
 * Retorna comandos de instalação recomendados
 * 
 * @returns Comandos de instalação
 */
export function getInstallCommands(): {
  go: string;
  gotestsum: string;
  gocov: string;
  all: string;
} {
  return {
    go: 'Download from: https://golang.org/dl/',
    gotestsum: 'go install gotest.tools/gotestsum@latest',
    gocov: 'go install github.com/axw/gocov/gocov@latest',
    all: 'go install gotest.tools/gotestsum@latest && go install github.com/axw/gocov/gocov@latest',
  };
}

