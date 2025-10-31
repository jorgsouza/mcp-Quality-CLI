import { join } from 'node:path';
import { writeFileSafe, readFile, fileExists } from '../utils/fs.js';

export interface PyramidReportParams {
  repo: string;
  product: string;
  output_format?: 'markdown' | 'html' | 'json';
}

export async function generatePyramidReport(input: PyramidReportParams): Promise<{
  ok: boolean;
  report_path: string;
}> {
  console.log(`📊 Gerando visualização da pirâmide de testes...`);

  // Lê dados da análise de cobertura
  const coverageAnalysisPath = join(input.repo, 'tests', 'analyses', 'coverage-analysis.json');
  
  if (!await fileExists(coverageAnalysisPath)) {
    throw new Error('Análise de cobertura não encontrada. Execute "quality coverage" primeiro.');
  }

  const coverageData = JSON.parse(await readFile(coverageAnalysisPath));

  const format = input.output_format || 'markdown';
  let reportContent: string;
  let extension: string;

  switch (format) {
    case 'html':
      reportContent = generateHTMLReport(coverageData, input.product);
      extension = 'html';
      break;
    case 'json':
      reportContent = JSON.stringify(coverageData, null, 2);
      extension = 'json';
      break;
    default:
      reportContent = generateMarkdownReport(coverageData, input.product);
      extension = 'md';
  }

  const reportPath = join(input.repo, 'tests', 'analyses', `PYRAMID-REPORT.${extension}`);
  await writeFileSafe(reportPath, reportContent);

  console.log(`✅ Relatório da pirâmide gerado: ${reportPath}`);

  return {
    ok: true,
    report_path: reportPath
  };
}

function generateMarkdownReport(data: any, product: string): string {
  const { pyramid, health, recommendations } = data;
  
  const total = pyramid.unit.files_found + pyramid.integration.files_found + pyramid.e2e.files_found;
  const unitPct = total > 0 ? ((pyramid.unit.files_found / total) * 100).toFixed(1) : '0';
  const intPct = total > 0 ? ((pyramid.integration.files_found / total) * 100).toFixed(1) : '0';
  const e2ePct = total > 0 ? ((pyramid.e2e.files_found / total) * 100).toFixed(1) : '0';

  const healthEmoji = health === 'healthy' ? '✅' : health === 'inverted' ? '❌' : '⚠️';
  const healthText = health === 'healthy' ? 'SAUDÁVEL' : health === 'inverted' ? 'INVERTIDA' : 'PRECISA ATENÇÃO';

  return `# 🏛️ Pirâmide de Testes - ${product}

**Data:** ${new Date().toISOString().split('T')[0]}  
**Status:** ${healthEmoji} **${healthText}**

---

## 📊 Visão Geral

\`\`\`
                    IDEAL                          ATUAL
                      ▲                              ${parseFloat(e2ePct) >= 30 ? '▼' : '▲'}
                     ╱ ╲                            ╱ ╲
                    ╱ E2E╲         10%             ╱ E2E╲         ${e2ePct}%
                   ╱───────╲                      ╱───────╲
                  ╱   INT   ╲      20%           ╱   INT   ╲      ${intPct}%
                 ╱───────────╲                  ╱───────────╲
                ╱    UNIT     ╲    70%         ╱    UNIT     ╲    ${unitPct}%
               ╱───────────────╲              ╱───────────────╲
              ═══════════════════            ═══════════════════
\`\`\`

## 📈 Métricas

| Camada | Testes | Proporção | Ideal | Diff | Status |
|--------|--------|-----------|-------|------|--------|
| **E2E** | ${pyramid.e2e.files_found} | ${e2ePct}% | 10% | ${(parseFloat(e2ePct) - 10).toFixed(1)}% | ${parseFloat(e2ePct) <= 15 ? '✅' : '⚠️'} |
| **Integration** | ${pyramid.integration.files_found} | ${intPct}% | 20% | ${(parseFloat(intPct) - 20).toFixed(1)}% | ${parseFloat(intPct) >= 15 && parseFloat(intPct) <= 25 ? '✅' : '⚠️'} |
| **Unit** | ${pyramid.unit.files_found} | ${unitPct}% | 70% | ${(parseFloat(unitPct) - 70).toFixed(1)}% | ${parseFloat(unitPct) >= 60 ? '✅' : '⚠️'} |
| **TOTAL** | **${total}** | **100%** | - | - | **${healthEmoji}** |

## 🎯 Detalhamento

### 🧪 Base: Testes Unitários (${pyramid.unit.files_found})

${pyramid.unit.coverage_percent ? `- **Cobertura:** ${pyramid.unit.coverage_percent.toFixed(1)}%` : '- **Cobertura:** N/A'}
- **Arquivos testados:** ${pyramid.unit.test_files.length}
- **Arquivos sem testes:** ${pyramid.unit.missing_tests.length}

${pyramid.unit.files_found < 10 ? `
⚠️ **Atenção:** Poucos testes unitários! Isso indica base fraca da pirâmide.

**Ação recomendada:**
\`\`\`bash
quality scaffold-unit --repo . --product "${product}"
\`\`\`
` : ''}

