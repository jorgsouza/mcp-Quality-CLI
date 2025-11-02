import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { writeFileSafe } from '../utils/fs.js';
import { detectLanguage, type LanguageDetection } from '../detectors/language.js';
import { getPaths, ensurePaths } from '../utils/paths.js';

const exec = promisify(execFile);

// Parser para diferentes formatos de cobertura
async function parseCoverageFile(filePath: string, lang: LanguageDetection): Promise<any> {
  const content = await fs.readFile(filePath, 'utf-8');

  switch (lang.framework) {
    case 'vitest':
    case 'jest':
    case 'mocha':
      // JSON format (Istanbul/NYC)
      return JSON.parse(content);

    case 'junit':
      // JaCoCo XML format
      return parseJaCoCoXML(content);

    case 'go-test':
      // Go coverage.out format
      return parseGoCoverage(content);

    case 'rspec':
    case 'minitest':
      // SimpleCov JSON format
      return parseSimpleCov(content);

    case 'pytest':
      // Coverage.py JSON format
      return parsePytestCoverage(content);

    case 'nunit':
      // Cobertura XML format
      return parseCoberturaXML(content);

    case 'phpunit':
      // Clover XML format
      return parseCloverXML(content);

    case 'cargo-test':
      // Tarpaulin JSON format
      return JSON.parse(content);

    default:
      // Tentar JSON primeiro
      try {
        return JSON.parse(content);
      } catch {
        throw new Error(`Formato de cobertura não suportado para ${lang.framework}`);
      }
  }
}

export function parseJaCoCoXML(xml: string): any {
  // Simplificado: extrair métricas do XML JaCoCo
  const lines = xml.match(/<counter type="LINE" missed="(\d+)" covered="(\d+)"\/>/);
  const branches = xml.match(/<counter type="BRANCH" missed="(\d+)" covered="(\d+)"\/>/);
  const methods = xml.match(/<counter type="METHOD" missed="(\d+)" covered="(\d+)"\/>/);

  const linesMissed = lines ? parseInt(lines[1]) : 0;
  const linesCovered = lines ? parseInt(lines[2]) : 0;
  const linesTotal = linesMissed + linesCovered;

  const branchesMissed = branches ? parseInt(branches[1]) : 0;
  const branchesCovered = branches ? parseInt(branches[2]) : 0;
  const branchesTotal = branchesMissed + branchesCovered;

  const methodsMissed = methods ? parseInt(methods[1]) : 0;
  const methodsCovered = methods ? parseInt(methods[2]) : 0;
  const methodsTotal = methodsMissed + methodsCovered;

  return {
    total: {
      lines: {
        total: linesTotal,
        covered: linesCovered,
        pct: linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0
      },
      functions: {
        total: methodsTotal,
        covered: methodsCovered,
        pct: methodsTotal > 0 ? (methodsCovered / methodsTotal) * 100 : 0
      },
      branches: {
        total: branchesTotal,
        covered: branchesCovered,
        pct: branchesTotal > 0 ? (branchesCovered / branchesTotal) * 100 : 0
      },
      statements: {
        total: linesTotal,
        covered: linesCovered,
        pct: linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0
      }
    }
  };
}

export function parseGoCoverage(content: string): any {
  // Parse Go coverage.out format
  const lines = content.split('\n').filter(l => l && !l.startsWith('mode:'));
  let totalStatements = 0;
  let coveredStatements = 0;

  for (const line of lines) {
    const parts = line.split(' ');
    if (parts.length >= 3) {
      const count = parseInt(parts[2]);
      totalStatements++;
      if (count > 0) coveredStatements++;
    }
  }

  const pct = totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0;

  return {
    total: {
      lines: { total: totalStatements, covered: coveredStatements, pct },
      functions: { total: 0, covered: 0, pct: 0 },
      branches: { total: 0, covered: 0, pct: 0 },
      statements: { total: totalStatements, covered: coveredStatements, pct }
    }
  };
}

