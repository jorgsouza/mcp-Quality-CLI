/**
 * Python Test Runner
 * 
 * Executa testes Python (pytest/unittest) e coleta métricas de cobertura.
 * Integra com coverage.py e pytest-cov.
 * 
 * FASE C.1 - Python Runner
 * 
 * @see ROADMAP-V1-COMPLETO.md (Fase C.1)
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TestResult, RunOptions } from '../adapters/base/LanguageAdapter.js';

/**
 * Opções específicas para pytest
 */
export interface PytestRunOptions extends RunOptions {
  /** Markers para filtrar testes (ex: 'unit', 'integration', 'slow') */
  markers?: string[];
  /** Capturar output (default: false) */
  capture?: boolean;
  /** Modo verbose */
  verbose?: boolean;
  /** Gerar relatório HTML de cobertura */
  htmlCov?: boolean;
  /** Diretório de saída do coverage HTML */
  htmlCovDir?: string;
}

/**
 * Executa testes pytest com coverage
 * 
 * @param repo - Caminho do repositório
 * @param options - Opções de execução
 * @returns Resultado dos testes
 * 
 * @example
 * ```typescript
 * const result = await runPytest('/my-project', {
 *   coverage: true,
 *   markers: ['unit', 'integration'],
 *   maxWorkers: 4
 * });
 * 
 * console.log(`${result.passed}/${result.totalTests} passed`);
 * console.log(`Coverage: ${result.coverage?.lines.pct}%`);
 * ```
 */
export async function runPytest(
  repo: string,
  options: PytestRunOptions = {}
): Promise<TestResult> {
  // Verificar se pytest está instalado
  try {
    execSync('python -m pytest --version', { stdio: 'pipe', cwd: repo });
  } catch {
    throw new Error('pytest não encontrado. Execute: pip install pytest');
  }

  // Construir comando
  let command = 'python -m pytest';

  // Adicionar flags
  if (options.verbose) {
    command += ' -v';
  } else {
    command += ' -q'; // quiet
  }

  // Coverage
  if (options.coverage) {
    try {
      execSync('python -m pytest_cov --version', { stdio: 'pipe', cwd: repo });
      command += ' --cov=. --cov-report=xml --cov-report=term';
      
      if (options.htmlCov) {
        const htmlDir = options.htmlCovDir || 'htmlcov';
        command += ` --cov-report=html:${htmlDir}`;
      }
    } catch {
      console.warn('⚠️  pytest-cov não instalado. Coverage desabilitado.');
      console.warn('   Execute: pip install pytest-cov');
    }
  }

  // Paralelismo (pytest-xdist)
  if (options.parallel !== false && options.maxWorkers) {
    try {
      execSync('python -m pytest_xdist --version', { stdio: 'pipe', cwd: repo });
      command += ` -n ${options.maxWorkers}`;
    } catch {
      console.warn('⚠️  pytest-xdist não instalado. Paralelismo desabilitado.');
      console.warn('   Execute: pip install pytest-xdist');
    }
  }

  // Markers (filtros)
  if (options.markers && options.markers.length > 0) {
    command += ` -m "${options.markers.join(' or ')}"`;
  }

  // Tags (usando expressões)
  if (options.tags && options.tags.length > 0) {
    // pytest usa -k para filtrar por nome
    const tagExpr = options.tags.map(t => t.replace('@', '')).join(' or ');
    command += ` -k "${tagExpr}"`;
  }

  // Arquivos específicos
  if (options.files && options.files.length > 0) {
    command += ` ${options.files.join(' ')}`;
  }

  // Timeout
  if (options.timeout) {
    command += ` --timeout=${Math.floor(options.timeout / 1000)}`;
  }

  // Executar pytest
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
        PYTHONPATH: repo, // Adicionar repo ao PYTHONPATH
      },
    });
  } catch (error: any) {
    ok = false;
    output = error.stdout || error.stderr || '';
  }

  // Parsear resultado
  return parsePytestOutput(output, ok, options.coverage);
}

/**
 * Executa unittest (framework built-in do Python)
 * 
 * @param repo - Caminho do repositório
 * @param options - Opções de execução
 * @returns Resultado dos testes
 * 
 * @example
 * ```typescript
 * const result = await runUnittest('/my-project', {
 *   coverage: true
 * });
 * ```
 */
export async function runUnittest(
  repo: string,
  options: RunOptions = {}
): Promise<TestResult> {
  let command = 'python -m unittest discover';

  // Adicionar flags
  command += ' -v'; // verbose

  // Arquivos específicos
  if (options.files && options.files.length > 0) {
    command = `python -m unittest ${options.files.join(' ')}`;
  }

  // Se coverage está habilitado, usar coverage.py
  if (options.coverage) {
    try {
      execSync('python -m coverage --version', { stdio: 'pipe', cwd: repo });
      command = `python -m coverage run -m ${command.replace('python -m ', '')}`;
    } catch {
      console.warn('⚠️  coverage não instalado. Execute: pip install coverage');
    }
  }

  // Executar unittest
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
        PYTHONPATH: repo,
      },
    });

    // Se usou coverage, gerar relatório
    if (options.coverage) {
      try {
        const coverageOutput = execSync('python -m coverage xml', {
          cwd: repo,
          encoding: 'utf-8',
          stdio: 'pipe',
        });
        output += '\n' + coverageOutput;
      } catch (error) {
        console.warn('⚠️  Erro ao gerar relatório de coverage');
      }
    }
  } catch (error: any) {
    ok = false;
    output = error.stdout || error.stderr || '';
  }

  // Parsear resultado
  return parseUnittestOutput(output, ok);
}

