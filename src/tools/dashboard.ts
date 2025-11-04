import { join, writeFileSafe, readFile, fileExists } from '../utils/fs.js';
import { loadMCPSettings, mergeSettings } from '../utils/config.js';
import { getPaths, ensurePaths } from '../utils/paths.js';
import { spawn } from 'node:child_process';

export interface DashboardParams {
  repo: string;
  product?: string;
  port?: number;
  open_browser?: boolean;
}

/**
 * Gera dashboard HTML interativo da pirâmide de testes
 */
export async function generateDashboard(input: DashboardParams): Promise<{
  ok: boolean;
  dashboard_path: string;
  url?: string;
}> {
  // Carrega e mescla configurações
  const fileSettings = await loadMCPSettings(input.repo, input.product);
  const settings = mergeSettings(fileSettings, input);

  // [FASE 2] Calcular paths padronizados e garantir que existem
  const paths = getPaths(input.repo, settings.product || 'default', fileSettings || undefined);
  await ensurePaths(paths);

  console.log(`📊 Gerando dashboard da pirâmide de testes...`);

  // Carrega dados de análises usando paths padronizados
  const data = await loadAnalysisData(paths);

  // Gera HTML do dashboard
  const html = generateDashboardHTML(data, settings);

  // [FASE 2] Salva dashboard em paths.dashboards
  const dashboardPath = join(paths.dashboards, 'dashboard.html');
  await writeFileSafe(dashboardPath, html);

  // Opcionalmente abre no navegador
  if (settings.open_browser) {
    openBrowser(`file://${dashboardPath}`);
  }

  console.log(`✅ Dashboard gerado: ${dashboardPath}`);

  return {
    ok: true,
    dashboard_path: dashboardPath,
    url: settings.port ? `http://localhost:${settings.port}` : undefined
  };
}

/**
 * Carrega dados de todas as análises
 * [FASE 2] Agora recebe QAPaths ao invés de string
 */
async function loadAnalysisData(paths: ReturnType<typeof getPaths>): Promise<any> {
  const data: any = {
    products: [],
    summary: {
      totalTests: 0,
      unit: 0,
      integration: 0,
      e2e: 0,
      ratio: '0:0:0'
    },
    health: {
      status: 'unknown',
      score: 0
    },
    diffCoverage: null, // 🆕 Diff Coverage
    contracts: null      // 🆕 Contracts
  };

  const files = [
    'coverage-analysis.json',
    'test-catalog.json',
    'analyze.json',
    'diff-coverage.json', // 🆕
    'test-quality-metrics.json', // 🆕 explain-tests integration
  ];

  for (const file of files) {
    // [FASE 2] Usar paths.analyses
    const filePath = join(paths.analyses, file);
    if (await fileExists(filePath)) {
      try {
        const content = await readFile(filePath);
        const json = JSON.parse(content);
        Object.assign(data, { [file.replace('.json', '')]: json });
      } catch {}
    }
  }
  
  // 🆕 Contracts: tentar reports primeiro, depois analyses (fallback)
  const contractsFile = 'contracts-verify.json';
  let contractsPath = join(paths.reports, contractsFile);
  if (!await fileExists(contractsPath)) {
    contractsPath = join(paths.analyses, contractsFile);
  }
  if (await fileExists(contractsPath)) {
    try {
      const content = await readFile(contractsPath);
      const json = JSON.parse(content);
      Object.assign(data, { 'contracts-verify': json });
    } catch {}
  }

  // Extrai dados da pirâmide de coverage-analysis.json
  if (data['coverage-analysis']?.pyramid) {
    const pyramid = data['coverage-analysis'].pyramid;
    const totalTests = (pyramid.unit?.test_cases || 0) + 
                       (pyramid.integration?.test_cases || 0) + 
                       (pyramid.e2e?.test_cases || 0);
    
    data.summary.totalTests = totalTests;
    data.summary.unit = pyramid.unit?.test_cases || 0;
    data.summary.integration = pyramid.integration?.test_cases || 0;
    data.summary.e2e = pyramid.e2e?.test_cases || 0;

    // Calcula ratio
    if (totalTests > 0) {
      const unitPct = Math.round((data.summary.unit / totalTests) * 100);
      const intPct = Math.round((data.summary.integration / totalTests) * 100);
      const e2ePct = Math.round((data.summary.e2e / totalTests) * 100);
      data.summary.ratio = `${unitPct}:${intPct}:${e2ePct}`;
    }

    // Define health baseado na pirâmide
    const health = data['coverage-analysis'].health || 'healthy';
    if (health === 'healthy') {
      data.health.status = 'healthy';
      data.health.score = 85;
    } else if (health === 'warning') {
      data.health.status = 'warning';
      data.health.score = 65;
    } else {
      data.health.status = 'critical';
      data.health.score = 35;
    }

    // Recomendações
    if (data['coverage-analysis'].recommendations) {
      data.health.recommendations = data['coverage-analysis'].recommendations;
    }
  }
  
  // 🆕 Extrai Diff Coverage
  if (data['diff-coverage']) {
    data.diffCoverage = {
      percent: data['diff-coverage'].diffCoverage || 0,
      linesAdded: data['diff-coverage'].linesAdded || 0,
      linesCovered: data['diff-coverage'].linesCovered || 0,
      baseBranch: data['diff-coverage'].baseBranch || 'main'
    };
  }
  
  // 🆕 Extrai Contracts
  if (data['contracts-verify']) {
    data.contracts = {
      total: data['contracts-verify'].total || 0,
      verified: data['contracts-verify'].verified || 0,
      failed: data['contracts-verify'].failed || 0,
      status: (data['contracts-verify'].failed || 0) === 0 ? 'success' : 'error'
    };
  }

  return data;
}