export function parseSimpleCov(content: string): any {
  // Parse SimpleCov JSON format
  const data = JSON.parse(content);
  const coverage = data.coverage || data;
  
  let totalLines = 0;
  let coveredLines = 0;

  for (const file in coverage) {
    const fileCoverage = coverage[file];
    if (Array.isArray(fileCoverage)) {
      for (const line of fileCoverage) {
        if (line !== null) {
          totalLines++;
          if (line > 0) coveredLines++;
        }
      }
    }
  }

  const pct = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;

  return {
    total: {
      lines: { total: totalLines, covered: coveredLines, pct },
      functions: { total: 0, covered: 0, pct: 0 },
      branches: { total: 0, covered: 0, pct: 0 },
      statements: { total: totalLines, covered: coveredLines, pct }
    }
  };
}

export function parsePytestCoverage(content: string): any {
  // Parse coverage.py JSON format
  const data = JSON.parse(content);
  const totals = data.totals;

  return {
    total: {
      lines: {
        total: totals.num_statements,
        covered: totals.covered_lines,
        pct: totals.percent_covered
      },
      functions: { total: 0, covered: 0, pct: 0 },
      branches: {
        total: totals.num_branches || 0,
        covered: totals.covered_branches || 0,
        pct: totals.num_branches > 0 ? (totals.covered_branches / totals.num_branches) * 100 : 0
      },
      statements: {
        total: totals.num_statements,
        covered: totals.covered_lines,
        pct: totals.percent_covered
      }
    }
  };
}

export function parseCoberturaXML(xml: string): any {
  // Parse Cobertura XML format (usado por .NET)
  const lineRate = xml.match(/line-rate="([\d.]+)"/);
  const branchRate = xml.match(/branch-rate="([\d.]+)"/);
  
  const linePct = lineRate ? parseFloat(lineRate[1]) * 100 : 0;
  const branchPct = branchRate ? parseFloat(branchRate[1]) * 100 : 0;

  return {
    total: {
      lines: { total: 100, covered: Math.round(linePct), pct: linePct },
      functions: { total: 0, covered: 0, pct: 0 },
      branches: { total: 100, covered: Math.round(branchPct), pct: branchPct },
      statements: { total: 100, covered: Math.round(linePct), pct: linePct }
    }
  };
}

export function parseCloverXML(xml: string): any {
  // Parse Clover XML format (usado por PHPUnit)
  const metrics = xml.match(/<metrics\s+([^>]+)>/);
  
  if (!metrics) {
    return {
      total: {
        lines: { total: 0, covered: 0, pct: 0 },
        functions: { total: 0, covered: 0, pct: 0 },
        branches: { total: 0, covered: 0, pct: 0 },
        statements: { total: 0, covered: 0, pct: 0 }
      }
    };
  }

  const elements = metrics[1].match(/elements="(\d+)"/);
  const coveredElements = metrics[1].match(/coveredelements="(\d+)"/);
  const statements = metrics[1].match(/statements="(\d+)"/);
  const coveredStatements = metrics[1].match(/coveredstatements="(\d+)"/);

  const elementsTotal = elements ? parseInt(elements[1]) : 0;
  const elementsCovered = coveredElements ? parseInt(coveredElements[1]) : 0;
  const statementsTotal = statements ? parseInt(statements[1]) : 0;
  const statementsCovered = coveredStatements ? parseInt(coveredStatements[1]) : 0;

  const elementsPct = elementsTotal > 0 ? (elementsCovered / elementsTotal) * 100 : 0;
  const statementsPct = statementsTotal > 0 ? (statementsCovered / statementsTotal) * 100 : 0;

  return {
    total: {
      lines: { total: elementsTotal, covered: elementsCovered, pct: elementsPct },
      functions: { total: 0, covered: 0, pct: 0 },
      branches: { total: 0, covered: 0, pct: 0 },
      statements: { total: statementsTotal, covered: statementsCovered, pct: statementsPct }
    }
  };
}

export interface RunCoverageParams {
  repo: string;
  product: string; // [FASE 2] Necessário para getPaths()
  thresholds?: {
    lines?: number;
    functions?: number;
    branches?: number;
    statements?: number;
  };
}

