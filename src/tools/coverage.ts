import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import { writeFileSafe, fileExists, readFile } from '../utils/fs.js';

export interface CoverageParams {
  repo: string;
  product: string;
  target_coverage?: {
    unit?: number;
    integration?: number;
    e2e?: number;
  };
}

export interface CoverageResult {
  summary: string;
  pyramid: {
    unit: {
      files_found: number;
      coverage_percent?: number;
      test_files: string[];
      missing_tests: string[];
    };
    integration: {
      files_found: number;
      coverage_percent?: number;
      test_files: string[];
      api_endpoints_tested: number;
    };
    e2e: {
      files_found: number;
      scenarios: number;
      test_files: string[];
    };
  };
  health: 'healthy' | 'inverted' | 'needs_attention';
  recommendations: string[];
  analysis_path: string;
}

export async function analyzeTestCoverage(input: CoverageParams): Promise<CoverageResult> {
  console.log(`📊 Analisando cobertura de testes completa para ${input.product}...`);

  const analysesDir = join(input.repo, 'tests', 'analyses');
  await writeFileSafe(join(analysesDir, '.gitkeep'), '');

  // Detecta testes unitários
  const unitTests = await detectUnitTests(input.repo);
  
  // Detecta testes de integração
  const integrationTests = await detectIntegrationTests(input.repo);
  
  // Detecta testes E2E
  const e2eTests = await detectE2ETests(input.repo);

  // Detecta arquivos fonte que precisam de testes
  const sourceFiles = await detectSourceFiles(input.repo);
  const missingTests = findMissingTests(sourceFiles, unitTests.test_files);

  // Calcula saúde da pirâmide
  const totalTests = unitTests.files_found + integrationTests.files_found + e2eTests.files_found;
  const unitPercent = totalTests > 0 ? (unitTests.files_found / totalTests) * 100 : 0;
  const integrationPercent = totalTests > 0 ? (integrationTests.files_found / totalTests) * 100 : 0;
  const e2ePercent = totalTests > 0 ? (e2eTests.files_found / totalTests) * 100 : 0;

  let health: 'healthy' | 'inverted' | 'needs_attention';
  
  // Pirâmide ideal: 70% unit, 20% integration, 10% e2e
  if (unitPercent >= 60 && e2ePercent <= 20) {
    health = 'healthy';
  } else if (e2ePercent > unitPercent) {
    health = 'inverted';
  } else {
    health = 'needs_attention';
  }

  const recommendations = generateRecommendations({
    unitPercent,
    integrationPercent,
    e2ePercent,
    missingTests,
    targets: input.target_coverage
  });

  const summary = `
Pirâmide de Testes - ${input.product}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Unit:        ${unitTests.files_found} testes (${unitPercent.toFixed(1)}%)
Integration: ${integrationTests.files_found} testes (${integrationPercent.toFixed(1)}%)
E2E:         ${e2eTests.files_found} testes (${e2ePercent.toFixed(1)}%)
Total:       ${totalTests} testes

Status: ${health === 'healthy' ? '✅ SAUDÁVEL' : health === 'inverted' ? '❌ INVERTIDA' : '⚠️ PRECISA ATENÇÃO'}

Arquivos sem testes: ${missingTests.length}
`;

  const result: CoverageResult = {
    summary,
    pyramid: {
      unit: {
        files_found: unitTests.files_found,
        coverage_percent: unitTests.coverage,
        test_files: unitTests.test_files,
        missing_tests: missingTests
      },
      integration: {
        files_found: integrationTests.files_found,
        coverage_percent: integrationTests.coverage,
        test_files: integrationTests.test_files,
        api_endpoints_tested: integrationTests.endpoints_tested
      },
      e2e: {
        files_found: e2eTests.files_found,
        scenarios: e2eTests.scenarios,
        test_files: e2eTests.test_files
      }
    },
    health,
    recommendations,
    analysis_path: join('tests', 'analyses', 'coverage-analysis.json')
  };

  // Salva análise
  await writeFileSafe(
    join(input.repo, 'tests', 'analyses', 'coverage-analysis.json'),
    JSON.stringify(result, null, 2)
  );

  // Salva relatório em markdown
  const markdown = generateCoverageMarkdown(result, input.product);
  await writeFileSafe(
    join(input.repo, 'tests', 'analyses', 'COVERAGE-REPORT.md'),
    markdown
  );

  console.log(`✅ Análise de cobertura completa!`);
  console.log(summary);

  return result;
}