### 🔗 Meio: Testes de Integração (${pyramid.integration.files_found})

- **Arquivos de teste:** ${pyramid.integration.test_files.length}
- **Endpoints testados:** ${pyramid.integration.api_endpoints_tested}

${pyramid.integration.files_found === 0 ? `
⚠️ **Atenção:** Nenhum teste de integração encontrado!

**Ação recomendada:**
\`\`\`bash
quality scaffold-integration --repo . --product "${product}"
\`\`\`
` : ''}

### 🎭 Topo: Testes E2E (${pyramid.e2e.files_found})

- **Arquivos de teste:** ${pyramid.e2e.test_files.length}
- **Cenários:** ${pyramid.e2e.scenarios}
- **Média por arquivo:** ${pyramid.e2e.files_found > 0 ? (pyramid.e2e.scenarios / pyramid.e2e.files_found).toFixed(1) : '0'}

${parseFloat(e2ePct) > 30 ? `
⚠️ **Atenção:** Muitos testes E2E! Pirâmide invertida detectada.

**Recomendação:** Converter alguns E2E em testes de integração ou unitários.
` : ''}

## 💡 Recomendações

${recommendations.map((r: string) => `- ${r}`).join('\n')}

## 🎯 Plano de Ação

### Prioridade ALTA (Esta Semana)

${parseFloat(unitPct) < 50 ? `- [ ] 🚨 Criar testes unitários (atual: ${unitPct}%, meta: 70%)` : ''}
${parseFloat(e2ePct) > 30 ? `- [ ] 🚨 Refatorar testes E2E (atual: ${e2ePct}%, meta: 10%)` : ''}
${pyramid.unit.missing_tests.length > 10 ? `- [ ] ⚠️ Cobrir ${pyramid.unit.missing_tests.slice(0, 5).length} arquivos críticos` : ''}

### Prioridade MÉDIA (Este Mês)

- [ ] Aumentar testes de integração para 20%
- [ ] Configurar CI para validar proporções da pirâmide
- [ ] Documentar padrões de teste no time

### Prioridade BAIXA (Próximos 3 Meses)

- [ ] Atingir 80% de cobertura unitária
- [ ] Implementar contract testing
- [ ] Dashboard de métricas em tempo real

## 📚 Recursos

- 📖 [Guia de Testes Unitários](./UNIT-TESTING-GUIDE.md)
- 📖 [Guia de Testes de Integração](./INTEGRATION-TESTING-GUIDE.md)
- 📖 [The Practical Test Pyramid - Martin Fowler](https://martinfowler.com/articles/practical-test-pyramid.html)

## 📊 Histórico

Execute este relatório regularmente para acompanhar a evolução:

\`\`\`bash
# Gerar relatório atualizado
quality pyramid --repo . --product "${product}"

# Comparar com versão anterior
git diff tests/analyses/PYRAMID-REPORT.md
\`\`\`

---

**Gerado por:** Quality MCP v0.2.0  
**Timestamp:** ${new Date().toISOString()}
`;
}