export interface CoverageResult {
  ok: boolean;
  error?: string;
  summary: {
    lines: { total: number; covered: number; pct: number };
    functions: { total: number; covered: number; pct: number };
    branches: { total: number; covered: number; pct: number };
    statements: { total: number; covered: number; pct: number };
  };
  files: Array<{
    path: string;
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  }>;
  analysis: {
    status: 'excellent' | 'good' | 'needs_improvement' | 'critical';
    meetsThresholds: boolean;
    gaps: string[];
    recommendations: string[];
    priorities: Array<{
      file: string;
      coverage: number;
      priority: 'high' | 'medium' | 'low';
      reason: string;
    }>;
  };
  reportPath: string;
}

export async function runCoverageAnalysis(input: RunCoverageParams): Promise<CoverageResult> {
  console.log(`📊 Executando testes com cobertura...`);

  // [FASE 2] Calcular paths padronizados e garantir que existem
  const paths = getPaths(input.repo, input.product);
  await ensurePaths(paths);

  const thresholds = {
    lines: input.thresholds?.lines ?? 70,
    functions: input.thresholds?.functions ?? 70,
    branches: input.thresholds?.branches ?? 70,
    statements: input.thresholds?.statements ?? 70
  };

  try {
    // Detectar linguagem e framework
    const lang = await detectLanguage(input.repo);
    console.log(`📦 Linguagem: ${lang.primary}`);
    console.log(`🧪 Framework: ${lang.framework}`);
    console.log(`⚙️  Comando: ${lang.coverageCommand}`);

    // Executar testes com cobertura
    const [command, ...args] = lang.coverageCommand.split(' ');
    const { stdout, stderr } = await exec(command, args, {
      cwd: input.repo,
      env: { ...process.env, CI: 'true' },
      maxBuffer: 10 * 1024 * 1024, // 10MB
      shell: true
    });

    console.log(`✅ Testes executados com sucesso!`);

    // Ler arquivo de cobertura
    const coveragePath = join(input.repo, lang.coverageFile);
    const coverageExists = await fs.access(coveragePath).then(() => true).catch(() => false);

    if (!coverageExists) {
      throw new Error(`Arquivo de cobertura não encontrado: ${lang.coverageFile}. Certifique-se de que ${lang.framework} está configurado para gerar cobertura.`);
    }

    // Parsear cobertura baseado na linguagem
    const coverageData = await parseCoverageFile(coveragePath, lang);

    // Extrair dados de cobertura total
    const total = coverageData.total;
    const summary = {
      lines: {
        total: total.lines.total,
        covered: total.lines.covered,
        pct: total.lines.pct
      },
      functions: {
        total: total.functions.total,
        covered: total.functions.covered,
        pct: total.functions.pct
      },
      branches: {
        total: total.branches.total,
        covered: total.branches.covered,
        pct: total.branches.pct
      },
      statements: {
        total: total.statements.total,
        covered: total.statements.covered,
        pct: total.statements.pct
      }
    };

    console.log(`\n📊 Cobertura Geral:`);
    console.log(`   Lines:      ${summary.lines.pct.toFixed(2)}% (${summary.lines.covered}/${summary.lines.total})`);
    console.log(`   Functions:  ${summary.functions.pct.toFixed(2)}% (${summary.functions.covered}/${summary.functions.total})`);
    console.log(`   Branches:   ${summary.branches.pct.toFixed(2)}% (${summary.branches.covered}/${summary.branches.total})`);
    console.log(`   Statements: ${summary.statements.pct.toFixed(2)}% (${summary.statements.covered}/${summary.statements.total})`);

    // Extrair dados por arquivo
    const files: Array<{
      path: string;
      lines: number;
      functions: number;
      branches: number;
      statements: number;
    }> = [];

    for (const [filePath, fileData] of Object.entries(coverageData)) {
      if (filePath === 'total') continue;

      const data = fileData as any;
      files.push({
        path: filePath.replace(input.repo + '/', ''),
        lines: data.lines.pct,
        functions: data.functions.pct,
        branches: data.branches.pct,
        statements: data.statements.pct
      });
    }

    // Ordenar por menor cobertura
    files.sort((a, b) => a.lines - b.lines);

    // Analisar cobertura
    const analysis = analyzeCoverage(summary, files, thresholds);

    console.log(`\n🎯 Status: ${getStatusEmoji(analysis.status)} ${analysis.status.toUpperCase()}`);
    console.log(`   Atende thresholds: ${analysis.meetsThresholds ? '✅' : '❌'}`);

    if (analysis.gaps.length > 0) {
      console.log(`\n⚠️  Gaps detectados:`);
      analysis.gaps.forEach(gap => console.log(`   - ${gap}`));
    }

    if (analysis.recommendations.length > 0) {
      console.log(`\n💡 Recomendações:`);
      analysis.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }

    if (analysis.priorities.length > 0) {
      console.log(`\n🎯 Prioridades (arquivos com menor cobertura):`);
      analysis.priorities.slice(0, 5).forEach((p, i) => {
        const emoji = p.priority === 'high' ? '🔴' : p.priority === 'medium' ? '🟡' : '🟢';
        console.log(`   ${i + 1}. ${emoji} ${p.file} (${p.coverage.toFixed(1)}%) - ${p.reason}`);
      });
    }

    // Gerar relatório detalhado com paths padronizados
    const reportPath = await generateCoverageReport(input.repo, paths, summary, files, analysis, thresholds);
    console.log(`\n📄 Relatório detalhado: ${reportPath}`);

    return {
      ok: true,
      summary,
      files,
      analysis,
      reportPath
    };

  } catch (error: any) {
    console.error(`❌ Erro ao executar cobertura:`, error.message);
    
    // Se falhou, retornar resultado parcial
    return {
      ok: false,
      error: error.message,
      summary: {
        lines: { total: 0, covered: 0, pct: 0 },
        functions: { total: 0, covered: 0, pct: 0 },
        branches: { total: 0, covered: 0, pct: 0 },
        statements: { total: 0, covered: 0, pct: 0 }
      },
      files: [],
      analysis: {
        status: 'critical',
        meetsThresholds: false,
        gaps: ['Não foi possível executar os testes com cobertura'],
        recommendations: ['Verifique se o Vitest está configurado corretamente', 'Execute npm install para garantir que todas as dependências estão instaladas'],
        priorities: []
      },
      reportPath: ''
    };
  }
}