async function detectUnitTests(repoPath: string) {
  const testPatterns = [
    '**/*.test.{ts,tsx,js,jsx}',
    '**/*.spec.{ts,tsx,js,jsx}',
    '**/__tests__/**/*.{ts,tsx,js,jsx}'
  ];

  let allTests: string[] = [];
  
  for (const pattern of testPatterns) {
    const tests = await glob(pattern, {
      cwd: repoPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/integration/**']
    });
    allTests.push(...tests);
  }

  allTests = [...new Set(allTests)];

  // Tenta detectar cobertura existente
  let coverage: number | undefined;
  const coveragePath = join(repoPath, 'coverage', 'coverage-summary.json');
  if (await fileExists(coveragePath)) {
    try {
      const coverageData = JSON.parse(await readFile(coveragePath));
      coverage = coverageData.total?.lines?.pct;
    } catch (e) {
      // Ignora erros
    }
  }

  return {
    files_found: allTests.length,
    test_files: allTests,
    coverage
  };
}

async function detectIntegrationTests(repoPath: string) {
  const integrationTests = await glob('**/{integration,api}/**/*.{test,spec}.{ts,tsx,js,jsx}', {
    cwd: repoPath,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  // Detecta endpoints testados
  let endpointsTested = 0;
  for (const testFile of integrationTests) {
    const content = await readFile(join(repoPath, testFile)).catch(() => '');
    // Conta quantas chamadas de API existem
    const apiCalls = (content.match(/\.(get|post|put|patch|delete)\(/gi) || []).length;
    endpointsTested += apiCalls;
  }

  return {
    files_found: integrationTests.length,
    test_files: integrationTests,
    endpoints_tested: endpointsTested,
    coverage: undefined
  };
}

async function detectE2ETests(repoPath: string) {
  const e2eTests = await glob('**/{e2e,playwright,cypress}/**/*.{test,spec}.{ts,tsx,js,jsx}', {
    cwd: repoPath,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  // Conta cenários (testes dentro dos arquivos)
  let scenarios = 0;
  for (const testFile of e2eTests) {
    const content = await readFile(join(repoPath, testFile)).catch(() => '');
    const testCases = (content.match(/test\(/g) || []).length;
    scenarios += testCases;
  }

  return {
    files_found: e2eTests.length,
    test_files: e2eTests,
    scenarios
  };
}

async function detectSourceFiles(repoPath: string) {
  const sourceFiles = await glob('**/{src,lib,app}/**/*.{ts,tsx,js,jsx}', {
    cwd: repoPath,
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/__tests__/**',
      '**/*.d.ts'
    ]
  });

  return sourceFiles;
}

function findMissingTests(sourceFiles: string[], testFiles: string[]): string[] {
  const testedFiles = new Set(
    testFiles.map(test => {
      return test
        .replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, '.$2')
        .replace(/__tests__\//, '');
    })
  );

  return sourceFiles.filter(source => {
    const normalizedSource = source.replace(/^src\//, '');
    return !testedFiles.has(normalizedSource) && !testedFiles.has(source);
  });
}

function generateRecommendations(data: {
  unitPercent: number;
  integrationPercent: number;
  e2ePercent: number;
  missingTests: string[];
  targets?: { unit?: number; integration?: number; e2e?: number };
}): string[] {
  const recs: string[] = [];

  // Recomendações baseadas na proporção
  if (data.e2ePercent > data.unitPercent) {
    recs.push('🚨 PIRÂMIDE INVERTIDA: Você tem mais testes E2E do que unitários. Priorize criar testes unitários.');
  }

  if (data.unitPercent < 60) {
    recs.push(`📈 Aumente a cobertura de testes unitários. Atual: ${data.unitPercent.toFixed(1)}%, Ideal: 70%`);
  }

  if (data.e2ePercent > 20) {
    recs.push(`⚠️ Muitos testes E2E (${data.e2ePercent.toFixed(1)}%). Considere converter alguns em testes de integração.`);
  }

  if (data.missingTests.length > 0) {
    recs.push(`📝 ${data.missingTests.length} arquivos sem testes. Execute 'quality scaffold-unit' para gerar.`);
  }

  if (data.integrationPercent < 15) {
    recs.push('🔗 Considere adicionar mais testes de integração/API para o meio da pirâmide.');
  }

  // Recomendações baseadas em targets
  if (data.targets?.unit && data.unitPercent < data.targets.unit) {
    recs.push(`🎯 Meta de cobertura unit: ${data.targets.unit}% (atual: ${data.unitPercent.toFixed(1)}%)`);
  }

  if (recs.length === 0) {
    recs.push('✅ Pirâmide de testes está saudável! Continue mantendo as boas práticas.');
  }

  return recs;
}

function generateCoverageMarkdown(result: CoverageResult, product: string): string {
  const { pyramid, health, recommendations } = result;
  
  const total = pyramid.unit.files_found + pyramid.integration.files_found + pyramid.e2e.files_found;
  const unitPct = total > 0 ? ((pyramid.unit.files_found / total) * 100).toFixed(1) : '0';
  const intPct = total > 0 ? ((pyramid.integration.files_found / total) * 100).toFixed(1) : '0';
  const e2ePct = total > 0 ? ((pyramid.e2e.files_found / total) * 100).toFixed(1) : '0';

  return `# Análise da Pirâmide de Testes - ${product}

**Data:** ${new Date().toISOString().split('T')[0]}

## 📊 Visão Geral

| Camada | Testes | Proporção | Status |
|--------|--------|-----------|--------|
| **Unit** | ${pyramid.unit.files_found} | ${unitPct}% | ${pyramid.unit.files_found >= 10 ? '✅' : '⚠️'} |
| **Integration** | ${pyramid.integration.files_found} | ${intPct}% | ${pyramid.integration.files_found >= 3 ? '✅' : '⚠️'} |
| **E2E** | ${pyramid.e2e.files_found} | ${e2ePct}% | ${pyramid.e2e.files_found >= 1 ? '✅' : '⚠️'} |
| **TOTAL** | **${total}** | **100%** | **${health === 'healthy' ? '✅' : '⚠️'}** |

## 🏥 Saúde da Pirâmide

**Status:** ${
  health === 'healthy' ? '✅ SAUDÁVEL' :
  health === 'inverted' ? '❌ INVERTIDA (precisa correção urgente)' :
  '⚠️ PRECISA ATENÇÃO'
}

### Pirâmide Ideal vs Atual

\`\`\`
IDEAL                  ATUAL
  ▲                      ${parseFloat(e2ePct) >= 30 ? '▼' : '▲'}
 / \\                    ${parseFloat(e2ePct) >= 30 ? '/ \\' : '/ \\'}
/E2E\\  10%            /E2E\\  ${e2ePct}%
────────              ────────
 /INT\\  20%           /INT\\  ${intPct}%
────────              ────────
/UNIT\\  70%          /UNIT\\  ${unitPct}%
────────              ────────
\`\`\`

## 📈 Detalhamento por Camada

### Base: Testes Unitários

- **Total:** ${pyramid.unit.files_found} arquivos
- **Cobertura:** ${pyramid.unit.coverage_percent ? pyramid.unit.coverage_percent.toFixed(1) + '%' : 'N/A'}
- **Arquivos sem testes:** ${pyramid.unit.missing_tests.length}

${pyramid.unit.missing_tests.length > 0 ? `
**Top 5 arquivos prioritários para testar:**
${pyramid.unit.missing_tests.slice(0, 5).map(f => `- \`${f}\``).join('\n')}

Execute: \`quality scaffold-unit --files "${pyramid.unit.missing_tests.slice(0, 5).join(',').replace(/,/g, ' ')}"\`
` : ''}

### Meio: Testes de Integração

- **Total:** ${pyramid.integration.files_found} arquivos
- **Endpoints testados:** ${pyramid.integration.api_endpoints_tested}
- **Cobertura de API:** ${pyramid.integration.api_endpoints_tested > 0 ? '✅' : '⚠️ Nenhum endpoint testado'}

${pyramid.integration.files_found === 0 ? `
**Ação recomendada:**
\`\`\`bash
quality scaffold-integration --repo . --product "${product}"
\`\`\`
` : ''}

### Topo: Testes E2E

- **Total:** ${pyramid.e2e.files_found} arquivos
- **Cenários:** ${pyramid.e2e.scenarios}
- **Média por arquivo:** ${pyramid.e2e.files_found > 0 ? (pyramid.e2e.scenarios / pyramid.e2e.files_found).toFixed(1) : '0'}

## 💡 Recomendações

${recommendations.map(r => `- ${r}`).join('\n')}

## 🎯 Plano de Ação

### Curto Prazo (1 semana)

1. [ ] Criar testes unitários para os 5 arquivos prioritários
2. [ ] ${pyramid.integration.files_found === 0 ? 'Adicionar pelo menos 3 testes de integração' : 'Aumentar cobertura de integração em 20%'}
3. [ ] ${pyramid.e2e.files_found === 0 ? 'Criar cenários E2E principais' : 'Revisar testes E2E existentes'}

### Médio Prazo (1 mês)

1. [ ] Atingir 70% de testes unitários
2. [ ] Atingir 20% de testes de integração
3. [ ] Manter 10% de testes E2E
4. [ ] Configurar CI para validar proporções

### Longo Prazo (3 meses)

1. [ ] Cobertura unitária > 80%
2. [ ] Contract testing entre serviços
3. [ ] Automação completa do pipeline
4. [ ] Dashboard de métricas em tempo real

## 📚 Recursos

- [Guia de Testes Unitários](../docs/unit-testing-guide.md)
- [Guia de Testes de Integração](../docs/integration-testing-guide.md)
- [Guia de Testes E2E](../docs/e2e-testing-guide.md)
- [Pirâmide de Testes - Martin Fowler](https://martinfowler.com/articles/practical-test-pyramid.html)

---

**Gerado por:** Quality MCP v0.2.0  
**Timestamp:** ${new Date().toISOString()}
`;
}