/**
 * Gera HTML interativo do dashboard
 */
function generateDashboardHTML(data: any, settings: any): string {
  const coverageData = data['coverage-analysis'] || {};
  const catalogData = data['test-catalog'] || {};
  const analyzeData = data.analyze || {};

  const summary = data.summary || { totalTests: 0, unit: 0, integration: 0, e2e: 0, ratio: '0:0:0' };
  const health = data.health || { status: 'unknown', score: 0 };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quality Dashboard - Pirâmide de Testes</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      background: white;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .header h1 {
      color: #1a202c;
      font-size: 32px;
      margin-bottom: 10px;
    }

    .header .subtitle {
      color: #718096;
      font-size: 16px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .card h2 {
      color: #1a202c;
      font-size: 18px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .metric {
      font-size: 48px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 8px;
    }

    .metric-label {
      color: #718096;
      font-size: 14px;
    }

    .status {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
    }

    .status.healthy { background: #c6f6d5; color: #22543d; }
    .status.warning { background: #feebc8; color: #7c2d12; }
    .status.critical { background: #fed7d7; color: #742a2a; }

    .pyramid {
      position: relative;
      width: 100%;
      height: 400px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      gap: 0;
    }

    .pyramid-layer {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      color: white;
      font-weight: 600;
      transition: all 0.3s;
    }

    .pyramid-layer:hover {
      transform: scale(1.02);
      z-index: 10;
    }

    .layer-e2e {
      height: 80px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      clip-path: polygon(30% 0%, 70% 0%, 85% 100%, 15% 100%);
    }

    .layer-integration {
      height: 120px;
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      clip-path: polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%);
    }

    .layer-unit {
      height: 200px;
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
      border-radius: 0 0 12px 12px;
    }

    .layer-content {
      position: absolute;
      text-align: center;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 8px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      transition: width 0.3s;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-top: 16px;
    }

    .stat-item {
      display: flex;
      justify-content: space-between;
      padding: 12px;
      background: #f7fafc;
      border-radius: 8px;
    }

    .stat-label {
      color: #718096;
      font-size: 14px;
    }

    .stat-value {
      color: #1a202c;
      font-weight: 600;
      font-size: 14px;
    }

    .emoji {
      font-size: 24px;
    }

    @media (max-width: 768px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Quality Dashboard - ${settings.product || 'Product'}</h1>
      <p class="subtitle">Pirâmide de Testes - Gerado em ${new Date().toLocaleString('pt-BR')}</p>
    </div>

    <div class="grid">
      <div class="card">
        <h2><span class="emoji">📊</span> Status Geral</h2>
        <div class="metric">${health.score}/100</div>
        <div class="metric-label">Score de Saúde</div>
        <div style="margin-top: 16px;">
          <span class="status ${health.status}">${health.status?.toUpperCase() || 'UNKNOWN'}</span>
        </div>
      </div>

      <div class="card">
        <h2><span class="emoji">🧪</span> Total de Testes</h2>
        <div class="metric">${summary.totalTests}</div>
        <div class="metric-label">Cenários de Teste</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${Math.min(100, (summary.totalTests / 100) * 100)}%"></div>
        </div>
      </div>

      <div class="card">
        <h2><span class="emoji">🔬</span> Testes Unitários</h2>
        <div class="metric">${summary.unit}</div>
        <div class="metric-label">${summary.totalTests > 0 ? ((summary.unit/summary.totalTests)*100).toFixed(1) : 0}% do total</div>
      </div>

      <div class="card">
        <h2><span class="emoji">🔗</span> Testes Integração</h2>
        <div class="metric">${summary.integration}</div>
        <div class="metric-label">${summary.totalTests > 0 ? ((summary.integration/summary.totalTests)*100).toFixed(1) : 0}% do total</div>
      </div>

      <div class="card">
        <h2><span class="emoji">🎭</span> Testes E2E</h2>
        <div class="metric">${summary.e2e}</div>
        <div class="metric-label">${summary.totalTests > 0 ? ((summary.e2e/summary.totalTests)*100).toFixed(1) : 0}% do total</div>
      </div>

      <div class="card">
        <h2><span class="emoji">📈</span> Ratio</h2>
        <div class="metric" style="font-size: 24px;">${summary.ratio || '0:0:0'}</div>
        <div class="metric-label">Unit:Integration:E2E</div>
        <div style="margin-top: 8px; color: #718096; font-size: 12px;">
          Ideal: 70:20:10
        </div>
      </div>
      
      ${data.diffCoverage ? `
      <div class="card">
        <h2><span class="emoji">📐</span> Diff Coverage (PR-Aware)</h2>
        <div class="metric" style="color: ${data.diffCoverage.percent >= 80 ? '#38a169' : '#ed8936'};">
          ${data.diffCoverage.percent.toFixed(1)}%
        </div>
        <div class="metric-label">Linhas alteradas cobertas</div>
        <div class="stats-grid" style="margin-top: 12px; grid-template-columns: 1fr 1fr;">
          <div class="stat-item">
            <span class="stat-label">Base:</span>
            <span class="stat-value">${data.diffCoverage.baseBranch}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Linhas:</span>
            <span class="stat-value">${data.diffCoverage.linesCovered}/${data.diffCoverage.linesAdded}</span>
          </div>
        </div>
      </div>
      ` : ''}
      
      ${data.contracts ? `
      <div class="card">
        <h2><span class="emoji">🤝</span> Contracts (CDC/Pact)</h2>
        <div class="metric" style="color: ${data.contracts.status === 'success' ? '#38a169' : '#e53e3e'};">
          ${data.contracts.verified}/${data.contracts.total}
        </div>
        <div class="metric-label">Contratos verificados</div>
        <div style="margin-top: 12px;">
          <span class="status ${data.contracts.status}">
            ${data.contracts.failed > 0 ? `❌ ${data.contracts.failed} falhas` : '✅ Todos passando'}
          </span>
        </div>
      </div>
      ` : ''}
      
      ${data['test-quality-metrics'] ? `
      <div class="card">
        <h2><span class="emoji">🎯</span> Test Quality (KR3a)</h2>
        <div class="metric" style="font-size: 32px; color: ${data['test-quality-metrics'].assertStrongPct >= 70 ? '#38a169' : '#ed8936'};">
          ${data['test-quality-metrics'].assertStrongPct.toFixed(1)}%
        </div>
        <div class="metric-label">Testes Fortes</div>
        <div class="stats-grid" style="margin-top: 12px;">
          <div class="stat-item">
            <span class="stat-label">Fracos:</span>
            <span class="stat-value">${data['test-quality-metrics'].assertWeakPct.toFixed(1)}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Diff Cov:</span>
            <span class="stat-value">${data['test-quality-metrics'].diffCoveredPct.toFixed(1)}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Contracts:</span>
            <span class="stat-value">${data['test-quality-metrics'].contractsProtectedPct.toFixed(1)}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">DORA Impact:</span>
            <span class="stat-value" style="color: ${data['test-quality-metrics'].weakTestsInDiffPct <= 5 ? '#38a169' : '#e53e3e'};">
              ${data['test-quality-metrics'].weakTestsInDiffPct <= 5 && data['test-quality-metrics'].contractsProtectedPct >= 90 ? '✅ CFR↓' : '⚠️ RISK'}
            </span>
          </div>
        </div>
      </div>
      ` : ''}
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <h2><span class="emoji">🏗️</span> Visualização da Pirâmide</h2>
      <div class="pyramid">
        <div class="pyramid-layer layer-e2e">
          <div class="layer-content">
            <div>E2E</div>
            <div style="font-size: 14px;">${summary.e2e} testes</div>
          </div>
        </div>
        <div class="pyramid-layer layer-integration">
          <div class="layer-content">
            <div>INTEGRATION</div>
            <div style="font-size: 14px;">${summary.integration} testes</div>
          </div>
        </div>
        <div class="pyramid-layer layer-unit">
          <div class="layer-content">
            <div>UNIT</div>
            <div style="font-size: 14px;">${summary.unit} testes</div>
          </div>
        </div>
      </div>
    </div>

    ${catalogData.squads ? `
    <div class="card">
      <h2><span class="emoji">👥</span> Cobertura por Squad</h2>
      <div class="stats-grid">
        ${catalogData.squads.map((squad: any) => `
          <div class="stat-item">
            <span class="stat-label">${squad.name}</span>
            <span class="stat-value">${squad.scenarios.length} cenários</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    ${health.issues ? `
    <div class="card">
      <h2><span class="emoji">⚠️</span> Problemas Identificados</h2>
      <ul style="margin-left: 20px; margin-top: 12px; color: #718096;">
        ${health.issues.map((issue: string) => `<li style="margin-bottom: 8px;">${issue}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    ${health.recommendations ? `
    <div class="card">
      <h2><span class="emoji">💡</span> Recomendações</h2>
      <ul style="margin-left: 20px; margin-top: 12px; color: #718096;">
        ${health.recommendations.map((rec: string) => `<li style="margin-bottom: 8px;">${rec}</li>`).join('')}
      </ul>
    </div>
    ` : ''}

    <div style="text-align: center; margin-top: 40px; color: white; opacity: 0.8;">
      <p>Gerado por <strong>Quality MCP v0.2.0</strong></p>
      <p style="font-size: 12px; margin-top: 8px;">
        Atualizado automaticamente a cada execução de análise
      </p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Abre dashboard no navegador
 */
function openBrowser(url: string): void {
  const commands: Record<string, string> = {
    darwin: 'open',
    win32: 'start',
    linux: 'xdg-open'
  };

  const command = commands[process.platform];
  if (command) {
    spawn(command, [url], { detached: true, stdio: 'ignore' }).unref();
  }
}