function analyzeCoverage(
  summary: CoverageResult['summary'],
  files: CoverageResult['files'],
  thresholds: Required<NonNullable<RunCoverageParams['thresholds']>>
): CoverageResult['analysis'] {
  const gaps: string[] = [];
  const recommendations: string[] = [];
  const priorities: CoverageResult['analysis']['priorities'] = [];

  // Verificar se atende thresholds
  const meetsThresholds = 
    summary.lines.pct >= thresholds.lines &&
    summary.functions.pct >= thresholds.functions &&
    summary.branches.pct >= thresholds.branches &&
    summary.statements.pct >= thresholds.statements;

  // Determinar status geral
  const avgCoverage = (
    summary.lines.pct +
    summary.functions.pct +
    summary.branches.pct +
    summary.statements.pct
  ) / 4;

  let status: CoverageResult['analysis']['status'];
  if (avgCoverage >= 80) status = 'excellent';
  else if (avgCoverage >= 70) status = 'good';
  else if (avgCoverage >= 50) status = 'needs_improvement';
  else status = 'critical';

  // Identificar gaps
  if (summary.lines.pct < thresholds.lines) {
    gaps.push(`Cobertura de linhas (${summary.lines.pct.toFixed(1)}%) abaixo do threshold (${thresholds.lines}%)`);
    recommendations.push(`Adicionar testes para cobrir mais ${Math.ceil(summary.lines.total * (thresholds.lines / 100) - summary.lines.covered)} linhas`);
  }

  if (summary.functions.pct < thresholds.functions) {
    gaps.push(`Cobertura de funções (${summary.functions.pct.toFixed(1)}%) abaixo do threshold (${thresholds.functions}%)`);
    recommendations.push(`Testar mais ${Math.ceil(summary.functions.total * (thresholds.functions / 100) - summary.functions.covered)} funções`);
  }

  if (summary.branches.pct < thresholds.branches) {
    gaps.push(`Cobertura de branches (${summary.branches.pct.toFixed(1)}%) abaixo do threshold (${thresholds.branches}%)`);
    recommendations.push(`Adicionar testes para cobrir condicionais (if/else, switch, ternários)`);
  }

  if (summary.statements.pct < thresholds.statements) {
    gaps.push(`Cobertura de statements (${summary.statements.pct.toFixed(1)}%) abaixo do threshold (${thresholds.statements}%)`);
  }

  // Identificar arquivos com baixa cobertura
  for (const file of files) {
    if (file.lines < 50) {
      priorities.push({
        file: file.path,
        coverage: file.lines,
        priority: 'high',
        reason: 'Cobertura crítica (<50%)'
      });
    } else if (file.lines < 70) {
      priorities.push({
        file: file.path,
        coverage: file.lines,
        priority: 'medium',
        reason: 'Cobertura abaixo do ideal'
      });
    } else if (file.lines < 80) {
      priorities.push({
        file: file.path,
        coverage: file.lines,
        priority: 'low',
        reason: 'Cobertura boa, pode melhorar'
      });
    }
  }

  // Recomendações gerais
  if (meetsThresholds && status === 'excellent') {
    recommendations.push('✅ Cobertura excelente! Continue mantendo os testes atualizados.');
  } else if (status === 'good') {
    recommendations.push('Considere aumentar a cobertura para 80%+ para maior confiabilidade');
  } else if (status === 'needs_improvement') {
    recommendations.push('Priorize adicionar testes para arquivos críticos (detectores, tools)');
    recommendations.push('Foque em testar happy path + edge cases + error handling');
  } else {
    recommendations.push('⚠️ URGENTE: Cobertura muito baixa! Adicione testes imediatamente.');
    recommendations.push('Comece pelos arquivos mais críticos (detectores, utils, tools)');
  }

  // Recomendações específicas baseadas em gaps
  if (summary.branches.pct < 70) {
    recommendations.push('Adicione testes para cobrir diferentes caminhos de execução (if/else)');
  }

  if (priorities.length > 10) {
    recommendations.push(`${priorities.length} arquivos precisam de mais testes - priorize os 5 primeiros`);
  }

  return {
    status,
    meetsThresholds,
    gaps,
    recommendations,
    priorities
  };
}

