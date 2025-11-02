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
    const qualityViolation = await validateQualityScore(repo, minQualityScore);
    if (qualityViolation) {
      violations.push(qualityViolation);
      if (failFast) {
        return buildResult(violations);
      }
    }
  }
  
  // Gate 3: Scenario Coverage - Happy Path
  if (minHappyPath !== undefined) {
    const happyViolation = await validateScenarioCoverage(repo, 'happy', minHappyPath);
    if (happyViolation) {
      violations.push(happyViolation);
      if (failFast) {
        return buildResult(violations);
      }
    }
  }
  
  // Gate 4: Scenario Coverage - Edge Cases
  if (minEdgeCases !== undefined) {
    const edgeViolation = await validateScenarioCoverage(repo, 'edge', minEdgeCases);
    if (edgeViolation) {
      violations.push(edgeViolation);
      if (failFast) {
        return buildResult(violations);
      }
    }
  }
  
  // Gate 5: Scenario Coverage - Error Handling
  if (minErrorHandling !== undefined) {
    const errorViolation = await validateScenarioCoverage(repo, 'error', minErrorHandling);
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
 * � Valida quality score mínimo (análise de test-logic)
 */
async function validateQualityScore(repo: string, threshold: number): Promise<Violation | null> {
  const reportPath = join(repo, 'tests/analyses/TEST-QUALITY-LOGICAL.json');
  
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
  scenario: 'happy' | 'edge' | 'error', 
  threshold: number
): Promise<Violation | null> {
  const reportPath = join(repo, 'tests/analyses/TEST-QUALITY-LOGICAL.json');
  
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
  };
  
  const result = await validate(options);
  
  // Exit code 1 se falhou (para CI/CD)
  if (!result.passed) {
    process.exit(1);
  }
}