function generateHTMLReport(data: any, product: string): string {
  const { pyramid, health, recommendations } = data;
  
  const total = pyramid.unit.files_found + pyramid.integration.files_found + pyramid.e2e.files_found;
  const unitPct = total > 0 ? ((pyramid.unit.files_found / total) * 100).toFixed(1) : '0';
  const intPct = total > 0 ? ((pyramid.integration.files_found / total) * 100).toFixed(1) : '0';
  const e2ePct = total > 0 ? ((pyramid.e2e.files_found / total) * 100).toFixed(1) : '0';

  const healthColor = health === 'healthy' ? '#22c55e' : health === 'inverted' ? '#ef4444' : '#f59e0b';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pirâmide de Testes - ${product}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      text-align: center;
    }
    .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .header .status {
      display: inline-block;
      padding: 0.5rem 1.5rem;
      background: ${healthColor};
      border-radius: 50px;
      font-weight: 600;
      margin-top: 1rem;
    }
    .content { padding: 2rem; }
    .pyramid-container {
      display: flex;
      justify-content: center;
      align-items: flex-end;
      gap: 4rem;
      margin: 2rem 0;
      padding: 2rem;
      background: #f8f9fa;
      border-radius: 12px;
    }
    .pyramid {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }
    .pyramid-label {
      text-align: center;
      font-weight: 600;
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }
    .pyramid-layer {
      display: flex;
      justify-content: center;
      align-items: center;
      color: white;
      font-weight: 600;
      position: relative;
      clip-path: polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%);
    }
    .pyramid-layer.e2e { background: #3b82f6; width: 150px; height: 60px; }
    .pyramid-layer.integration { background: #8b5cf6; width: 200px; height: 80px; }
    .pyramid-layer.unit { background: #22c55e; width: 250px; height: 100px; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }
    .metric-card {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 12px;
      border-left: 4px solid;
    }
    .metric-card.e2e { border-color: #3b82f6; }
    .metric-card.integration { border-color: #8b5cf6; }
    .metric-card.unit { border-color: #22c55e; }
    .metric-card h3 { font-size: 0.9rem; color: #6b7280; margin-bottom: 0.5rem; }
    .metric-card .value { font-size: 2.5rem; font-weight: 700; color: #111827; }
    .metric-card .percentage { font-size: 1.2rem; color: #6b7280; }
    .recommendations {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 1.5rem;
      border-radius: 12px;
      margin: 2rem 0;
    }
    .recommendations h2 { color: #92400e; margin-bottom: 1rem; }
    .recommendations ul { list-style: none; }
    .recommendations li { padding: 0.5rem 0; color: #78350f; }
    .recommendations li:before { content: "💡 "; margin-right: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏛️ Pirâmide de Testes</h1>
      <h2>${product}</h2>
      <div class="status">${health === 'healthy' ? '✅ SAUDÁVEL' : health === 'inverted' ? '❌ INVERTIDA' : '⚠️ PRECISA ATENÇÃO'}</div>
      <p style="margin-top: 1rem; opacity: 0.9;">${new Date().toLocaleDateString('pt-BR')}</p>
    </div>

    <div class="content">
      <div class="pyramid-container">
        <div class="pyramid">
          <div class="pyramid-label">IDEAL</div>
          <div class="pyramid-layer e2e">E2E 10%</div>
          <div class="pyramid-layer integration">INT 20%</div>
          <div class="pyramid-layer unit">UNIT 70%</div>
        </div>
        <div class="pyramid">
          <div class="pyramid-label">ATUAL</div>
          <div class="pyramid-layer e2e">E2E ${e2ePct}%</div>
          <div class="pyramid-layer integration">INT ${intPct}%</div>
          <div class="pyramid-layer unit">UNIT ${unitPct}%</div>
        </div>
      </div>

      <div class="metrics">
        <div class="metric-card unit">
          <h3>TESTES UNITÁRIOS</h3>
          <div class="value">${pyramid.unit.files_found}</div>
          <div class="percentage">${unitPct}% do total</div>
        </div>
        <div class="metric-card integration">
          <h3>TESTES DE INTEGRAÇÃO</h3>
          <div class="value">${pyramid.integration.files_found}</div>
          <div class="percentage">${intPct}% do total</div>
        </div>
        <div class="metric-card e2e">
          <h3>TESTES E2E</h3>
          <div class="value">${pyramid.e2e.files_found}</div>
          <div class="percentage">${e2ePct}% do total</div>
        </div>
      </div>

      <div class="recommendations">
        <h2>💡 Recomendações</h2>
        <ul>
          ${recommendations.map((r: string) => `<li>${r}</li>`).join('\n          ')}
        </ul>
      </div>
    </div>
  </div>

  <script>
    console.log('Quality MCP - Pyramid Report v0.2.0');
    console.log('Health:', '${health}');
    console.log('Distribution:', {
      unit: ${unitPct},
      integration: ${intPct},
      e2e: ${e2ePct}
    });
  </script>
</body>
</html>`;
}

