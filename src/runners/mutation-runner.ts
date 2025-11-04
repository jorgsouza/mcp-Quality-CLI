/**
 * Mutation Testing Runner
 * 
 * Executa mutation testing para múltiplas linguagens:
 * - Stryker (TypeScript/JavaScript)
 * - mutmut (Python)
 * - go-mutesting (Go)
 * 
 * FASE C.4 - Mutation Multi-Linguagem
 * 
 * @see ROADMAP-V1-COMPLETO.md (Fase C.4)
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MutationResult, Mutation } from '../adapters/base/LanguageAdapter.js';

/**
 * Opções para mutation testing
 */
export interface MutationOptions {
  /** Arquivos/diretórios alvo */
  targets?: string[];
  /** Threshold mínimo de mutation score (0-1) */
  threshold?: number;
  /** Timeout por mutante (ms) */
  timeout?: number;
  /** Número de mutantes em paralelo */
  concurrency?: number;
  /** Ignorar cache */
  noCache?: boolean;
  /** Modo incremental (apenas código alterado) */
  incremental?: boolean;
}

/**
 * Executa mutation testing com Stryker (TypeScript/JavaScript)
 * 
 * @param repo - Caminho do repositório
 * @param options - Opções de mutation
 * @returns Resultado do mutation testing
 * 
 * @example
 * ```typescript
 * const result = await runStryker('/my-project', {
 *   targets: ['src/billing.ts'],
 *   threshold: 0.8,
 *   timeout: 5000
 * });
 * 
 * console.log(`Mutation score: ${result.score * 100}%`);
 * console.log(`Killed: ${result.killed}, Survived: ${result.survived}`);
 * ```
 */
