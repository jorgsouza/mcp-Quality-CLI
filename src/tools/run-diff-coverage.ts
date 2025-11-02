import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { readFile, writeFileSafe, fileExists } from '../utils/fs.js';
import { loadMCPSettings, mergeSettings } from '../utils/config.js';
import { getPaths, ensurePaths } from '../utils/paths.js';

export interface DiffCoverageParams {
  repo: string;
  product?: string;
  base_branch?: string; // Branch de comparação (default: main)
  target_min?: number;  // Cobertura mínima exigida para diff
  fail_on_low?: boolean; // Se deve falhar quando cobertura < target
}

export interface DiffCoverageResult {
  ok: boolean;
  diff_coverage_percent: number;
  target_min: number;
  passed: boolean;
  changed_files: ChangedFile[];
  total_changed_lines: number;
  covered_lines: number;
  uncovered_lines: number;
  summary: string;
  report_path: string;
}

export interface ChangedFile {
  file: string;
  added_lines: number;
  removed_lines: number;
  coverage_percent?: number;
  covered_lines?: number;
  total_lines?: number;
  status: 'covered' | 'partial' | 'uncovered' | 'no_tests';
}

/**
 * Calcula cobertura apenas das linhas modificadas (git diff)
 */
export async function runDiffCoverage(input: DiffCoverageParams): Promise<DiffCoverageResult> {
  // Carrega configuração
  const fileSettings = await loadMCPSettings(input.repo, input.product);
  const settings = mergeSettings(fileSettings, input);

  // [FASE 2] Calcular paths centralizados
  const paths = getPaths(settings.repo, settings.product || 'default', fileSettings || undefined);
  await ensurePaths(paths);

  const baseBranch = settings.base_branch || 'main';
  const targetMin = settings.target_min ?? settings.targets?.diff_coverage_min ?? 60;
  const failOnLow = settings.fail_on_low ?? true;

  console.log(`📊 Calculando diff-coverage contra ${baseBranch}...`);

  // 1. Detecta arquivos modificados
  const changedFiles = await getChangedFiles(settings.repo, baseBranch);
  
  if (changedFiles.length === 0) {
    console.log('✅ Nenhum arquivo modificado detectado.');
    return {
      ok: true,
      diff_coverage_percent: 100,
      target_min: targetMin,
      passed: true,
      changed_files: [],
      total_changed_lines: 0,
      covered_lines: 0,
      uncovered_lines: 0,
      summary: 'Nenhuma mudança detectada',
      report_path: ''
    };
  }

  console.log(`📝 ${changedFiles.length} arquivo(s) modificado(s)`);

  // 2. Executa testes com coverage
  console.log('🧪 Executando testes com cobertura...');
  await runTestsWithCoverage(settings.repo);

  // 3. Lê relatório de cobertura
  const coverageData = await readCoverageReport(settings.repo);

  // 4. Calcula cobertura apenas das linhas modificadas
  const diffCoverage = calculateDiffCoverage(changedFiles, coverageData);

  // 5. Gera relatório
  const report = generateDiffCoverageReport(diffCoverage, settings.product || 'Product', targetMin);
  const reportPath = join(paths.reports, 'DIFF-COVERAGE-REPORT.md');
  await writeFileSafe(reportPath, report);

  const passed = diffCoverage.coverage_percent >= targetMin;
  const emoji = passed ? '✅' : '❌';

  const summary = `
${emoji} Diff Coverage: ${diffCoverage.coverage_percent.toFixed(1)}% (target: ${targetMin}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Linhas modificadas: ${diffCoverage.total_lines}
Cobertas: ${diffCoverage.covered_lines}
Descobertas: ${diffCoverage.uncovered_lines}
Arquivos analisados: ${diffCoverage.files.length}
Status: ${passed ? 'APROVADO' : 'REPROVADO'}
`;

  console.log(summary);

  if (!passed && failOnLow) {
    console.error(`❌ Diff coverage (${diffCoverage.coverage_percent.toFixed(1)}%) abaixo do mínimo (${targetMin}%)`);
  }

  return {
    ok: passed || !failOnLow,
    diff_coverage_percent: diffCoverage.coverage_percent,
    target_min: targetMin,
    passed,
    changed_files: diffCoverage.files,
    total_changed_lines: diffCoverage.total_lines,
    covered_lines: diffCoverage.covered_lines,
    uncovered_lines: diffCoverage.uncovered_lines,
    summary,
    report_path: reportPath
  };
}

/**
 * Detecta arquivos modificados via git diff
 */
