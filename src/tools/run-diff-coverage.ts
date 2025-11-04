/**
 * Diff Coverage
 * 
 * Executa coverage apenas nas linhas alteradas (git diff).
 * Útil para PRs - garante que novo código tem cobertura mínima.
 * 
 * FASE E.1-E.2-E.4 - Diff Coverage
 * 
 * @see ROADMAP-V1-COMPLETO.md (Fase E)
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { parseCoverageAuto } from '../parsers/coverage-parsers.js';
import { parseLCOV, findLCOVFile, findFileInReport, calculateLineCoverage, type LCOVReport } from '../parsers/lcov-line-parser.js'; // 🆕 Parser preciso
import { getPaths } from '../utils/paths.js';
import { writeFileSafe } from '../utils/fs.js';

interface DiffCoverageOptions {
  repo: string;
  product?: string;
  baseBranch?: string;
  minCoverage?: number;
}

interface DiffCoverageResult {
  ok: boolean;
  diffCoverage: number;
  linesAdded: number;
  linesCovered: number;
  files: Array<{
    file: string;
    linesAdded: number;
    linesCovered: number;
    coverage: number;
  }>;
  reportPath?: string;
}

/**
 * Executa coverage apenas no diff
 */
export async function runDiffCoverage(
  options: DiffCoverageOptions
): Promise<DiffCoverageResult> {
  const { repo, baseBranch = 'main', minCoverage = 60 } = options;

  console.log(`📊 Analisando diff coverage (base: ${baseBranch})...`);

  // 1. Obter arquivos alterados
  const changedFiles = await getChangedFiles(repo, baseBranch);

  if (changedFiles.length === 0) {
    console.log('✅ Nenhum arquivo alterado');
    return {
      ok: true,
      diffCoverage: 100,
      linesAdded: 0,
      linesCovered: 0,
      files: [],
    };
  }

  console.log(`📝 ${changedFiles.length} arquivo(s) alterado(s)`);

  // 2. Obter linhas alteradas por arquivo
  const diffData = await getDiffLinesPerFile(repo, baseBranch, changedFiles);

  // 🆕 3. Obter coverage LCOV preciso linha-a-linha
  const lcovFile = await findLCOVFile(repo);
  let lcovReport: LCOVReport | null = null;

  if (lcovFile) {
    try {
      const lcovContent = await fs.readFile(lcovFile, 'utf-8');
      lcovReport = parseLCOV(lcovContent);
      console.log(`📊 LCOV carregado: ${lcovReport.files.size} arquivos, ${lcovReport.totalLines} linhas`);
    } catch (error) {
      console.warn('⚠️  Erro ao parsear LCOV, usando fallback:', error);
    }
  }

  // 🆕 4. Calcular coverage EXATO do diff linha-a-linha
  const fileResults: Array<{
    file: string;
    linesAdded: number;
    linesCovered: number;
    coverage: number;
  }> = [];

  let totalLinesAdded = 0;
  let totalLinesCovered = 0;

  for (const [file, lines] of Object.entries(diffData)) {
    const changedLines = lines as number[];
    const linesAdded = changedLines.length;
    totalLinesAdded += linesAdded;

    let linesCovered = 0;

    if (lcovReport && changedLines.length > 0) {
      // 🆕 CÁLCULO PRECISO: Verifica cada linha alterada no LCOV
      const lcovFile = findFileInReport(lcovReport, file);
      if (lcovFile) {
        const result = calculateLineCoverage(lcovReport, lcovFile, changedLines);
        linesCovered = result.covered;
        console.log(`  ${file}: ${linesCovered}/${linesAdded} linhas cobertas (${result.percentage.toFixed(1)}%)`);
      } else {
        console.log(`  ${file}: não encontrado no LCOV (0% coverage)`);
      }
    } else if (linesAdded === 0) {
      // Arquivo sem mudanças de código (ex: apenas imports)
      linesCovered = 0;
    }

    totalLinesCovered += linesCovered;

    const fileCoverage = linesAdded > 0 ? (linesCovered / linesAdded) * 100 : 100;

    fileResults.push({
      file,
      linesAdded,
      linesCovered,
      coverage: fileCoverage,
    });
  }

  const diffCoverage = totalLinesAdded > 0 ? (totalLinesCovered / totalLinesAdded) * 100 : 0;

  const ok = diffCoverage >= minCoverage;

  console.log(`📊 Diff coverage: ${diffCoverage.toFixed(2)}% (mínimo: ${minCoverage}%)`);
  console.log(ok ? '✅ Aprovado!' : `❌ Reprovado! (abaixo de ${minCoverage}%)`);

  // 5. Gerar relatório
  let reportPath: string | undefined;

  if (options.product) {
    const paths = getPaths(repo, options.product);
    reportPath = join(paths.reports, 'DIFF-COVERAGE.md');
    await generateDiffCoverageReport(reportPath, {
      diffCoverage,
      linesAdded: totalLinesAdded,
      linesCovered: totalLinesCovered,
      files: fileResults,
      baseBranch,
      minCoverage,
      ok,
    });
    
    // 🆕 2) Salvar JSON para validate.ts
    const jsonPath = join(paths.analyses, 'diff-coverage.json');
    const jsonData = {
      diffCoverage,
      linesAdded: totalLinesAdded,
      linesCovered: totalLinesCovered,
      files: fileResults,
      baseBranch,
      timestamp: new Date().toISOString(),
    };
    await writeFileSafe(jsonPath, JSON.stringify(jsonData, null, 2));
    console.log(`✅ JSON salvo: ${jsonPath}`);
  }

  return {
    ok,
    diffCoverage,
    linesAdded: totalLinesAdded,
    linesCovered: totalLinesCovered,
    files: fileResults,
    reportPath,
  };
}

