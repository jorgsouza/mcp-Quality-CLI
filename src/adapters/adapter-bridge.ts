/**
 * Adapter Bridge
 * 
 * Ponte temporária entre o sistema antigo e os novos adapters.
 * Permite transição gradual sem quebrar código existente.
 * 
 * FASE A.5 - Engine Refactoring (Compatibilidade)
 * 
 * @see ROADMAP-V1-COMPLETO.md (Fase A.5)
 */

import type { LanguageDetection as OldLanguageDetection } from '../detectors/language.js';
import type { LanguageDetection, Coverage, TestResult } from './base/LanguageAdapter.js';
import { getAdapter, detectLanguage } from './adapter-factory.js';

/**
 * Converte detecção antiga para nova
 */
export function convertOldToNewDetection(old: OldLanguageDetection): LanguageDetection {
  return {
    language: old.primary,
    confidence: 0.95, // Default confidence
    framework: old.framework,
    packageManager: 'npm', // Default package manager
  };
}

/**
 * Executa testes usando o novo adapter (se disponível)
 * Fallback para o sistema antigo se adapter não existir
 * 
 * @param repo - Caminho do repositório
 * @param options - Opções de execução
 * @returns Resultado dos testes
 * 
 * @example
 * ```typescript
 * const result = await runTestsWithAdapter('/my-project', { coverage: true });
 * console.log(`${result.passed}/${result.totalTests} passed`);
 * ```
 */
export async function runTestsWithAdapter(
  repo: string,
  options: {
    coverage?: boolean;
    types?: Array<'unit' | 'integration' | 'e2e'>;
    watch?: boolean;
    parallel?: boolean;
    maxWorkers?: number;
  } = {}
): Promise<TestResult | null> {
  try {
    const adapter = await getAdapter(repo);

    if (!adapter) {
      console.warn('⚠️  Nenhum adapter encontrado. Use o sistema antigo.');
      return null;
    }

    console.log(`🧪 Executando testes com ${adapter.language} adapter...`);

    const result = await adapter.runTests(repo, options);

    console.log(`✅ ${result.passed}/${result.totalTests} testes passaram`);

    return result;
  } catch (error) {
    console.error('❌ Erro ao executar testes:', error);
    return null;
  }
}

/**
 * Faz parsing de cobertura usando o novo adapter (se disponível)
 * 
 * @param repo - Caminho do repositório
 * @param coverageFile - Caminho do arquivo de cobertura
 * @returns Métricas de cobertura padronizadas
 * 
 * @example
 * ```typescript
 * const coverage = await parseCoverageWithAdapter('/my-project', 'coverage/lcov.info');
 * console.log(`Cobertura de linhas: ${coverage.lines.pct}%`);
 * ```
 */
export async function parseCoverageWithAdapter(
  repo: string,
  coverageFile: string
): Promise<Coverage | null> {
  try {
    const adapter = await getAdapter(repo);

    if (!adapter) {
      console.warn('⚠️  Nenhum adapter encontrado. Use o sistema antigo.');
      return null;
    }

    console.log(`📊 Parseando cobertura com ${adapter.language} adapter...`);

    const coverage = await adapter.parseCoverage(coverageFile);

    console.log(`✅ Cobertura: ${coverage.lines.pct.toFixed(2)}% linhas`);

    return coverage;
  } catch (error) {
    console.error('❌ Erro ao parsear cobertura:', error);
    return null;
  }
}

/**
 * Valida o ambiente do repositório usando o novo adapter
 * 
 * @param repo - Caminho do repositório
 * @returns Resultado da validação
 * 
 * @example
 * ```typescript
 * const validation = await validateEnvironmentWithAdapter('/my-project');
 * if (!validation.ok) {
 *   console.log('Faltando:', validation.missing.join(', '));
 * }
 * ```
 */
export async function validateEnvironmentWithAdapter(repo: string): Promise<{
  ok: boolean;
  language?: string;
  framework?: string;
  missing?: string[];
  warnings?: string[];
  adapter?: string;
} | null> {
  try {
    const adapter = await getAdapter(repo);

    if (!adapter) {
      console.warn('⚠️  Nenhum adapter encontrado.');
      return null;
    }

    console.log(`🔍 Validando ambiente com ${adapter.language} adapter...`);

    const validation = await adapter.validate(repo);

    return {
      ok: validation.ok,
      language: adapter.language,
      framework: validation.framework?.name,
      missing: validation.missing,
      warnings: validation.warnings,
      adapter: adapter.language,
    };
  } catch (error) {
    console.error('❌ Erro ao validar ambiente:', error);
    return null;
  }
}

/**
 * Descobre testes usando o novo adapter
 * 
 * @param repo - Caminho do repositório
 * @returns Lista de arquivos de teste
 * 
 * @example
 * ```typescript
 * const tests = await discoverTestsWithAdapter('/my-project');
 * console.log(`Encontrados ${tests.length} arquivos de teste`);
 * ```
 */
