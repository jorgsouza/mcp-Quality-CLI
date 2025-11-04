/**
 * ✅ Quality Validate - Gates de Qualidade
 * 
 * Valida thresholds de qualidade e reprova se não atingir mínimos.
 * Usado em CI/CD para bloquear PRs com qualidade insuficiente.
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { runPipeline } from '../engine/index.js';
import type { MutationResult } from '../engine/capabilities.js';
import type { TestLogicResult } from './analyze-test-logic.js';
import { getPaths } from '../utils/paths.js';
import { loadMCPSettings } from '../utils/config.js';

export interface ValidateOptions {
  repo: string;
  product?: string;
  minMutation?: number;         // Mutation score mínimo (0-100)
  minBranch?: number;            // Branch coverage mínimo (0-100)
  minScenarios?: number;         // % de cenários completos (0-100)
  minQualityScore?: number;      // Quality score mínimo (0-100)
  minHappyPath?: number;         // % funções com happy path (0-100)
  minEdgeCases?: number;         // % funções com edge cases (0-100)
  minErrorHandling?: number;     // % funções com error handling (0-100)
  maxWeakAsserts?: number;       // Máximo de assertions fracas permitidas
  requireCritical?: boolean;     // Exige 100% de funções críticas testadas
  minDiffCoverage?: number;      // 🆕 Diff coverage mínimo (0-100) - PR-aware
  requireContractsPassing?: boolean; // 🆕 Exige contratos CDC/Pact passando
  failFast?: boolean;            // Para na primeira falha
}

export interface ValidationResult {
  passed: boolean;
  violations: Violation[];
  summary: string;
}

interface Violation {
  gate: string;
  threshold: number;
  actual: number;
  message: string;
  suggestions: string[];
}

/**
 * 🚦 Valida gates de qualidade
 */
export async function validate(options: ValidateOptions): Promise<ValidationResult> {
  const { 
    repo, 
    product = 'default', 
    minMutation, 
    minBranch, 
    minScenarios, 
    minQualityScore,
    minHappyPath,
    minEdgeCases,
    minErrorHandling,
    maxWeakAsserts,
    requireCritical,
    minDiffCoverage, // 🆕
    requireContractsPassing, // 🆕
    failFast 
  } = options;
  
  console.log('🚦 Validando gates de qualidade...\n');
  
  const violations: Violation[] = [];
  
  // Gate 1: Mutation Score
  if (minMutation !== undefined) {
    const mutationViolation = await validateMutationScore(repo, minMutation);
    if (mutationViolation) {
      violations.push(mutationViolation);
      if (failFast) {
        return buildResult(violations);
      }
    }
  }
  
  // Gate 2: Quality Score (novo - análise de test-logic)
  if (minQualityScore !== undefined) {
    const qualityViolation = await validateQualityScore(repo, product, minQualityScore);
    if (qualityViolation) {
      violations.push(qualityViolation);
      if (failFast) {
        return buildResult(violations);
      }
    }
  }
  
  // Gate 3: Scenario Coverage - Happy Path
  if (minHappyPath !== undefined) {
    const happyViolation = await validateScenarioCoverage(repo, product, 'happy', minHappyPath);
    if (happyViolation) {
      violations.push(happyViolation);
      if (failFast) {
        return buildResult(violations);
      }
    }
  }
  
  // Gate 4: Scenario Coverage - Edge Cases
  if (minEdgeCases !== undefined) {
    const edgeViolation = await validateScenarioCoverage(repo, product, 'edge', minEdgeCases);
    if (edgeViolation) {
      violations.push(edgeViolation);
      if (failFast) {
        return buildResult(violations);
      }
    }
  }
  
  // Gate 5: Scenario Coverage - Error Handling
  if (minErrorHandling !== undefined) {
    const errorViolation = await validateScenarioCoverage(repo, product, 'error', minErrorHandling);
    if (errorViolation) {
      violations.push(errorViolation);
      if (failFast) {
        return buildResult(violations);
      }
    }
  }
  
  // Gate 6: Weak Assertions
  if (maxWeakAsserts !== undefined) {
    const weakViolation = await validateWeakAssertions(repo, maxWeakAsserts);
    if (weakViolation) {
      violations.push(weakViolation);
      if (failFast) {
        return buildResult(violations);
      }
    }
  }
  
  // Gate 7: Branch Coverage (stub - para implementar depois)
  if (minBranch !== undefined) {
    console.log(`ℹ️  Branch coverage validation (--min-branch ${minBranch}) ainda não implementado`);
  }
  
  // Gate 8: Scenario Coverage (stub - para implementar depois)
  if (minScenarios !== undefined) {
    console.log(`ℹ️  Scenario coverage validation (--min-scenarios ${minScenarios}) ainda não implementado`);
  }
  
  // Gate 9: Critical Functions (stub - para implementar depois)
  if (requireCritical) {
    console.log(`ℹ️  Critical functions validation ainda não implementado`);
  }
  
  // 🆕 Gate 10: Diff Coverage (PR-aware)
  if (minDiffCoverage !== undefined) {
    const diffViolation = await validateDiffCoverage(repo, product, minDiffCoverage);
    if (diffViolation) {
      violations.push(diffViolation);
      if (failFast) {
        return buildResult(violations);
      }
    }
  }
  
  // 🆕 Gate 11: Contracts (CDC/Pact)
  if (requireContractsPassing) {
    const contractViolation = await validateContracts(repo, product);
    if (contractViolation) {
      violations.push(contractViolation);
      if (failFast) {
        return buildResult(violations);
      }
    }
  }
  
  return buildResult(violations);
}