export async function runStryker(
  repo: string,
  options: MutationOptions = {}
): Promise<MutationResult> {
  // Verificar se Stryker está instalado
  if (!isStrykerAvailable(repo)) {
    throw new Error(
      'Stryker não encontrado. Execute: npm install -D @stryker-mutator/core @stryker-mutator/vitest-runner'
    );
  }

  // Construir comando
  let command = 'npx stryker run';

  // Arquivos específicos
  if (options.targets && options.targets.length > 0) {
    // Stryker usa mutate pattern no config
    console.log(`🎯 Alvos: ${options.targets.join(', ')}`);
  }

  // Flags
  if (options.noCache) {
    command += ' --force';
  }

  if (options.incremental) {
    command += ' --incremental';
  }

  if (options.concurrency) {
    command += ` --concurrency ${options.concurrency}`;
  }

  if (options.timeout) {
    command += ` --timeoutMS ${options.timeout}`;
  }

  // Executar
  let output = '';
  let ok = true;

  try {
    output = execSync(command, {
      cwd: repo,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (error: any) {
    ok = false;
    output = error.stdout || error.stderr || '';
  }

  // Tentar ler reports/mutation/mutation.json
  const reportPath = join(repo, 'reports', 'mutation', 'mutation.json');
  if (existsSync(reportPath)) {
    return parseStrykerReport(reportPath, ok);
  }

  // Fallback: parsear output
  return parseStrykerOutput(output, ok);
}

/**
 * Executa mutation testing com mutmut (Python)
 * 
 * @param repo - Caminho do repositório
 * @param options - Opções de mutation
 * @returns Resultado do mutation testing
 * 
 * @example
 * ```typescript
 * const result = await runMutmut('/my-python-project', {
 *   targets: ['src/billing.py'],
 *   threshold: 0.75
 * });
 * ```
 */
export async function runMutmut(
  repo: string,
  options: MutationOptions = {}
): Promise<MutationResult> {
  // Verificar se mutmut está instalado
  if (!isMutmutAvailable()) {
    throw new Error('mutmut não encontrado. Execute: pip install mutmut');
  }

  // Limpar cache se necessário
  if (options.noCache) {
    try {
      execSync('mutmut clear-cache', { cwd: repo, stdio: 'pipe' });
    } catch {
      // Ignorar erro
    }
  }

  // Construir comando
  let command = 'mutmut run';

  // Arquivos específicos
  if (options.targets && options.targets.length > 0) {
    command += ` --paths-to-mutate ${options.targets.join(',')}`;
  }

  // Executar mutation
  let runOutput = '';
  try {
    runOutput = execSync(command, {
      cwd: repo,
      encoding: 'utf-8',
      stdio: 'pipe',
      env: {
        ...process.env,
        PYTHONPATH: repo,
      },
    });
  } catch (error: any) {
    runOutput = error.stdout || error.stderr || '';
  }

  // Obter resultados
  let resultsOutput = '';
  try {
    resultsOutput = execSync('mutmut results', {
      cwd: repo,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (error: any) {
    resultsOutput = error.stdout || error.stderr || '';
  }

  // Parsear
  return parseMutmutOutput(runOutput + '\n' + resultsOutput);
}

/**
 * Executa mutation testing com go-mutesting (Go)
 * 
 * @param repo - Caminho do repositório
 * @param options - Opções de mutation
 * @returns Resultado do mutation testing
 * 
 * @example
 * ```typescript
 * const result = await runGoMutesting('/my-go-project', {
 *   targets: ['./pkg/billing'],
 *   threshold: 0.7
 * });
 * ```
 */
export async function runGoMutesting(
  repo: string,
  options: MutationOptions = {}
): Promise<MutationResult> {
  // Verificar se go-mutesting está instalado
  if (!isGoMutestingAvailable()) {
    throw new Error(
      'go-mutesting não encontrado. Execute: go install github.com/zimmski/go-mutesting/cmd/go-mutesting@latest'
    );
  }

  // Construir comando
  let command = 'go-mutesting';

  // Arquivos/pacotes específicos
  if (options.targets && options.targets.length > 0) {
    command += ` ${options.targets.join(' ')}`;
  } else {
    command += ' ./...';
  }

  // Executar
  let output = '';
  let ok = true;

  try {
    output = execSync(command, {
      cwd: repo,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (error: any) {
    ok = false;
    output = error.stdout || error.stderr || '';
  }

  // Parsear
  return parseGoMutestingOutput(output, ok);
}

/**
 * Parseia relatório JSON do Stryker
 */
function parseStrykerReport(reportPath: string, ok: boolean): MutationResult {
  const content = readFileSync(reportPath, 'utf-8');
  const data = JSON.parse(content);

  const files = data.files || {};
  const mutations: Mutation[] = [];

  let totalMutants = 0;
  let killed = 0;
  let survived = 0;
  let timeout = 0;
  let noCoverage = 0;

  for (const [filePath, fileData] of Object.entries(files)) {
    const mutants = (fileData as any).mutants || [];

    for (const mutant of mutants) {
      totalMutants++;

      const mutation: Mutation = {
        id: mutant.id,
        mutator: mutant.mutatorName,
        file: filePath,
        line: mutant.location?.start?.line || 0,
        original: mutant.replacement || '',
        mutated: mutant.mutatedCode || '',
        status: mutant.status,
      };

      mutations.push(mutation);

      // Contar status
      switch (mutant.status) {
        case 'Killed':
          killed++;
          break;
        case 'Survived':
          survived++;
          break;
        case 'Timeout':
          timeout++;
          break;
        case 'NoCoverage':
          noCoverage++;
          break;
      }
    }
  }

  const score = totalMutants > 0 ? killed / totalMutants : 0;

  return {
    ok,
    framework: 'stryker',
    totalMutants,
    killed,
    survived,
    timeout,
    noCoverage,
    score,
    mutations,
  };
}

/**
 * Parseia output do Stryker (fallback)
 */
function parseStrykerOutput(output: string, ok: boolean): MutationResult {
  // Formato: "Mutation score: 85.5%"
  const scoreMatch = output.match(/Mutation score[:\s]+([\d.]+)%/);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) / 100 : 0;

  const killedMatch = output.match(/Killed:\s+(\d+)/i);
  const survivedMatch = output.match(/Survived:\s+(\d+)/i);
  const timeoutMatch = output.match(/Timeout:\s+(\d+)/i);

  const killed = killedMatch ? parseInt(killedMatch[1]) : 0;
  const survived = survivedMatch ? parseInt(survivedMatch[1]) : 0;
  const timeout = timeoutMatch ? parseInt(timeoutMatch[1]) : 0;
  const totalMutants = killed + survived + timeout;

  return {
    ok,
    framework: 'stryker',
    totalMutants,
    killed,
    survived,
    timeout,
    noCoverage: 0,
    score,
    mutations: [],
  };
}

/**
 * Parseia output do mutmut
 */
function parseMutmutOutput(output: string): MutationResult {
  // Formato:
  // "Killed mutants: 85"
  // "Survived: 10"
  // "Timeout: 5"

  const killedMatch = output.match(/Killed mutants?:\s+(\d+)/i);
  const survivedMatch = output.match(/Survived:\s+(\d+)/i);
  const timeoutMatch = output.match(/Timeout:\s+(\d+)/i);
  const suspiciousMatch = output.match(/Suspicious:\s+(\d+)/i);

  const killed = killedMatch ? parseInt(killedMatch[1]) : 0;
  const survived = survivedMatch ? parseInt(survivedMatch[1]) : 0;
  const timeout = timeoutMatch ? parseInt(timeoutMatch[1]) : 0;
  const suspicious = suspiciousMatch ? parseInt(suspiciousMatch[1]) : 0;

  const totalMutants = killed + survived + timeout + suspicious;
  const score = totalMutants > 0 ? killed / totalMutants : 0;

  return {
    ok: true, // mutmut sempre retorna resultado
    framework: 'mutmut',
    totalMutants,
    killed,
    survived,
    timeout,
    noCoverage: suspicious, // mutmut usa "suspicious"
    score,
    mutations: [],
  };
}

/**
 * Parseia output do go-mutesting
 */
function parseGoMutestingOutput(output: string, ok: boolean): MutationResult {
  // go-mutesting output é mais simples
  const lines = output.split('\n');

  let totalMutants = 0;
  let killed = 0;

  for (const line of lines) {
    if (line.includes('PASS')) {
      totalMutants++;
      killed++;
    } else if (line.includes('FAIL')) {
      totalMutants++;
    }
  }

  const survived = totalMutants - killed;
  const score = totalMutants > 0 ? killed / totalMutants : 0;

  return {
    ok,
    framework: 'go-mutesting',
    totalMutants,
    killed,
    survived,
    timeout: 0,
    noCoverage: 0,
    score,
    mutations: [],
  };
}

/**
 * Verifica se Stryker está disponível
 */
export function isStrykerAvailable(repo: string): boolean {
  try {
    const packageJsonPath = join(repo, 'package.json');
    if (!existsSync(packageJsonPath)) return false;

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    return deps['@stryker-mutator/core'] !== undefined;
  } catch {
    return false;
  }
}

/**
 * Verifica se mutmut está disponível
 */
export function isMutmutAvailable(): boolean {
  try {
    execSync('mutmut --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica se go-mutesting está disponível
 */
export function isGoMutestingAvailable(): boolean {
  try {
    execSync('go-mutesting --help', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Detecta ferramenta de mutation automaticamente
 */
export function detectMutationTool(repo: string): string | null {
  if (isStrykerAvailable(repo)) return 'stryker';
  if (isMutmutAvailable()) return 'mutmut';
  if (isGoMutestingAvailable()) return 'go-mutesting';
  return null;
}

/**
 * Executa mutation testing automaticamente (detecta linguagem)
 */
export async function runMutationAuto(
  repo: string,
  options: MutationOptions = {}
): Promise<MutationResult> {
  const tool = detectMutationTool(repo);

  if (!tool) {
    throw new Error('Nenhuma ferramenta de mutation testing encontrada');
  }

  console.log(`🧬 Usando ${tool} para mutation testing...`);

  switch (tool) {
    case 'stryker':
      return runStryker(repo, options);
    case 'mutmut':
      return runMutmut(repo, options);
    case 'go-mutesting':
      return runGoMutesting(repo, options);
    default:
      throw new Error(`Ferramenta não suportada: ${tool}`);
  }
}

/**
 * Retorna comandos de instalação por linguagem
 */
export function getMutationInstallCommands(): {
  typescript: string;
  python: string;
  go: string;
} {
  return {
    typescript:
      'npm install -D @stryker-mutator/core @stryker-mutator/vitest-runner',
    python: 'pip install mutmut',
    go: 'go install github.com/zimmski/go-mutesting/cmd/go-mutesting@latest',
  };
}

