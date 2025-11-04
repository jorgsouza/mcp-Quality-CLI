/**
 * MUTATION TESTING TOOL
 * 
 * Executa mutation testing em módulos críticos identificados no risk-register.
 * Usa mutation-runner.ts para suportar múltiplas linguagens:
 * - TypeScript/JavaScript: Stryker
 * - Python: mutmut
 * - Go: go-mutesting
 * - Java: PIT
 * 
 * @see src/runners/mutation-runner.ts
 * @see docs/development/PLANO-PROXIMAS-FASES.md (FASE 6)
 */

import { resolve, join, dirname } from 'node:path';
import { promises as fs } from 'node:fs';
import { getPaths } from '../utils/paths.js';
import { writeFileSafe, fileExists } from '../utils/fs.js';
import { runMutationAuto } from '../runners/mutation-runner.js';
import { getLanguageAdapter } from '../adapters/index.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface RunMutationTestsOptions {
  repo: string;
  product: string;
  /** Módulos específicos para testar (opcional, usa risk-register se não fornecido) */
  targets?: string[];
  /** Score mínimo aceitável (default: 0.5) */
  minScore?: number;
  /** Forçar framework (stryker, mutmut, go-mutesting, pit) */
  framework?: 'stryker' | 'mutmut' | 'go-mutesting' | 'pit';
  /** Falhar se score < minScore */
  failOnLow?: boolean;
}

export interface MutationModule {
  name: string;
  path: string;
  totalMutants: number;
  killed: number;
  survived: number;
  timeout: number;
  noCoverage: number;
  score: number;
  critical: boolean;
}