async function generateCoverageReport(
  repo: string,
  paths: ReturnType<typeof getPaths>, // [FASE 2] Adicionar paths para salvar no local correto
  summary: CoverageResult['summary'],
  files: CoverageResult['files'],
  analysis: CoverageResult['analysis'],
  thresholds: Required<NonNullable<RunCoverageParams['thresholds']>>
): Promise<string> {
  const date = new Date().toLocaleDateString('pt-BR');
  const statusEmoji = getStatusEmoji(analysis.status);

  const md = `# 📊 Relatório de Cobertura de Código

**Data:** ${date}  
**Status:** ${statusEmoji} **${analysis.status.toUpperCase()}**  
**Atende Thresholds:** ${analysis.meetsThresholds ? '✅ SIM' : '❌ NÃO'}

---

## 📈 Cobertura Geral

| Métrica | Cobertura | Coberto | Total | Threshold | Status |
|---------|-----------|---------|-------|-----------|--------|
| **Lines** | ${summary.lines.pct.toFixed(2)}% | ${summary.lines.covered} | ${summary.lines.total} | ${thresholds.lines}% | ${summary.lines.pct >= thresholds.lines ? '✅' : '❌'} |
| **Functions** | ${summary.functions.pct.toFixed(2)}% | ${summary.functions.covered} | ${summary.functions.total} | ${thresholds.functions}% | ${summary.functions.pct >= thresholds.functions ? '✅' : '❌'} |
| **Branches** | ${summary.branches.pct.toFixed(2)}% | ${summary.branches.covered} | ${summary.branches.total} | ${thresholds.branches}% | ${summary.branches.pct >= thresholds.branches ? '✅' : '❌'} |
| **Statements** | ${summary.statements.pct.toFixed(2)}% | ${summary.statements.covered} | ${summary.statements.total} | ${thresholds.statements}% | ${summary.statements.pct >= thresholds.statements ? '✅' : '❌'} |

**Média Geral:** ${((summary.lines.pct + summary.functions.pct + summary.branches.pct + summary.statements.pct) / 4).toFixed(2)}%

---

## ${analysis.gaps.length > 0 ? '⚠️' : '✅'} Gaps Detectados

${analysis.gaps.length > 0 ? analysis.gaps.map(gap => `- ❌ ${gap}`).join('\n') : '✅ Nenhum gap detectado! Todos os thresholds foram atingidos.'}

---

## 💡 Recomendações

${analysis.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

---

## 🎯 Arquivos Prioritários (Menor Cobertura)

${analysis.priorities.length > 0 ? `
| # | Arquivo | Cobertura | Prioridade | Razão |
|---|---------|-----------|------------|-------|
${analysis.priorities.slice(0, 10).map((p, i) => {
  const emoji = p.priority === 'high' ? '🔴' : p.priority === 'medium' ? '🟡' : '🟢';
  return `| ${i + 1} | \`${p.file}\` | ${p.coverage.toFixed(1)}% | ${emoji} ${p.priority.toUpperCase()} | ${p.reason} |`;
}).join('\n')}
` : '✅ Todos os arquivos têm cobertura adequada!'}

---

## 📊 Cobertura por Arquivo (Todos)

<details>
<summary>Ver todos os arquivos (${files.length})</summary>

| Arquivo | Lines | Functions | Branches | Statements |
|---------|-------|-----------|----------|------------|
${files.map(f => `| \`${f.path}\` | ${f.lines.toFixed(1)}% | ${f.functions.toFixed(1)}% | ${f.branches.toFixed(1)}% | ${f.statements.toFixed(1)}% |`).join('\n')}