/**
 * 🧬 Valida mutation score mínimo
 */
async function validateMutationScore(repo: string, threshold: number): Promise<Violation | null> {
  const reportPath = join(repo, 'reports/mutation/mutation.json');
  
  if (!existsSync(reportPath)) {
    return {
      gate: 'Mutation Score',
      threshold,
      actual: 0,
      message: `❌ Nenhum relatório de mutação encontrado`,
      suggestions: [
        '1. Instale Stryker: npm install --save-dev @stryker-mutator/core @stryker-mutator/vitest-runner',
        '2. Configure: npx stryker init',
        '3. Execute: npx stryker run',
        '4. Re-execute validate após gerar o relatório',
      ],
    };
  }
  
  try {
    const content = await fs.readFile(reportPath, 'utf-8');
    const report = JSON.parse(content);
    
    // Calcula mutation score
    const mutants = report.files?.flatMap((file: any) => file.mutants || []) || [];
    const killed = mutants.filter((m: any) => m.status === 'Killed').length;
    const total = mutants.length;
    const score = total > 0 ? Math.round((killed / total) * 100) : 0;
    
    if (score < threshold) {
      // Identifica mutantes sobreviventes
      const survivors = mutants
        .filter((m: any) => m.status === 'Survived')
        .slice(0, 5); // Top 5
      
      const suggestions = [
        `📊 Mutation Score: ${score}% (threshold: ${threshold}%)`,
        `👾 ${mutants.length - killed} mutantes sobreviveram`,
        '',
        '💡 Top mutantes sobreviventes:',
        ...survivors.map((m: any, i: number) => 
          `   ${i + 1}. ${m.mutatorName} em ${m.location?.start?.line || '?'}: ${m.originalString} → ${m.mutatedString}`
        ),
        '',
        '🔧 Ações recomendadas:',
        '   - Adicione assertions específicas que validem valores exatos',
        '   - Substitua toBeDefined() por expect(x).toBe(value)',
        '   - Teste side effects com spies: expect(spy).toHaveBeenCalledWith(...)',
      ];
      
      return {
        gate: 'Mutation Score',
        threshold,
        actual: score,
        message: `❌ Mutation score abaixo do mínimo: ${score}% < ${threshold}%`,
        suggestions,
      };
    }
    
    console.log(`✅ Mutation Score: ${score}% >= ${threshold}%`);
    return null;
    
  } catch (error) {
    return {
      gate: 'Mutation Score',
      threshold,
      actual: 0,
      message: `❌ Erro ao ler relatório de mutação: ${error}`,
      suggestions: [
        'Verifique se o formato do relatório está correto',
        'Re-execute: npx stryker run',
      ],
    };
  }
}

/**
 * 🎯 Valida quality score mínimo (análise de test-logic)
 */