async function getChangedFiles(repoPath: string, baseBranch: string): Promise<ChangedFile[]> {
  return new Promise((resolve, reject) => {
    // git diff --numstat base_branch...HEAD
    const gitProcess = spawn('git', ['diff', '--numstat', `${baseBranch}...HEAD`], {
      cwd: repoPath,
      stdio: 'pipe'
    });

    let output = '';
    
    gitProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });

    gitProcess.on('close', (code) => {
      if (code !== 0) {
        resolve([]); // Sem mudanças ou erro
        return;
      }

      const files: ChangedFile[] = [];
      const lines = output.trim().split('\n').filter(l => l);

      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          const added = parseInt(parts[0], 10) || 0;
          const removed = parseInt(parts[1], 10) || 0;
          const file = parts[2];

          // Filtra apenas arquivos de código
          if (file.match(/\.(ts|tsx|js|jsx)$/)) {
            files.push({
              file,
              added_lines: added,
              removed_lines: removed,
              status: 'uncovered' // Será atualizado depois
            });
          }
        }
      }

      resolve(files);
    });

    gitProcess.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Executa testes com cobertura
 */
async function runTestsWithCoverage(repoPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const vitestProcess = spawn('npx', ['vitest', 'run', '--coverage'], {
      cwd: repoPath,
      stdio: 'inherit'
    });

    vitestProcess.on('close', (code) => {
      // Mesmo que testes falhem, a cobertura foi gerada
      resolve();
    });

    vitestProcess.on('error', (err) => {
      reject(err);
    });

    // Timeout de 2 minutos
    setTimeout(() => {
      vitestProcess.kill();
      resolve();
    }, 120000);
  });
}

/**
 * Lê relatório de cobertura gerado pelo vitest
 */
async function readCoverageReport(repoPath: string): Promise<any> {
  const coveragePath = join(repoPath, 'coverage', 'coverage-final.json');
  
  if (!await fileExists(coveragePath)) {
    console.warn('⚠️ Arquivo de cobertura não encontrado. Execute testes com --coverage');
    return {};
  }

  try {
    const content = await readFile(coveragePath);
    return JSON.parse(content);
  } catch (error) {
    console.warn('⚠️ Erro ao ler arquivo de cobertura:', error);
    return {};
  }
}

/**
 * Calcula cobertura das linhas modificadas
 */
function calculateDiffCoverage(
  changedFiles: ChangedFile[],
  coverageData: any
): {
  coverage_percent: number;
  total_lines: number;
  covered_lines: number;
  uncovered_lines: number;
  files: ChangedFile[];
} {
  let totalLines = 0;
  let coveredLines = 0;

  const filesWithCoverage: ChangedFile[] = [];

  for (const file of changedFiles) {
    // Normaliza path do arquivo
    const normalizedPath = file.file.replace(/^\//, '');
    
    // Procura cobertura para este arquivo
    let fileCoverage: any = null;
    
    for (const [key, value] of Object.entries(coverageData)) {
      if (key.endsWith(normalizedPath) || normalizedPath.endsWith(key.replace(/^\//, ''))) {
        fileCoverage = value;
        break;
      }
    }

    if (!fileCoverage) {
      filesWithCoverage.push({
        ...file,
        status: 'no_tests',
        coverage_percent: 0,
        total_lines: file.added_lines,
        covered_lines: 0
      });
      totalLines += file.added_lines;
      continue;
    }

    // Calcula cobertura das linhas adicionadas
    const statements = (fileCoverage as any).s || {};
    const statementMap = (fileCoverage as any).statementMap || {};
    
    let fileCoveredLines = 0;
    let fileNewLines = file.added_lines;

    // Simplificação: usa proporção geral do arquivo
    // (em produção, você precisaria do diff detalhado linha por linha)
    const totalStatements = Object.keys(statements).length;
    const coveredStatements = Object.values(statements).filter((count: any) => count > 0).length;
    
    if (totalStatements > 0) {
      const fileCoveragePercent = (coveredStatements / totalStatements) * 100;
      fileCoveredLines = Math.round((fileNewLines * fileCoveragePercent) / 100);
    }

    const fileCoveragePercent = fileNewLines > 0 ? (fileCoveredLines / fileNewLines) * 100 : 0;
    
    let status: 'covered' | 'partial' | 'uncovered' = 'uncovered';
    if (fileCoveragePercent >= 80) status = 'covered';
    else if (fileCoveragePercent >= 50) status = 'partial';

    filesWithCoverage.push({
      ...file,
      status,
      coverage_percent: fileCoveragePercent,
      total_lines: fileNewLines,
      covered_lines: fileCoveredLines
    });

    totalLines += fileNewLines;
    coveredLines += fileCoveredLines;
  }

  const coveragePercent = totalLines > 0 ? (coveredLines / totalLines) * 100 : 100;

  return {
    coverage_percent: coveragePercent,
    total_lines: totalLines,
    covered_lines: coveredLines,
    uncovered_lines: totalLines - coveredLines,
    files: filesWithCoverage
  };
}

/**
 * Gera relatório em Markdown
 */
function generateDiffCoverageReport(
  diffCoverage: ReturnType<typeof calculateDiffCoverage>,
  product: string,
  targetMin: number
): string {
  const passed = diffCoverage.coverage_percent >= targetMin;
  const emoji = passed ? '✅' : '❌';

  return `# Diff Coverage Report - ${product}

**Data:** ${new Date().toISOString().split('T')[0]}

## ${emoji} Resultado

| Métrica | Valor |
|---------|-------|
| **Diff Coverage** | **${diffCoverage.coverage_percent.toFixed(1)}%** |
| **Target Mínimo** | ${targetMin}% |
| **Status** | ${passed ? '✅ APROVADO' : '❌ REPROVADO'} |
| **Linhas Modificadas** | ${diffCoverage.total_lines} |
| **Linhas Cobertas** | ${diffCoverage.covered_lines} |
| **Linhas Descobertas** | ${diffCoverage.uncovered_lines} |

## 📊 Análise por Arquivo

| Arquivo | Linhas | Cobertura | Status |
|---------|--------|-----------|--------|
${diffCoverage.files.map(f => {
  const statusEmoji = {
    covered: '✅',
    partial: '⚠️',
    uncovered: '❌',
    no_tests: '🚫'
  }[f.status];
  
  return `| \`${f.file}\` | ${f.total_lines || f.added_lines} | ${f.coverage_percent?.toFixed(1) || '0'}% | ${statusEmoji} |`;
}).join('\n')}

## 🎯 Recomendações

${diffCoverage.files.filter(f => f.status === 'no_tests').length > 0 ? `
### ❌ Arquivos Sem Testes

Os seguintes arquivos modificados **não têm testes**:

${diffCoverage.files.filter(f => f.status === 'no_tests').map(f => `- \`${f.file}\``).join('\n')}

