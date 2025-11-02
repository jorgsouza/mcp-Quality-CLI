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

export interface ValidateOptions {
  repo: string;
  product?: string;
  minMutation?: number;      // Mutation score mínimo (0-100)
  minBranch?: number;         // Branch coverage mínimo (0-100)
  minScenarios?: number;      // % de cenários completos (0-100)
  requireCritical?: boolean;  // Exige 100% de funções críticas testadas
  failFast?: boolean;         // Para na primeira falha
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
  const { repo, product = 'default', minMutation, minBranch, minScenarios, requireCritical, failFast } = options;
  
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
  
  // Gate 2: Branch Coverage (stub - para implementar depois)
  if (minBranch !== undefined) {
    console.log(`ℹ️  Branch coverage validation (--min-branch ${minBranch}) ainda não implementado`);
  }
  
  // Gate 3: Scenario Coverage (stub - para implementar depois)
  if (minScenarios !== undefined) {
    console.log(`ℹ️  Scenario coverage validation (--min-scenarios ${minScenarios}) ainda não implementado`);
  }
  
  // Gate 4: Critical Functions (stub - para implementar depois)
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
 * 📋 Constrói resultado final
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