async function validateQualityScore(repo: string, product: string, threshold: number): Promise<Violation | null> {
  // [FASE 3] Usar getPaths() para localizar análises
  const settings = await loadMCPSettings(repo, product).catch(() => undefined);
  const paths = getPaths(repo, product, settings || undefined);
  const reportPath = join(paths.analyses, 'TEST-QUALITY-LOGICAL.json');
  
  if (!existsSync(reportPath)) {
    return {
      gate: 'Quality Score',
      threshold,
      actual: 0,
      message: `❌ Análise de qualidade lógica não encontrada`,
      suggestions: [
        '1. Execute: quality analyze --mode full (com analyze-test-logic)',
        '2. Ou execute manualmente: quality analyze-test-logic --repo . --product <name>',
        '3. Re-execute validate após gerar o relatório',
      ],
    };
  }
  
  try {
    const content = await fs.readFile(reportPath, 'utf-8');
    const report: TestLogicResult = JSON.parse(content);
    const score = report.metrics.qualityScore;
    
    if (score < threshold) {
      const suggestions = [
        `📊 Quality Score: ${score}/100 (Grade: ${report.metrics.grade})`,
        `🎯 Threshold: ${threshold}/100`,
        '',
        '💡 Principais problemas:',
        ...report.recommendations.slice(0, 5),
        '',
        '🔧 Ações recomendadas:',
        '   - Substitua assertions fracas (toBeDefined → toBe(value))',
        '   - Adicione testes de edge cases (null, empty, boundary)',
        '   - Adicione testes de error handling (throw, reject)',
        '   - Valide interações com mocks (toHaveBeenCalledWith)',
      ];
      
      return {
        gate: 'Quality Score',
        threshold,
        actual: score,
        message: `❌ Quality score abaixo do mínimo: ${score} < ${threshold}`,
        suggestions,
      };
    }
    
    console.log(`✅ Quality Score: ${score}/100 (${report.metrics.grade}) >= ${threshold}/100`);
    return null;
    
  } catch (error) {
    return {
      gate: 'Quality Score',
      threshold,
      actual: 0,
      message: `❌ Erro ao ler relatório de qualidade: ${error}`,
      suggestions: [
        'Verifique se o formato do relatório está correto',
        'Re-execute: quality analyze --mode full',
      ],
    };
  }
}

/**
 * 🎯 Valida cobertura de cenários (happy/edge/error)
 */
async function validateScenarioCoverage(
  repo: string,
  product: string,
  scenario: 'happy' | 'edge' | 'error', 
  threshold: number
): Promise<Violation | null> {
  // [FASE 3] Usar getPaths() para localizar análises
  const settings = await loadMCPSettings(repo, product).catch(() => undefined);
  const paths = getPaths(repo, product, settings || undefined);
  const reportPath = join(paths.analyses, 'TEST-QUALITY-LOGICAL.json');
  
  if (!existsSync(reportPath)) {
    return null; // Já reportado em validateQualityScore
  }
  
  try {
    const content = await fs.readFile(reportPath, 'utf-8');
    const report: TestLogicResult = JSON.parse(content);
    const actual = report.metrics.scenarioCoverage[scenario];
    
    const scenarioNames = {
      happy: 'Happy Path',
      edge: 'Edge Cases',
      error: 'Error Handling'
    };
    
    if (actual < threshold) {
      const suggestions = [
        `📊 ${scenarioNames[scenario]}: ${actual.toFixed(1)}% (threshold: ${threshold}%)`,
        '',
        '💡 Funções sem cobertura deste cenário:',
        ...report.functions
          .filter(f => !f.scenarios[scenario])
          .slice(0, 5)
          .map(f => `   - ${f.name} (${f.filePath})`),
        '',
        '🔧 Ações recomendadas:',
        scenario === 'happy' && '   - Adicione testes básicos de sucesso para cada função',
        scenario === 'edge' && '   - Teste valores de limite: null, undefined, empty, zero, max',
        scenario === 'error' && '   - Teste casos de erro: invalid input, throw, reject',
      ].filter(Boolean) as string[];
      
      return {
        gate: `${scenarioNames[scenario]} Coverage`,
        threshold,
        actual: Math.round(actual),
        message: `❌ Cobertura de ${scenarioNames[scenario]} abaixo do mínimo: ${actual.toFixed(1)}% < ${threshold}%`,
        suggestions,
      };
    }
    
    console.log(`✅ ${scenarioNames[scenario]}: ${actual.toFixed(1)}% >= ${threshold}%`);
    return null;
    
  } catch (error) {
    return null; // Erro já reportado
  }
}

