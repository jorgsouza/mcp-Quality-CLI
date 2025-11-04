/**
 * suite-health.ts
 * Mede a saúde da suíte de testes (flakiness, runtime, parallelism)
 * 
 * FASE 7 - Suite Health: Detecta testes flaky, mede performance e recomenda otimizações
 */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getPaths, ensurePaths } from '../utils/paths.js';
import { detectTestFramework } from '../detectors/test-framework.js';
import { existsSync } from 'node:fs';

export interface SuiteHealthParams {
  repo: string;
  product: string;
  history_days?: number; // default 30
}

export interface SuiteHealthResult {
  ok: boolean;
  output: string;
  total_runtime_sec: number;
  flaky_tests_count: number;
  instability_index: number;
  recommendations: string[];
  error?: string;
}

interface FlakyTest {
  name: string;
  file: string;
  runs: number;
  failures: number;
  flake_rate: number;
}

interface SuiteHealthData {
  timestamp: string;
  repo: string;
  product: string;
  total_runtime_sec: number;
  parallelism: number;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky_tests: FlakyTest[];
  instability_index: number;
  recommendations: string[];
}

/**
 * Analisa a saúde da suíte de testes
 */
export async function suiteHealth(params: SuiteHealthParams): Promise<SuiteHealthResult> {
  const { repo, product, history_days = 30 } = params;

  try {
    const paths = getPaths(repo, product);
    await ensurePaths(paths);

    console.log('🏥 [1/5] Detectando framework de testes...');
    const framework = await detectTestFramework(repo);
    console.log(`   Framework: ${framework || 'não detectado'}`);

    console.log('📊 [2/5] Analisando execuções recentes...');
    const testResults = await analyzeTestResults(repo, paths, framework);
    console.log(`   ${testResults.total_tests} testes analisados`);

    console.log('⚠️  [3/5] Detectando testes flaky...');
    const flakyTests = await detectFlakyTests(repo, paths, history_days);
    console.log(`   ${flakyTests.length} testes flaky detectados`);

    console.log('⏱️  [4/5] Medindo performance...');
    const runtime = testResults.total_runtime_sec;
    const parallelism = await detectParallelism(repo, framework);
    console.log(`   Runtime: ${runtime.toFixed(1)}s, Parallelism: ${parallelism}`);

    console.log('💡 [5/5] Gerando recomendações...');
    const recommendations = generateRecommendations(flakyTests, runtime, parallelism, testResults.total_tests);
    console.log(`   ${recommendations.length} recomendações geradas`);

    // Calcular instability index (% de testes flaky)
    const instabilityIndex = testResults.total_tests > 0 
      ? flakyTests.length / testResults.total_tests 
      : 0;

    const healthData: SuiteHealthData = {
      timestamp: new Date().toISOString(),
      repo,
      product,
      total_runtime_sec: runtime,
      parallelism,
      total_tests: testResults.total_tests,
      passed: testResults.passed,
      failed: testResults.failed,
      skipped: testResults.skipped,
      flaky_tests: flakyTests,
      instability_index: instabilityIndex,
      recommendations,
    };

    const outputPath = join(paths.reports, 'suite-health.json');
    await writeFile(outputPath, JSON.stringify(healthData, null, 2));

    console.log(`✅ Suite health analisada: ${outputPath}`);
    console.log(`   Instability Index: ${(instabilityIndex * 100).toFixed(2)}%`);
    if (instabilityIndex > 0.03) {
      console.log(`   ⚠️  ATENÇÃO: Instabilidade acima de 3% (threshold)`);
    }

    return {
      ok: true,
      output: outputPath,
      total_runtime_sec: runtime,
      flaky_tests_count: flakyTests.length,
      instability_index: instabilityIndex,
      recommendations,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro ao analisar suite health:', message);
    return {
      ok: false,
      output: '',
      total_runtime_sec: 0,
      flaky_tests_count: 0,
      instability_index: 0,
      recommendations: [],
      error: message,
    };
  }
}

/**
 * Analisa resultados de testes recentes
 */
async function analyzeTestResults(
  repo: string,
  paths: ReturnType<typeof getPaths>,
  framework: string | null
): Promise<{
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  total_runtime_sec: number;
}> {
  // Tentar ler JUnit XML ou JSON de resultados
  const junitPath = join(paths.analyses, 'junit', 'results.xml');
  const jsonPath = join(paths.analyses, 'json', 'results.json');

  // Fallback: count test files
  if (!existsSync(junitPath) && !existsSync(jsonPath)) {
    const testCount = await countTestFiles(repo);
    return {
      total_tests: testCount,
      passed: testCount, // Assumir que passou se não temos histórico de falhas
      failed: 0,
      skipped: 0,
      total_runtime_sec: testCount * 0.5, // Estimativa: 500ms por teste
    };
  }

  // Parse JSON results se disponível
  if (existsSync(jsonPath)) {
    try {
      const content = await readFile(jsonPath, 'utf-8');
      const results = JSON.parse(content);
      return {
        total_tests: results.numTotalTests || 0,
        passed: results.numPassedTests || 0,
        failed: results.numFailedTests || 0,
        skipped: results.numPendingTests || 0,
        total_runtime_sec: (results.testResults?.[0]?.perfStats?.runtime || 0) / 1000,
      };
    } catch {}
  }

  // Fallback: estimativa baseada em arquivos
  const testCount = await countTestFiles(repo);
  return {
    total_tests: testCount,
    passed: testCount,
    failed: 0,
    skipped: 0,
    total_runtime_sec: testCount * 0.5,
  };
}

/**
 * Detecta testes flaky analisando histórico
 */
async function detectFlakyTests(
  repo: string,
  paths: ReturnType<typeof getPaths>,
  historyDays: number
): Promise<FlakyTest[]> {
  // TODO: Implementar análise de histórico de CI logs
  // Por enquanto, retornar lista vazia (MVP)
  
  // Em uma implementação completa, buscaria:
  // 1. Logs do CI (GitHub Actions, GitLab CI, Jenkins)
  // 2. JUnit XML históricos
  // 3. Banco de dados de resultados
  
  return [];
}

/**
 * Detecta paralelismo configurado
 */
async function detectParallelism(repo: string, framework: string | null): Promise<number> {
  // Vitest
  const vitestConfig = join(repo, 'vitest.config.ts');
  if (existsSync(vitestConfig)) {
    try {
      const content = await readFile(vitestConfig, 'utf-8');
      const poolMatch = content.match(/pool.*?:.*?(\d+)/);
      if (poolMatch) return parseInt(poolMatch[1]);
      
      const threadsMatch = content.match(/threads.*?:.*?(\d+)/);
      if (threadsMatch) return parseInt(threadsMatch[1]);
    } catch {}
  }

  // Jest
  const jestConfig = join(repo, 'jest.config.js');
  if (existsSync(jestConfig)) {
    try {
      const content = await readFile(jestConfig, 'utf-8');
      const workersMatch = content.match(/maxWorkers.*?:.*?(\d+)/);
      if (workersMatch) return parseInt(workersMatch[1]);
    } catch {}
  }

  // Default: CPUs - 1
  return Math.max(1, require('os').cpus().length - 1);
}

/**
 * Gera recomendações baseadas na análise
 */
function generateRecommendations(
  flakyTests: FlakyTest[],
  runtime: number,
  parallelism: number,
  totalTests: number
): string[] {
  const recommendations: string[] = [];

  // Flakiness
  if (flakyTests.length > 0) {
    flakyTests.forEach(test => {
      if (test.flake_rate > 0.10) {
        recommendations.push(`🔴 CRÍTICO: Corrigir teste flaky "${test.name}" (${(test.flake_rate * 100).toFixed(1)}% flake rate)`);
      } else if (test.flake_rate > 0.05) {
        recommendations.push(`🟡 MÉDIO: Investigar teste flaky "${test.name}" (${(test.flake_rate * 100).toFixed(1)}% flake rate)`);
      }
    });
  }

  // Runtime
  const estimatedOptimalTime = (totalTests * 0.3) / parallelism; // 300ms por teste
  if (runtime > estimatedOptimalTime * 2) {
    recommendations.push(`⚡ Otimizar runtime: atual ${runtime.toFixed(1)}s, esperado ~${estimatedOptimalTime.toFixed(1)}s`);
  }

  // Parallelism
  const cpuCount = require('os').cpus().length;
  if (parallelism < cpuCount - 1 && totalTests > 20) {
    const newParallelism = cpuCount - 1;
    const estimatedNewRuntime = runtime / newParallelism * parallelism;
    recommendations.push(`🚀 Aumentar paralelismo de ${parallelism} para ${newParallelism} workers (estimativa: ${estimatedNewRuntime.toFixed(1)}s)`);
  }

  // Suite size
  if (totalTests > 1000) {
    recommendations.push('📦 Considerar dividir suite em pacotes menores para execução mais rápida');
  }

  // Se tudo OK
  if (recommendations.length === 0) {
    recommendations.push('✅ Suite de testes saudável! Continue monitorando flakiness e performance.');
  }

  return recommendations;
}

/**
 * Conta arquivos de teste no repositório
 */
async function countTestFiles(repo: string): Promise<number> {
  let count = 0;
  
  const testDirs = [
    join(repo, 'tests'),
    join(repo, 'test'),
    join(repo, '__tests__'),
    join(repo, 'src/__tests__'),
    join(repo, 'src/tests'),
  ];

  for (const dir of testDirs) {
    if (existsSync(dir)) {
      count += await countFilesRecursive(dir, /\.(test|spec)\.(ts|js|tsx|jsx|py|java|go)$/);
    }
  }

  return count;
}

/**
 * Conta arquivos recursivamente
 */
async function countFilesRecursive(dir: string, pattern: RegExp): Promise<number> {
  let count = 0;
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        count += await countFilesRecursive(fullPath, pattern);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        count++;
      }
    }
  } catch {}

  return count;
}