</details>

---

## 🎯 Próximos Passos

${analysis.meetsThresholds ? `
### ✅ Cobertura Adequada

Sua cobertura está acima dos thresholds! Continue assim:

1. ✅ Manter testes atualizados ao adicionar novas features
2. ✅ Revisar testes em PRs
3. ✅ Considere aumentar thresholds gradualmente (ex: 75%, 80%)
4. ✅ Adicionar mutation testing (opcional)

` : `
### ⚠️ Ação Necessária

Sua cobertura está abaixo dos thresholds. Priorize:

1. 🔴 **ALTA:** Adicionar testes para arquivos com <50% de cobertura
2. 🟡 **MÉDIA:** Melhorar cobertura de arquivos entre 50-70%
3. 🟢 **BAIXA:** Otimizar arquivos entre 70-80%

### Comandos Úteis

\`\`\`bash
# Ver relatório HTML detalhado
npm run test:coverage
open coverage/index.html

# Executar testes específicos
npm test -- src/path/to/file.test.ts

# Executar testes em watch mode
npm test -- --watch
\`\`\`
`}

---

## 📚 Referências

- **Threshold Ideal:** 70-80% (mínimo aceitável)
- **Threshold Excelente:** 80-90%+
- **Pirâmide de Testes:** 70% unit, 20% integration, 10% E2E

---

**Gerado por:** Quality MCP v0.2.0  
**Data:** ${date}  
**Status:** ${statusEmoji} **${analysis.status.toUpperCase()}**
`;

  // [FASE 2] Salva relatório em Markdown usando paths padronizados
  const reportPath = join(paths.reports, 'COVERAGE-ANALYSIS.md');
  await writeFileSafe(reportPath, md);
  
  console.log(`📄 Relatório de cobertura salvo em: ${reportPath}`);

  return reportPath;
}

function getStatusEmoji(status: CoverageResult['analysis']['status']): string {
  switch (status) {
    case 'excellent': return '🎉';
    case 'good': return '✅';
    case 'needs_improvement': return '⚠️';
    case 'critical': return '❌';
  }
}