/**
 * ⚠️ Valida quantidade de assertions fracas
 */
async function validateWeakAssertions(repo: string, maxAllowed: number): Promise<Violation | null> {
  const reportPath = join(repo, 'tests/analyses/TEST-QUALITY-LOGICAL.json');
  
  if (!existsSync(reportPath)) {
    return null; // Já reportado
  }
  
  try {
    const content = await fs.readFile(reportPath, 'utf-8');
    const report: TestLogicResult = JSON.parse(content);
    
    // Conta weak assertions em todos os testes
    const weakCount = report.functions
      .flatMap(f => f.tests)
      .flatMap(t => t.weakAsserts)
      .length;
    
    if (weakCount > maxAllowed) {
      // Top funções com weak asserts
      const topFunctions = report.functions
        .filter(f => f.tests.some(t => t.weakAsserts.length > 0))
        .slice(0, 5);
      
      const suggestions = [
        `⚠️  ${weakCount} assertion(s) fraca(s) detectada(s) (máximo: ${maxAllowed})`,
        '',
        '💡 Top funções com assertions fracas:',
        ...topFunctions.map(f => {
          const weakTests = f.tests.filter(t => t.weakAsserts.length > 0);
          return `   - ${f.name}: ${weakTests.length} teste(s)`;
        }),
        '',
        '🔧 Ações recomendadas:',
        '   - Substitua toBeDefined() por expect(x).toBe(expectedValue)',
        '   - Substitua toBeTruthy() por expect(x).toBe(true)',
        '   - Substitua toMatchSnapshot() por assertions específicas',
        '   - Adicione toHaveBeenCalledWith(...) em mocks',
      ];
      
      return {
        gate: 'Weak Assertions',
        threshold: maxAllowed,
        actual: weakCount,
        message: `❌ Muitas assertions fracas detectadas: ${weakCount} > ${maxAllowed}`,
        suggestions,
      };
    }
    
    console.log(`✅ Weak Assertions: ${weakCount} <= ${maxAllowed}`);
    return null;
    
  } catch (error) {
    return null;
  }
}

/**
 * 🔀 Valida diff coverage mínimo (PR-aware)
 */
async function validateDiffCoverage(repo: string, product: string, threshold: number): Promise<Violation | null> {
  const paths = getPaths(repo, product);
  const diffCoveragePath = join(paths.analyses, 'diff-coverage.json');
  
  if (!existsSync(diffCoveragePath)) {
    return {
      gate: 'Diff Coverage',
      threshold,
      actual: 0,
      message: `❌ Nenhum relatório de diff coverage encontrado`,
      suggestions: [
        '1. Execute: quality analyze --repo . --product <nome>',
        '2. O diff coverage é calculado automaticamente se houver diff em relação ao main',
        '3. Certifique-se de estar em uma branch diferente de main',
      ],
    };
  }
  
  try {
    const content = await fs.readFile(diffCoveragePath, 'utf-8');
    const diffData = JSON.parse(content);
    
    const diffCoverage = diffData.diffCoverage || 0;
    
    if (diffCoverage < threshold) {
      return {
        gate: 'Diff Coverage',
        threshold,
        actual: Math.round(diffCoverage),
        message: `❌ Cobertura do diff (${diffCoverage.toFixed(1)}%) abaixo do mínimo (${threshold}%)`,
        suggestions: [
          `Linhas adicionadas: ${diffData.linesAdded || 0}`,
          `Linhas cobertas: ${diffData.linesCovered || 0}`,
          'Adicione testes para cobrir as linhas novas do diff',
          'Execute: quality scaffold --repo . --product <nome>',
        ],
      };
    }
    
    console.log(`✅ Diff Coverage: ${diffCoverage.toFixed(1)}% (mínimo: ${threshold}%)`);
    return null;
  } catch (error) {
    return {
      gate: 'Diff Coverage',
      threshold,
      actual: 0,
      message: `❌ Erro ao ler diff coverage: ${error instanceof Error ? error.message : error}`,
      suggestions: [
        'Execute a análise completa novamente',
      ],
    };
  }
}

/**
 * 🤝 Valida contratos CDC/Pact
 */