/**
 * Parseia output do pytest
 */
function parsePytestOutput(output: string, ok: boolean, hasCoverage?: boolean): TestResult {
  // Formato pytest:
  // "test_file.py::test_function PASSED"
  // "===== 25 passed, 2 failed, 1 skipped in 2.34s ====="

  const passedMatch = output.match(/(\d+)\s+passed/);
  const failedMatch = output.match(/(\d+)\s+failed/);
  const skippedMatch = output.match(/(\d+)\s+skipped/);
  const durationMatch = output.match(/in\s+([\d.]+)s/);

  const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
  const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
  const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;
  const totalTests = passed + failed + skipped;
  const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;

  // Extrair falhas
  const failures = extractPytestFailures(output);

  // Extrair cobertura (se disponível no output)
  let coverage;
  if (hasCoverage) {
    const coverageMatch = output.match(/TOTAL\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)%/);
    if (coverageMatch) {
      const coveragePct = parseInt(coverageMatch[1]);
      coverage = {
        lines: { total: 100, covered: coveragePct, skipped: 0, pct: coveragePct },
        functions: { total: 0, covered: 0, skipped: 0, pct: 0 },
        branches: { total: 0, covered: 0, skipped: 0, pct: 0 },
        statements: { total: 100, covered: coveragePct, skipped: 0, pct: coveragePct },
      };
    }
  }

  return {
    ok,
    framework: 'pytest',
    totalTests,
    passed,
    failed,
    skipped,
    duration,
    coverage,
    failures,
    output,
  };
}

/**
 * Parseia output do unittest
 */
function parseUnittestOutput(output: string, ok: boolean): TestResult {
  // Formato unittest:
  // "Ran 25 tests in 2.340s"
  // "OK" ou "FAILED (failures=2, errors=1)"

  const ranMatch = output.match(/Ran\s+(\d+)\s+tests?\s+in\s+([\d.]+)s/);
  const failuresMatch = output.match(/failures=(\d+)/);
  const errorsMatch = output.match(/errors=(\d+)/);

  const totalTests = ranMatch ? parseInt(ranMatch[1]) : 0;
  const duration = ranMatch ? parseFloat(ranMatch[2]) : 0;
  const failures = failuresMatch ? parseInt(failuresMatch[1]) : 0;
  const errors = errorsMatch ? parseInt(errorsMatch[1]) : 0;
  const failed = failures + errors;
  const passed = totalTests - failed;

  return {
    ok,
    framework: 'unittest',
    totalTests,
    passed,
    failed,
    skipped: 0,
    duration,
    output,
  };
}

/**
 * Extrai informações de falhas do output pytest
 */
function extractPytestFailures(output: string): Array<{
  testName: string;
  file: string;
  line?: number;
  error: string;
  stack?: string;
}> {
  const failures: Array<{
    testName: string;
    file: string;
    line?: number;
    error: string;
    stack?: string;
  }> = [];

  // Regex simplificado para capturar falhas
  // FAILED test_file.py::test_function - AssertionError: ...
  const failureRegex = /FAILED\s+(.+?)::(.+?)\s+-\s+(.+)/g;
  let match;

  while ((match = failureRegex.exec(output)) !== null) {
    const file = match[1];
    const testName = match[2];
    const error = match[3];

    failures.push({
      testName,
      file,
      error,
    });
  }

  return failures;
}

/**
 * Verifica se pytest está disponível
 * 
 * @param repo - Caminho do repositório
 * @returns True se pytest está instalado
 */
export function isPytestAvailable(repo: string): boolean {
  try {
    execSync('python -m pytest --version', { stdio: 'pipe', cwd: repo });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica se coverage.py está disponível
 * 
 * @param repo - Caminho do repositório
 * @returns True se coverage está instalado
 */
export function isCoverageAvailable(repo: string): boolean {
  try {
    execSync('python -m coverage --version', { stdio: 'pipe', cwd: repo });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica se pytest-cov está disponível
 * 
 * @param repo - Caminho do repositório
 * @returns True se pytest-cov está instalado
 */
export function isPytestCovAvailable(repo: string): boolean {
  try {
    execSync('python -m pytest_cov --version', { stdio: 'pipe', cwd: repo });
    return true;
  } catch {
    return false;
  }
}

/**
 * Retorna comandos de instalação recomendados
 * 
 * @returns Comandos de instalação
 */
export function getInstallCommands(): {
  pytest: string;
  coverage: string;
  pytestCov: string;
  pytestXdist: string;
  all: string;
} {
  return {
    pytest: 'pip install pytest',
    coverage: 'pip install coverage',
    pytestCov: 'pip install pytest-cov',
    pytestXdist: 'pip install pytest-xdist',
    all: 'pip install pytest pytest-cov pytest-xdist coverage',
  };
}