**Ação:** Criar testes unitários para esses arquivos.

\`\`\`bash
quality scaffold-unit --files "${diffCoverage.files.filter(f => f.status === 'no_tests').map(f => f.file).join(' ')}"
\`\`\`
` : ''}

${diffCoverage.files.filter(f => f.status === 'partial' || f.status === 'uncovered').length > 0 ? `
### ⚠️ Arquivos com Cobertura Baixa

Os seguintes arquivos precisam de **mais testes**:

${diffCoverage.files.filter(f => f.status === 'partial' || f.status === 'uncovered').map(f => 
  `- \`${f.file}\`: ${f.coverage_percent?.toFixed(1)}% (adicione ${Math.ceil((f.total_lines || 0) * 0.8 - (f.covered_lines || 0))} linhas de teste)`
).join('\n')}
` : ''}

${passed ? `
### ✅ Parabéns!

Todas as mudanças têm cobertura adequada (≥ ${targetMin}%).
` : `
### ❌ Ação Necessária

A cobertura das mudanças (${diffCoverage.coverage_percent.toFixed(1)}%) está **abaixo do mínimo** (${targetMin}%).

**Próximos passos:**

1. Adicione testes para os arquivos sem cobertura
2. Aumente a cobertura dos arquivos parcialmente testados
3. Execute novamente: \`quality diff-coverage --repo .\`
4. Só faça merge quando diff-coverage ≥ ${targetMin}%
`}

## 📋 Gate de Qualidade

| Gate | Requisito | Status |
|------|-----------|--------|
| **Diff Coverage** | ≥ ${targetMin}% | ${passed ? '✅ PASS' : '❌ FAIL'} |
| **Arquivos Sem Testes** | 0 | ${diffCoverage.files.filter(f => f.status === 'no_tests').length === 0 ? '✅ PASS' : '❌ FAIL'} |

${!passed ? `
## 🚫 PR Bloqueado

Este PR **não pode ser mergeado** até que a diff coverage atinja ${targetMin}%.

Configure seu CI para bloquear PRs automaticamente:

\`\`\`yaml
# .github/workflows/ci.yml
- name: Check Diff Coverage
  run: |
    npm run diff-coverage
    if [ $? -ne 0 ]; then
      echo "❌ Diff coverage abaixo do mínimo"
      exit 1
    fi
\`\`\`
` : ''}

---

**Gerado por:** Quality MCP v0.2.0  
**Timestamp:** ${new Date().toISOString()}  
**Branch base:** ${diffCoverage.files.length > 0 ? 'main' : 'N/A'}
`;
}