async function validateContracts(repo: string, product: string): Promise<Violation | null> {
  const paths = getPaths(repo, product);
  
  // Procura por arquivos de verificação de contratos
  const contractCatalogPath = join(paths.analyses, 'contract-catalog.json');
  const contractVerifyPath = join(paths.reports, 'contracts-verify.json'); // 🆕 Corrigido: reports não analyses
  
  if (!existsSync(contractCatalogPath) && !existsSync(contractVerifyPath)) {
    return {
      gate: 'Contracts (CDC/Pact)',
      threshold: 100,
      actual: 0,
      message: `❌ Nenhum relatório de contratos encontrado`,
      suggestions: [
        '1. Execute: quality analyze --repo . --product <nome>',
        '2. Certifique-se de que os contratos Pact foram gerados',
        '3. Execute: quality run-contracts-verify --repo . --product <nome>',
      ],
    };
  }
  
  try {
    // Lê o catálogo de contratos
    let totalContracts = 0;
    let verifiedContracts = 0;
    let failedContracts = 0;
    
    if (existsSync(contractCatalogPath)) {
      const catalog = JSON.parse(await fs.readFile(contractCatalogPath, 'utf-8'));
      totalContracts = catalog.contracts?.length || 0;
    }
    
    if (existsSync(contractVerifyPath)) {
      const verify = JSON.parse(await fs.readFile(contractVerifyPath, 'utf-8'));
      verifiedContracts = verify.verified || 0;
      failedContracts = verify.failed || 0;
    }
    
    if (failedContracts > 0 || (totalContracts > 0 && verifiedContracts === 0)) {
      return {
        gate: 'Contracts (CDC/Pact)',
        threshold: 100,
        actual: totalContracts > 0 ? Math.round((verifiedContracts / totalContracts) * 100) : 0,
        message: `❌ Contratos falharam: ${failedContracts} falhas, ${verifiedContracts}/${totalContracts} verificados`,
        suggestions: [
          'Revise os contratos que falharam',
          'Execute: quality run-contracts-verify --repo . --product <nome>',
          'Corrija as incompatibilidades de contrato',
        ],
      };
    }
    
    console.log(`✅ Contracts: ${verifiedContracts}/${totalContracts} verificados com sucesso`);
    return null;
  } catch (error) {
    return {
      gate: 'Contracts (CDC/Pact)',
      threshold: 100,
      actual: 0,
      message: `❌ Erro ao validar contratos: ${error instanceof Error ? error.message : error}`,
      suggestions: [
        'Execute a verificação de contratos novamente',
      ],
    };
  }
}

/**
 * �📋 Constrói resultado final
 */
function buildResult(violations: Violation[]): ValidationResult {
  const passed = violations.length === 0;
  
  let summary = '';
  
  if (passed) {
    summary = '\n✅ VALIDAÇÃO PASSOU - Todos os gates de qualidade atingidos!\n';
  } else {
    summary = '\n❌ VALIDAÇÃO FALHOU - Gates não atingidos:\n\n';
    
    violations.forEach((v, i) => {
      summary += `${i + 1}. ${v.gate}: ${v.actual}% < ${v.threshold}%\n`;
      summary += `   ${v.message}\n`;
      v.suggestions.forEach(s => summary += `   ${s}\n`);
      summary += '\n';
    });
    
    summary += `\n💡 Corrija as violações acima e execute novamente.\n`;
  }
  
  console.log(summary);
  
  return {
    passed,
    violations,
    summary,
  };
}

/**
 * 🎯 CLI Entry Point
 */
export default async function run(args: any) {
  const options: ValidateOptions = {
    repo: args.repo || process.cwd(),
    product: args.product,
    minMutation: args.minMutation,
    minBranch: args.minBranch,
    minScenarios: args.minScenarios,
    requireCritical: args.requireCritical,
    failFast: args.failFast,
    
    // 🆕 Gates adicionais (diff coverage + contracts)
    minDiffCoverage: args.minDiffCoverage || args.min_diff_coverage,  // --min-diff-coverage
    requireContractsPassing: args.requireContracts || args.require_contracts,  // --require-contracts
  };
  
  const result = await validate(options);
  
  // Exit code 1 se falhou (para CI/CD)
  if (!result.passed) {
    process.exit(1);
  }
}
