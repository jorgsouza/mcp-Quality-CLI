import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import { spawn } from 'node:child_process';
import { writeFileSafe, fileExists, readFile } from '../utils/fs.js';
import { loadMCPSettings, mergeSettings } from '../utils/config.js';

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
      test_cases: number;
      coverage_percent?: number;
      test_files: string[];
      missing_tests: string[];
    };
    integration: {
      files_found: number;
      test_cases: number;
      coverage_percent?: number;
      test_files: string[];
      api_endpoints_tested: number;
    };
    e2e: {
      files_found: number;
      test_cases: number;
      scenarios: number;
      test_files: string[];
    };
  };
  health: 'healthy' | 'inverted' | 'needs_attention';
  recommendations: string[];
  analysis_path: string;
}

export async function analyzeTestCoverage(input: CoverageParams): Promise<CoverageResult> {
  // Carregar configuração centralizada
  const fileSettings = await loadMCPSettings(input.repo, input.product);
  const settings = mergeSettings(fileSettings, input);
  
  console.log(`📊 Analisando cobertura de testes completa para ${settings.product}...`);
  
  if (fileSettings) {
    console.log(`✅ Using settings from mcp-settings.json`);
  }

  const analysesDir = join(settings.repo, 'tests', 'analyses');
  await writeFileSafe(join(analysesDir, '.gitkeep'), '');

  // Tenta obter contagem precisa do test runner
  const actualTestCount = await getActualTestCount(settings.repo);

  // Detecta testes unitários
  const unitTests = await detectUnitTests(settings.repo);
  
  // Detecta testes de integração
  const integrationTests = await detectIntegrationTests(settings.repo);
  
  // Detecta testes E2E
  const e2eTests = await detectE2ETests(settings.repo);

  // Usa a contagem real se disponível, senão usa a soma manual
  let totalTestCases = actualTestCount || (unitTests.test_cases + integrationTests.test_cases + e2eTests.test_cases);
  
  // Se temos a contagem real, ajusta as proporções mantendo a distribuição
  if (actualTestCount && actualTestCount !== (unitTests.test_cases + integrationTests.test_cases + e2eTests.test_cases)) {
    const ratio = actualTestCount / (unitTests.test_cases + integrationTests.test_cases + e2eTests.test_cases);
    unitTests.test_cases = Math.round(unitTests.test_cases * ratio);
    integrationTests.test_cases = Math.round(integrationTests.test_cases * ratio);
    e2eTests.test_cases = Math.round(e2eTests.test_cases * ratio);
    totalTestCases = unitTests.test_cases + integrationTests.test_cases + e2eTests.test_cases;
  }

  // Detecta arquivos fonte que precisam de testes
  const sourceFiles = await detectSourceFiles(settings.repo);
  const missingTests = findMissingTests(sourceFiles, unitTests.test_files);

  // Calcula saúde da pirâmide usando test cases
  const totalFiles = unitTests.files_found + integrationTests.files_found + e2eTests.files_found;
  const unitPercent = totalTestCases > 0 ? (unitTests.test_cases / totalTestCases) * 100 : 0;
  const integrationPercent = totalTestCases > 0 ? (integrationTests.test_cases / totalTestCases) * 100 : 0;
  const e2ePercent = totalTestCases > 0 ? (e2eTests.test_cases / totalTestCases) * 100 : 0;

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
    targets: settings.target_coverage
  });

  const summary = `
Pirâmide de Testes - ${settings.product}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Unit:        ${unitTests.test_cases} testes (${unitPercent.toFixed(1)}%) [${unitTests.files_found} arquivos]
Integration: ${integrationTests.test_cases} testes (${integrationPercent.toFixed(1)}%) [${integrationTests.files_found} arquivos]
E2E:         ${e2eTests.test_cases} testes (${e2ePercent.toFixed(1)}%) [${e2eTests.files_found} arquivos]
Total:       ${totalTestCases} test cases em ${totalFiles} arquivos

Status: ${health === 'healthy' ? '✅ SAUDÁVEL' : health === 'inverted' ? '❌ INVERTIDA' : '⚠️ PRECISA ATENÇÃO'}

Arquivos sem testes: ${missingTests.length}
`;

  const result: CoverageResult = {
    summary,
    pyramid: {
      unit: {
        files_found: unitTests.files_found,
        test_cases: unitTests.test_cases,
        coverage_percent: unitTests.coverage,
        test_files: unitTests.test_files,
        missing_tests: missingTests
      },
      integration: {
        files_found: integrationTests.files_found,
        test_cases: integrationTests.test_cases,
        coverage_percent: integrationTests.coverage,
        test_files: integrationTests.test_files,
        api_endpoints_tested: integrationTests.endpoints_tested
      },
      e2e: {
        files_found: e2eTests.files_found,
        test_cases: e2eTests.test_cases,
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
    join(settings.repo, 'tests', 'analyses', 'coverage-analysis.json'),
    JSON.stringify(result, null, 2)
  );

  // Salva relatório em markdown
  const markdown = generateCoverageMarkdown(result, settings.product);
  await writeFileSafe(
    join(settings.repo, 'tests', 'analyses', 'COVERAGE-REPORT.md'),
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

  // Conta test cases individuais nos arquivos
  let totalTestCases = 0;
  for (const testFile of allTests) {
    const content = await readFile(join(repoPath, testFile)).catch(() => '');
    // Remove comentários e strings para evitar falsos positivos
    const cleanContent = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
      .replace(/\/\/.*/g, '') // Remove // comments
      .replace(/'[^']*'/g, "''") // Remove single-quoted strings
      .replace(/"[^"]*"/g, '""') // Remove double-quoted strings
      .replace(/`[^`]*`/g, '``'); // Remove template literals
    
    // Conta apenas it( e test( no início de linhas (com espaços)
    const lines = cleanContent.split('\n');
    for (const line of lines) {
      if (line.match(/^\s*(it|test)\s*\(/)) {
        totalTestCases++;
      }
    }
  }

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
    test_cases: totalTestCases,
    test_files: allTests,
    coverage
  };
}

async function detectIntegrationTests(repoPath: string) {
  const integrationTests = await glob('**/{integration,api}/**/*.{test,spec}.{ts,tsx,js,jsx}', {
    cwd: repoPath,
    ignore: ['**/node_modules/**', '**/dist/**']
  });

  // Conta test cases individuais e endpoints testados
  let totalTestCases = 0;
  let endpointsTested = 0;
  for (const testFile of integrationTests) {
    const content = await readFile(join(repoPath, testFile)).catch(() => '');
    // Remove comentários e strings
    const cleanContent = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .replace(/'[^']*'/g, "''")
      .replace(/"[^"]*"/g, '""')
      .replace(/`[^`]*`/g, '``');
    
    const lines = cleanContent.split('\n');
    for (const line of lines) {
      if (line.match(/^\s*(it|test)\s*\(/)) {
        totalTestCases++;
      }
    }
    // Conta quantas chamadas de API existem
    const apiCalls = (content.match(/\.(get|post|put|patch|delete)\(/gi) || []).length;
    endpointsTested += apiCalls;
  }

  return {
    files_found: integrationTests.length,
    test_cases: totalTestCases,
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

  // Conta cenários (test cases individuais)
  let totalTestCases = 0;
  for (const testFile of e2eTests) {
    const content = await readFile(join(repoPath, testFile)).catch(() => '');
    const cleanContent = content
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*/g, '')
      .replace(/'[^']*'/g, "''")
      .replace(/"[^"]*"/g, '""')
      .replace(/`[^`]*`/g, '``');
    
    const lines = cleanContent.split('\n');
    for (const line of lines) {
      if (line.match(/^\s*(it|test)\s*\(/)) {
        totalTestCases++;
      }
    }
  }

  return {
    files_found: e2eTests.length,
    test_cases: totalTestCases,
    test_files: e2eTests,
    scenarios: totalTestCases
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

async function getActualTestCount(repoPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    // Tenta usar npx vitest para obter contagem real
    const vitestProcess = spawn('npx', ['vitest', 'run'], {
      cwd: repoPath,
      stdio: 'pipe'
    });

    let output = '';
    
    vitestProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    vitestProcess.stderr?.on('data', (data) => {
      output += data.toString();
    });

    vitestProcess.on('close', () => {
      // Procura por padrão "Tests  XXX passed"
      const match = output.match(/Tests\s+(\d+)\s+passed/);
      if (match) {
        resolve(parseInt(match[1], 10));
      } else {
        resolve(null);
      }
    });

    vitestProcess.on('error', () => {
      resolve(null);
    });

    // Timeout de 30 segundos
    setTimeout(() => {
      vitestProcess.kill();
      resolve(null);
    }, 30000);
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
  
  const totalTestCases = pyramid.unit.test_cases + pyramid.integration.test_cases + pyramid.e2e.test_cases;
  const totalFiles = pyramid.unit.files_found + pyramid.integration.files_found + pyramid.e2e.files_found;
  const unitPct = totalTestCases > 0 ? ((pyramid.unit.test_cases / totalTestCases) * 100).toFixed(1) : '0';
  const intPct = totalTestCases > 0 ? ((pyramid.integration.test_cases / totalTestCases) * 100).toFixed(1) : '0';
  const e2ePct = totalTestCases > 0 ? ((pyramid.e2e.test_cases / totalTestCases) * 100).toFixed(1) : '0';

  return `# Análise da Pirâmide de Testes - ${product}

**Data:** ${new Date().toISOString().split('T')[0]}

## 📊 Visão Geral

| Camada | Test Cases | Arquivos | Proporção | Status |
|--------|-----------|----------|-----------|--------|
| **Unit** | ${pyramid.unit.test_cases} | ${pyramid.unit.files_found} | ${unitPct}% | ${pyramid.unit.test_cases >= 10 ? '✅' : '⚠️'} |
| **Integration** | ${pyramid.integration.test_cases} | ${pyramid.integration.files_found} | ${intPct}% | ${pyramid.integration.test_cases >= 3 ? '✅' : '⚠️'} |
| **E2E** | ${pyramid.e2e.test_cases} | ${pyramid.e2e.files_found} | ${e2ePct}% | ${pyramid.e2e.test_cases >= 1 ? '✅' : '⚠️'} |
| **TOTAL** | **${totalTestCases}** | **${totalFiles}** | **100%** | **${health === 'healthy' ? '✅' : '⚠️'}** |

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

- **Test Cases:** ${pyramid.unit.test_cases}
- **Arquivos:** ${pyramid.unit.files_found}
- **Cobertura:** ${pyramid.unit.coverage_percent ? pyramid.unit.coverage_percent.toFixed(1) + '%' : 'N/A'}
- **Arquivos sem testes:** ${pyramid.unit.missing_tests.length}

${pyramid.unit.missing_tests.length > 0 ? `
**Top 5 arquivos prioritários para testar:**
${pyramid.unit.missing_tests.slice(0, 5).map(f => `- \`${f}\``).join('\n')}

Execute: \`quality scaffold-unit --files "${pyramid.unit.missing_tests.slice(0, 5).join(',').replace(/,/g, ' ')}"\`
` : ''}

### Meio: Testes de Integração

- **Test Cases:** ${pyramid.integration.test_cases}
- **Arquivos:** ${pyramid.integration.files_found}
- **Endpoints testados:** ${pyramid.integration.api_endpoints_tested}
- **Cobertura de API:** ${pyramid.integration.api_endpoints_tested > 0 ? '✅' : '⚠️ Nenhum endpoint testado'}

${pyramid.integration.files_found === 0 ? `
**Ação recomendada:**
\`\`\`bash
quality scaffold-integration --repo . --product "${product}"
\`\`\`
` : ''}

### Topo: Testes E2E

- **Test Cases:** ${pyramid.e2e.test_cases}
- **Arquivos:** ${pyramid.e2e.files_found}
- **Cenários:** ${pyramid.e2e.scenarios}
- **Média por arquivo:** ${pyramid.e2e.files_found > 0 ? (pyramid.e2e.test_cases / pyramid.e2e.files_found).toFixed(1) : '0'}

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
