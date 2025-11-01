import { readFile, writeFileSafe, join, fileExists } from '../utils/fs.js';
import { loadMCPSettings, mergeSettings } from '../utils/config.js';

export interface BuildReportParams {
  repo?: string;
  product?: string;
  in_dir: string;
  out_file: string;
  thresholds?: {
    flaky_pct_max?: number;
    diff_coverage_min?: number;
  };
}

export interface ReportStats {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  durationMs: number;
  durationSec: number;
}

export async function buildReport(input: BuildReportParams): Promise<{ ok: boolean; out: string; stats?: ReportStats }> {
  // Carrega e mescla configurações se repo e product fornecidos
  let settings = input;
  if (input.repo && input.product) {
    const fileSettings = await loadMCPSettings(input.repo, input.product);
    settings = mergeSettings(fileSettings, input);
  }

  console.log(`📊 Gerando relatório consolidado...`);

  const resultJsonPath = join(input.in_dir, 'json', 'results.json');
  let stats: ReportStats = {
    total: 0,
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    durationMs: 0,
    durationSec: 0
  };

  let detailedResults: any = null;

  // Tenta ler JSON do Playwright
  if (await fileExists(resultJsonPath)) {
    try {
      const raw = await readFile(resultJsonPath, 'utf8');
      detailedResults = JSON.parse(raw);
      
      // Extrai estatísticas do formato Playwright
      if (detailedResults.stats) {
        stats.total = detailedResults.stats.expected || 0;
        stats.passed = detailedResults.stats.passed || 0;
        stats.failed = detailedResults.stats.failed || 0;
        stats.flaky = detailedResults.stats.flaky || 0;
        stats.skipped = detailedResults.stats.skipped || 0;
        stats.durationMs = detailedResults.stats.duration || 0;
        stats.durationSec = Math.round(stats.durationMs / 1000);
      }
    } catch (error) {
      console.warn('⚠️  Não foi possível ler o JSON de resultados:', error);
    }
  }

  // Calcula métricas
  const flakyPct = stats.total > 0 ? ((stats.flaky / stats.total) * 100).toFixed(2) : '0.00';
  const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(2) : '0.00';
  
  // Acessa targets se disponível via any cast
  const settingsAny = settings as any;
  const thresholds = {
    flaky_pct_max: settings.thresholds?.flaky_pct_max ?? settingsAny.targets?.flaky_pct_max ?? 3,
    diff_coverage_min: settings.thresholds?.diff_coverage_min ?? settingsAny.targets?.diff_coverage_min ?? 60
  };

  const flakyExceeded = parseFloat(flakyPct) > thresholds.flaky_pct_max;
  const flakyStatus = flakyExceeded ? '❌' : '✅';

  // Extrai testes falhados
  let failedTests: string[] = [];
  if (detailedResults?.suites) {
    failedTests = extractFailedTests(detailedResults.suites);
  }

  // Gera relatório Markdown
  const md = `# QA Report — Playwright E2E

**Data:** ${new Date().toISOString().split('T')[0]}

## 📊 Resumo Executivo

| Métrica | Valor |
|---------|-------|
| **Total de Testes** | ${stats.total} |
| **Passou** | ${stats.passed} (${passRate}%) |
| **Falhou** | ${stats.failed} |
| **Flaky** | ${stats.flaky} (${flakyPct}%) ${flakyStatus} |
| **Pulado** | ${stats.skipped} |
| **Duração** | ${stats.durationSec}s (~${Math.round(stats.durationSec / 60)}min) |

## 🎯 Gates de Qualidade

| Gate | Alvo | Atual | Status |
|------|------|-------|--------|
| **Flaky Rate** | ≤ ${thresholds.flaky_pct_max}% | ${flakyPct}% | ${flakyStatus} |
| **Diff Coverage** | ≥ ${thresholds.diff_coverage_min}% | N/A* | ⏳ |

_*Cobertura de diferença requer configuração adicional_

## 📁 Artefatos

- **HTML Report:** [\`${input.in_dir}/html/index.html\`](${input.in_dir}/html/index.html)
- **JUnit XML:** [\`${input.in_dir}/junit/results.xml\`](${input.in_dir}/junit/results.xml)
- **JSON Results:** [\`${input.in_dir}/json/results.json\`](${input.in_dir}/json/results.json)
- **Coverage:** [\`${input.in_dir}/coverage/\`](${input.in_dir}/coverage/)

${failedTests.length > 0 ? `
## ❌ Testes Falhados

${failedTests.map(t => `- \`${t}\``).join('\n')}

**Ação Necessária:** Investigar e corrigir testes falhados antes do release.
` : ''}

${stats.flaky > 0 ? `
## ⚠️  Testes Flaky Detectados

Foram detectados **${stats.flaky} testes flaky** (${flakyPct}%).

**Política de Flaky:**
1. Colocar em quarentena (skip temporário)
2. Criar issue para investigação
3. SLA de 7 dias para correção
4. Se não corrigido em 14 dias, remover o teste

**Causas Comuns:**
- Condições de corrida (race conditions)
- Timeouts inadequados
- Dependências externas instáveis
- Estado compartilhado entre testes
` : ''}

## 🎬 Próximas Ações

### Antes do Release
- ${stats.failed > 0 ? '❌' : '✅'} Corrigir todos os testes falhados
- ${flakyExceeded ? '❌' : '✅'} Resolver testes flaky (meta: ≤ ${thresholds.flaky_pct_max}%)
- ⏳ Validar cenários P1 (críticos)
- ⏳ Aprovar com QA Lead

### Pós-Release
- 📈 Monitorar métricas em produção
- 📝 Documentar lições aprendidas
- 🔄 Revisar e refatorar testes conforme necessário

## 📋 Checklist de QA

- [ ] Todos os cenários P1 passaram
- [ ] Taxa de flaky dentro do limite
- [ ] Nenhum teste crítico falhando
- [ ] Relatórios revisados pela equipe
- [ ] Aprovação do QA Lead
- [ ] Documentação atualizada

---

## 📚 Recursos

### Comandos Úteis
\`\`\`bash
# Re-executar testes
npm test

# Ver relatório HTML
npm run report

# Debug de teste específico
npm run test:debug -- tests/path/to/test.spec.ts
\`\`\`

### Métricas e Benchmarks

**Benchmarks de Performance:**
- CI p95: ≤ 15 minutos
- Teste individual: ≤ 35 segundos
- Setup/Teardown: ≤ 5 segundos

**Métricas de Qualidade:**
- Coverage: ≥ 60% (diff-coverage)
- Flaky rate: ≤ 3%
- Pass rate: ≥ 95%

---

**Gerado por:** Quality MCP v0.1.0  
**Timestamp:** ${new Date().toISOString()}
`;

  await writeFileSafe(input.out_file, md);
  
  console.log(`✅ Relatório gerado: ${input.out_file}`);
  
  return { ok: true, out: input.out_file, stats };
}

function extractFailedTests(suites: any[], prefix: string = ''): string[] {
  const failed: string[] = [];

  for (const suite of suites) {
    const suiteName = prefix ? `${prefix} > ${suite.title}` : suite.title;

    if (suite.specs) {
      for (const spec of suite.specs) {
        if (spec.tests) {
          for (const test of spec.tests) {
            if (test.status === 'unexpected' || test.status === 'failed') {
              failed.push(`${suiteName} > ${spec.title}`);
            }
          }
        }
      }
    }

    if (suite.suites) {
      failed.push(...extractFailedTests(suite.suites, suiteName));
    }
  }

  return failed;
}