/**
 * Obtém arquivos alterados no diff
 */
async function getChangedFiles(repo: string, baseBranch: string): Promise<string[]> {
  try {
    // Verificar se está em um repositório git
    try {
      execSync('git rev-parse --git-dir', {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 5000, // 5s timeout
      });
    } catch {
      console.log('⚠️  Não é um repositório git');
      return [];
    }

    const output = execSync(`git diff --name-only ${baseBranch}...HEAD`, {
      cwd: repo,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10000, // 10s timeout para evitar loops
    });

    return output
      .trim()
      .split('\n')
      .filter((f) => f && (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.py') || f.endsWith('.go')));
  } catch (error) {
    console.warn('⚠️  Erro ao obter diff:', error);
    return [];
  }
}

/**
 * Obtém linhas alteradas por arquivo
 */
async function getDiffLinesPerFile(
  repo: string,
  baseBranch: string,
  files: string[]
): Promise<Record<string, number[]>> {
  const result: Record<string, number[]> = {};

  for (const file of files) {
    try {
      const output = execSync(`git diff ${baseBranch}...HEAD -- ${file}`, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 10000, // 10s timeout
      });

      // Parsear output do git diff
      const lines = output.split('\n');
      const addedLines: number[] = [];
      let currentLine = 0;

      for (const line of lines) {
        // @@ -10,5 +12,7 @@ significa: começa na linha 12
        const match = line.match(/^@@ -\d+,\d+ \+(\d+),\d+ @@/);
        if (match) {
          currentLine = parseInt(match[1]);
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          addedLines.push(currentLine);
          currentLine++;
        } else if (!line.startsWith('-')) {
          currentLine++;
        }
      }

      result[file] = addedLines;
    } catch {
      // Ignorar erros (arquivo deletado, etc)
    }
  }

  return result;
}

/**
 * Encontra arquivo de coverage
 */
async function findCoverageFile(repo: string): Promise<string | null> {
  const candidates = [
    join(repo, 'coverage', 'lcov.info'),
    join(repo, 'coverage', 'coverage-summary.json'),
    join(repo, 'coverage.xml'),
    join(repo, 'coverage.out'),
  ];

  for (const file of candidates) {
    if (existsSync(file)) {
      return file;
    }
  }

  return null;
}

/**
 * Gera relatório DIFF-COVERAGE.md
 */
async function generateDiffCoverageReport(
  reportPath: string,
  data: {
    diffCoverage: number;
    linesAdded: number;
    linesCovered: number;
    files: Array<{ file: string; linesAdded: number; linesCovered: number; coverage: number }>;
    baseBranch: string;
    minCoverage: number;
    ok: boolean;
  }
): Promise<void> {
  let content = `# 📊 Diff Coverage Report\n\n`;
  content += `**Branch base**: \`${data.baseBranch}\`\n`;
  content += `**Data**: ${new Date().toISOString().split('T')[0]}\n\n`;
  content += `---\n\n`;

  // Status
  const icon = data.ok ? '✅' : '❌';
  const status = data.ok ? 'APROVADO' : 'REPROVADO';

  content += `## ${icon} Status: ${status}\n\n`;
  content += `- **Diff Coverage**: **${data.diffCoverage.toFixed(2)}%**\n`;
  content += `- **Mínimo Exigido**: ${data.minCoverage}%\n`;
  content += `- **Linhas Adicionadas**: ${data.linesAdded}\n`;
  content += `- **Linhas Cobertas**: ${data.linesCovered}\n\n`;

  // Detalhes por arquivo
  content += `## 📁 Arquivos Alterados\n\n`;
  content += `| Arquivo | Linhas | Cobertas | Coverage |\n`;
  content += `|---------|--------|----------|----------|\n`;

  for (const file of data.files) {
    const icon = file.coverage >= data.minCoverage ? '✅' : '❌';
    content += `| ${icon} ${file.file} | ${file.linesAdded} | ${file.linesCovered} | ${file.coverage.toFixed(1)}% |\n`;
  }

  content += `\n`;

  // Recomendações
  if (!data.ok) {
    content += `## 🎯 Recomendações\n\n`;
    content += `- Adicione testes para as linhas não cobertas\n`;
    content += `- Execute \`quality coverage --repo .\` para ver detalhes\n`;
    content += `- Coverage mínimo do diff deve ser ${data.minCoverage}%\n\n`;
  }

  content += `---\n\n`;
  content += `*Gerado por Quality MCP*\n`;

  await writeFileSafe(reportPath, content);
  console.log(`📄 Relatório salvo: ${reportPath}`);
}

export default runDiffCoverage;