export async function discoverTestsWithAdapter(repo: string) {
  try {
    const adapter = await getAdapter(repo);

    if (!adapter) {
      console.warn('⚠️  Nenhum adapter encontrado.');
      return [];
    }

    console.log(`🔍 Descobrindo testes com ${adapter.language} adapter...`);

    const tests = await adapter.discoverTests(repo);

    console.log(`✅ Encontrados ${tests.length} arquivos de teste`);

    return tests;
  } catch (error) {
    console.error('❌ Erro ao descobrir testes:', error);
    return [];
  }
}

/**
 * Gera scaffold de teste usando o novo adapter
 * 
 * @param repo - Caminho do repositório
 * @param target - Alvo do scaffolding
 * @returns Código do teste gerado
 * 
 * @example
 * ```typescript
 * const testCode = await scaffoldTestWithAdapter('/my-project', {
 *   file: 'src/billing.ts',
 *   function: 'calculateTotal',
 *   type: 'unit'
 * });
 * console.log(testCode);
 * ```
 */
export async function scaffoldTestWithAdapter(
  repo: string,
  target: {
    file: string;
    function?: string;
    class?: string;
    type: 'unit' | 'integration' | 'e2e' | 'contract' | 'property' | 'approval';
    outputPath?: string;
  }
): Promise<string | null> {
  try {
    const adapter = await getAdapter(repo);

    if (!adapter) {
      console.warn('⚠️  Nenhum adapter encontrado.');
      return null;
    }

    console.log(`🏗️  Gerando scaffold com ${adapter.language} adapter...`);

    const testCode = await adapter.scaffoldTest(target);

    console.log(`✅ Scaffold gerado (${testCode.length} caracteres)`);

    return testCode;
  } catch (error) {
    console.error('❌ Erro ao gerar scaffold:', error);
    return null;
  }
}

/**
 * Executa mutation testing usando o novo adapter
 * 
 * @param repo - Caminho do repositório
 * @param targets - Arquivos/módulos alvo
 * @param options - Opções de mutation
 * @returns Resultado do mutation testing
 * 
 * @example
 * ```typescript
 * const mutation = await runMutationWithAdapter('/my-project', ['src/billing.ts']);
 * console.log(`Mutation score: ${mutation.score * 100}%`);
 * ```
 */
export async function runMutationWithAdapter(
  repo: string,
  targets: string[],
  options: {
    threshold?: number;
    timeout?: number;
  } = {}
) {
  try {
    const adapter = await getAdapter(repo);

    if (!adapter) {
      console.warn('⚠️  Nenhum adapter encontrado.');
      return null;
    }

    console.log(`🧬 Executando mutation testing com ${adapter.language} adapter...`);

    const result = await adapter.runMutation(repo, targets, options);

    console.log(`✅ Mutation score: ${(result.score * 100).toFixed(2)}%`);

    return result;
  } catch (error) {
    console.error('❌ Erro ao executar mutation testing:', error);
    return null;
  }
}

/**
 * Detecta framework de testes usando o novo adapter
 * 
 * @param repo - Caminho do repositório
 * @returns Framework detectado
 * 
 * @example
 * ```typescript
 * const framework = await detectFrameworkWithAdapter('/my-project');
 * console.log(`Framework: ${framework.name} ${framework.version}`);
 * ```
 */
export async function detectFrameworkWithAdapter(repo: string) {
  try {
    const adapter = await getAdapter(repo);

    if (!adapter) {
      console.warn('⚠️  Nenhum adapter encontrado.');
      return null;
    }

    console.log(`🔍 Detectando framework com ${adapter.language} adapter...`);

    const framework = await adapter.detectFramework(repo);

    if (framework) {
      console.log(`✅ Framework: ${framework.name} ${framework.version || ''}`);
    } else {
      console.log(`⚠️  Nenhum framework detectado`);
    }

    return framework;
  } catch (error) {
    console.error('❌ Erro ao detectar framework:', error);
    return null;
  }
}

/**
 * Utilitário: Detecta linguagem usando novo sistema
 * Compatível com código existente que espera a detecção antiga
 * 
 * @param repo - Caminho do repositório
 * @returns Detecção de linguagem (formato antigo)
 */
export async function detectLanguageCompatible(repo: string): Promise<OldLanguageDetection | null> {
  try {
    const detection = await detectLanguage(repo);

    if (!detection) {
      return null;
    }

    // Converter para formato antigo
    return {
      primary: detection.language as any,
      framework: detection.framework as any,
      testCommand: '', // Será preenchido pelo sistema antigo
      coverageCommand: '',
      coverageFile: '',
      testPatterns: [],
      sourcePatterns: [],
    };
  } catch (error) {
    console.error('❌ Erro ao detectar linguagem:', error);
    return null;
  }
}