export interface MutationTestsResult {
  ok: boolean;
  framework: string;
  language: string;
  modules: MutationModule[];
  overallScore: number;
  criticalScore: number;
  threshold: number;
  passed: boolean;
  outputPath: string;
  reportPath: string;
  duration: number;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runMutationTests(
  options: RunMutationTestsOptions
): Promise<MutationTestsResult> {
  const startTime = Date.now();
  const repoPath = resolve(options.repo);
  const paths = getPaths(repoPath, options.product);

  console.log('🧬 [Mutation Testing] Iniciando...');

  // 1. Detectar linguagem e framework
  const adapter = await getLanguageAdapter(repoPath);
  if (!adapter) {
    throw new Error('Nenhum adapter de linguagem encontrado. Certifique-se de que o projeto tem package.json, go.mod, pom.xml, etc.');
  }

  const framework = adapter.detectFramework ? await adapter.detectFramework(repoPath) : null;
  console.log(`  📦 Linguagem: ${adapter.language}`);
  console.log(`  🧪 Framework: ${framework?.name || 'desconhecido'}`);

  // 2. Identificar targets (módulos críticos)
  let targets = options.targets || [];
  
  if (targets.length === 0) {
    // Tentar carregar risk-register.json
    const riskRegisterPath = join(paths.analyses, 'risk-register.json');
    if (await fileExists(riskRegisterPath)) {
      console.log('  📊 Carregando módulos críticos do risk-register...');
      const riskContent = await fs.readFile(riskRegisterPath, 'utf-8');
      const riskData = JSON.parse(riskContent);
      
      // Pegar top 5 módulos críticos
      if (riskData.top_5_critical && Array.isArray(riskData.top_5_critical)) {
        targets = riskData.top_5_critical.map((risk: any) => risk.module || risk.id);
      } else if (riskData.risks && Array.isArray(riskData.risks)) {
        // Filtrar os de impact=critical
        const criticalRisks = riskData.risks
          .filter((r: any) => r.impact === 'critical')
          .slice(0, 5);
        targets = criticalRisks.map((r: any) => r.module || r.domain || r.id);
      }
    }

    // Fallback: analisar todos os arquivos
    if (targets.length === 0) {
      console.log('  ⚠️  Nenhum módulo crítico encontrado. Analisando projeto inteiro...');
      targets = ['.'];
    }
  }

  console.log(`  🎯 Targets: ${targets.join(', ')}`);

  // 3. Executar mutation testing
  console.log('  🧬 Executando mutation tests...');
  const mutationResult = await runMutationAuto(repoPath, {
    // MutationOptions são limitadas: não há como passar targets específicos
    // TODO: melhorar runMutationAuto para aceitar targets
  });

  // 4. Processar resultados por módulo
  const modules: MutationModule[] = [];
  let totalKilled = 0;
  let totalMutants = 0;
  let criticalKilled = 0;
  let criticalMutants = 0;

  for (const target of targets) {
    // Por enquanto, usar os resultados gerais
    // TODO: parsear resultados específicos por módulo do mutation framework
    const killed = mutationResult.killed || 0;
    const survived = mutationResult.survived || 0;
    const timeout = mutationResult.timeout || 0;
    const noCoverage = mutationResult.noCoverage || 0;
    const total = killed + survived + timeout + noCoverage;
    const score = total > 0 ? killed / total : 0;

    modules.push({
      name: target,
      path: target,
      totalMutants: total,
      killed,
      survived,
      timeout,
      noCoverage,
      score,
      critical: true, // Considerar todos como críticos por ora
    });

    totalKilled += killed;
    totalMutants += total;

    if (true) { // TODO: verificar se é módulo crítico
      criticalKilled += killed;
      criticalMutants += total;
    }
  }

  const overallScore = totalMutants > 0 ? totalKilled / totalMutants : 0;
  const criticalScore = criticalMutants > 0 ? criticalKilled / criticalMutants : 0;
  const threshold = options.minScore || 0.5;
  const passed = overallScore >= threshold;

  // 5. Salvar JSON
  const outputPath = join(paths.reports, 'mutation-score.json');
  const jsonOutput = {
    framework: mutationResult.framework,
    language: adapter.language,
    modules,
    overallScore: parseFloat((overallScore * 100).toFixed(2)),
    criticalScore: parseFloat((criticalScore * 100).toFixed(2)),
    threshold: threshold * 100,
    passed,
    totalMutants,
    totalKilled,
    totalSurvived: totalMutants - totalKilled,
    executedAt: new Date().toISOString(),
  };

  await writeFileSafe(outputPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`  💾 Salvo: ${outputPath}`);

  // 6. Gerar relatório Markdown
  const reportPath = join(paths.reports, 'MUTATION-SCORE.md');
  const markdown = generateMutationReportMarkdown(jsonOutput);
  await writeFileSafe(reportPath, markdown);
  console.log(`  📄 Relatório: ${reportPath}`);

  // 7. Log final
  const duration = Date.now() - startTime;
  console.log(`  ✅ Mutation testing concluído em ${(duration / 1000).toFixed(1)}s`);
  console.log(`  🎯 Score Geral: ${(overallScore * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(0)}%)`);
  console.log(`  🔥 Score Crítico: ${(criticalScore * 100).toFixed(1)}%`);

  if (!passed) {
    console.warn(`  ⚠️  Score abaixo do threshold! ${(overallScore * 100).toFixed(1)}% < ${(threshold * 100).toFixed(0)}%`);
  }

  return {
    ok: passed,
    framework: mutationResult.framework,
    language: adapter.language,
    modules,
    overallScore: parseFloat((overallScore * 100).toFixed(2)),
    criticalScore: parseFloat((criticalScore * 100).toFixed(2)),
    threshold: threshold * 100,
    passed,
    outputPath,
    reportPath,
    duration,
  };
}

// ============================================================================
// MARKDOWN REPORT GENERATOR
// ============================================================================

function generateMutationReportMarkdown(data: any): string {
  const emoji = data.passed ? '✅' : '❌';
  const status = data.passed ? 'PASSED' : 'FAILED';

  return `# 🧬 Mutation Testing Report

**Status**: ${emoji} ${status}  
**Framework**: ${data.framework}  
**Language**: ${data.language}  
**Executed**: ${new Date(data.executedAt).toLocaleString()}

---

## 📊 Overall Score

- **Overall Mutation Score**: ${data.overallScore.toFixed(1)}%
- **Critical Modules Score**: ${data.criticalScore.toFixed(1)}%
- **Threshold**: ${data.threshold.toFixed(0)}%
- **Status**: ${data.passed ? '✅ Passed' : '❌ Failed'}

---

## 🎯 Summary

| Metric | Value |
|--------|-------|
| Total Mutants | ${data.totalMutants} |
| Killed | ${data.totalKilled} |
| Survived | ${data.totalSurvived} |
| Timeout | ${data.modules.reduce((sum: number, m: any) => sum + m.timeout, 0)} |
| No Coverage | ${data.modules.reduce((sum: number, m: any) => sum + m.noCoverage, 0)} |

---

## 📦 Modules

| Module | Critical | Total | Killed | Survived | Timeout | No Coverage | Score |
|--------|----------|-------|--------|----------|---------|-------------|-------|
${data.modules.map((m: MutationModule) => 
  `| \`${m.name}\` | ${m.critical ? '🔴' : '🟢'} | ${m.totalMutants} | ${m.killed} | ${m.survived} | ${m.timeout} | ${m.noCoverage} | **${(m.score * 100).toFixed(1)}%** |`
).join('\n')}

---

## 🎯 Recommendations

${data.passed ? `
✅ **Mutation score is healthy!**

Your test suite is effectively catching bugs introduced by mutations.
` : `
❌ **Mutation score is below threshold!**

**Actions needed:**
1. Review survived mutants and add test cases
2. Focus on critical modules with low scores
3. Aim for at least ${data.threshold}% mutation coverage
`}

${data.modules.filter((m: MutationModule) => m.score < 0.5).length > 0 ? `
### ⚠️ Modules needing attention (score < 50%):

${data.modules
  .filter((m: MutationModule) => m.score < 0.5)
  .map((m: MutationModule) => `- **${m.name}**: ${(m.score * 100).toFixed(1)}% (${m.survived} survived, ${m.killed} killed)`)
  .join('\n')}
` : ''}

---

## 📚 Resources

- [Mutation Testing Overview](https://en.wikipedia.org/wiki/Mutation_testing)
- [Stryker Docs](https://stryker-mutator.io/)
- [PIT (Java) Docs](https://pitest.org/)
- [Mutmut (Python) Docs](https://mutmut.readthedocs.io/)

---

**Generated by**: MCP Quality CLI  
**Version**: 0.4.0
`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default runMutationTests;

