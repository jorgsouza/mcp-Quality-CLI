/**
 * consolidate-reports.ts
 * 
 * Funções para consolidar múltiplos relatórios em apenas 2 arquivos principais:
 * 1. CODE-ANALYSIS.md - Análise completa do código
 * 2. TEST-PLAN.md - Planejamento estratégico de testes
 */

import { readFile, writeFileSafe, join, fileExists } from '../utils/fs.js';
import { getPaths, type QAPaths } from '../utils/paths.js';

/**
 * Consolida toda análise de código em um único relatório CODE-ANALYSIS.md
 * Inclui: analyze.json, coverage-analysis, test-logic, risk-register, CUJs, SLOs
 */
export async function consolidateCodeAnalysisReport(
  repoPath: string,
  product: string
): Promise<{ ok: boolean; path: string }> {
  console.log('📊 Consolidando análise de código...');
  
  const paths = getPaths(repoPath, product);
  
  // Carregar todos os dados de análise disponíveis
  const analyzeData = await loadJsonIfExists(join(paths.analyses, 'analyze.json'));
  const coverageData = await loadJsonIfExists(join(paths.analyses, 'coverage-analysis.json'));
  const testLogicData = await loadJsonIfExists(join(paths.analyses, 'test-logic-analysis.json'));
  const riskData = await loadJsonIfExists(join(paths.analyses, 'risk-register.json'));
  const cujData = await loadJsonIfExists(join(paths.analyses, 'cuj-catalog.json'));
  const sloData = await loadJsonIfExists(join(paths.analyses, 'slo-definitions.json'));
  
  // Construir relatório consolidado
  const sections: string[] = [];
  
  // Header
  sections.push(`# 📊 Análise Completa de Código - ${product}`);
  sections.push(`\n**Data:** ${new Date().toISOString().split('T')[0]}`);
  sections.push(`\n---\n`);
  
  // 1. Sumário Executivo
  sections.push(`## 📋 Sumário Executivo\n`);
  if (analyzeData) {
    sections.push(analyzeData.summary || 'Análise do repositório concluída.');
  }
  sections.push('\n');
  
  // 2. Arquitetura e Componentes
  sections.push(`## 🏗️ Arquitetura e Componentes\n`);
  if (analyzeData?.findings) {
    const { routes, endpoints, events } = analyzeData.findings;
    
    sections.push(`### Rotas Web (${routes?.length || 0})`);
    if (routes?.length > 0) {
      routes.slice(0, 10).forEach((route: string) => {
        sections.push(`- \`${route}\``);
      });
      if (routes.length > 10) {
        sections.push(`- ... e mais ${routes.length - 10} rotas\n`);
      }
    } else {
      sections.push('_Nenhuma rota detectada_\n');
    }
    
    sections.push(`\n### Endpoints API (${endpoints?.length || 0})`);
    if (endpoints?.length > 0) {
      endpoints.slice(0, 10).forEach((endpoint: string) => {
        sections.push(`- \`${endpoint}\``);
      });
      if (endpoints.length > 10) {
        sections.push(`- ... e mais ${endpoints.length - 10} endpoints\n`);
      }
    } else {
      sections.push('_Nenhum endpoint detectado_\n');
    }
    
    sections.push(`\n### Eventos Assíncronos (${events?.length || 0})`);
    if (events?.length > 0) {
      events.slice(0, 10).forEach((event: string) => {
        sections.push(`- \`${event}\``);
      });
      if (events.length > 10) {
        sections.push(`- ... e mais ${events.length - 10} eventos\n`);
      }
    } else {
      sections.push('_Nenhum evento detectado_\n');
    }
  }
  sections.push('\n');
  
  // 3. Mapa de Riscos
  sections.push(`## ⚠️ Mapa de Riscos\n`);
  if (analyzeData?.findings?.risk_map) {
    sections.push('| Área | Risco | Justificativa |');
    sections.push('|------|-------|---------------|');
    analyzeData.findings.risk_map.forEach((risk: any) => {
      const icon = risk.risk === 'high' ? '🔴' : risk.risk === 'med' ? '🟡' : '🟢';
      sections.push(`| ${risk.area} | ${icon} ${risk.risk.toUpperCase()} | ${risk.rationale} |`);
    });
  } else if (riskData?.risks) {
    sections.push('| Área | Prioridade | Score | Impacto |');
    sections.push('|------|------------|-------|---------|');
    riskData.risks.slice(0, 15).forEach((risk: any) => {
      const icon = risk.priority === 'critical' ? '🔴' : risk.priority === 'high' ? '🟡' : '🟢';
      sections.push(`| ${risk.area || risk.name} | ${icon} ${risk.priority} | ${risk.score || 'N/A'} | ${risk.impact || 'N/A'} |`);
    });
  } else {
    sections.push('_Nenhum risco identificado_');
  }
  sections.push('\n');
  
  // 4. Critical User Journeys (CUJs)
  if (cujData?.journeys && cujData.journeys.length > 0) {
    sections.push(`## 🎯 Critical User Journeys (CUJs)\n`);
    sections.push(`Total identificados: **${cujData.journeys.length}**\n`);
    cujData.journeys.slice(0, 10).forEach((cuj: any) => {
      const icon = cuj.priority === 'P1' ? '🔴' : cuj.priority === 'P2' ? '🟡' : '🟢';
      sections.push(`### ${icon} ${cuj.name} (${cuj.priority})`);
      sections.push(`- **Score:** ${cuj.risk_score}/100`);
      sections.push(`- **Steps:** ${cuj.steps?.length || 0} passos`);
      if (cuj.description) {
        sections.push(`- **Descrição:** ${cuj.description}`);
      }
      sections.push('');
    });
  }
  sections.push('\n');
  
  // 5. SLOs (Service Level Objectives)
  if (sloData?.slos && sloData.slos.length > 0) {
    sections.push(`## 🎯 Service Level Objectives (SLOs)\n`);
    sections.push('| Métrica | Target | Atual | Status |');
    sections.push('|---------|--------|-------|--------|');
    sloData.slos.forEach((slo: any) => {
      const status = slo.current_value >= slo.target ? '✅' : '❌';
      sections.push(`| ${slo.name} | ${slo.target}${slo.unit || ''} | ${slo.current_value || 'N/A'}${slo.unit || ''} | ${status} |`);
    });
    sections.push('\n');
  }
  
  // 6. Cobertura de Testes
  sections.push(`## 📊 Cobertura de Testes\n`);
  if (coverageData) {
    sections.push(`### Saúde Geral: **${coverageData.health || 'N/A'}**\n`);
    
    if (coverageData.pyramid) {
      sections.push('### Pirâmide de Testes\n');
      sections.push('| Tipo | Total | Cobertura |');
      sections.push('|------|-------|-----------|');
      sections.push(`| Unit | ${coverageData.pyramid.unit?.count || 0} | ${coverageData.pyramid.unit?.coverage || 0}% |`);
      sections.push(`| Integration | ${coverageData.pyramid.integration?.count || 0} | ${coverageData.pyramid.integration?.coverage || 0}% |`);
      sections.push(`| E2E | ${coverageData.pyramid.e2e?.count || 0} | ${coverageData.pyramid.e2e?.coverage || 0}% |`);
      sections.push('\n');
    }
    
    if (coverageData.metrics) {
      sections.push('### Métricas Detalhadas\n');
      sections.push(`- **Lines:** ${coverageData.metrics.lines || 0}%`);
      sections.push(`- **Branches:** ${coverageData.metrics.branches || 0}%`);
      sections.push(`- **Functions:** ${coverageData.metrics.functions || 0}%`);
      sections.push(`- **Statements:** ${coverageData.metrics.statements || 0}%`);
      sections.push('\n');
    }
  } else {
    sections.push('_Análise de cobertura não disponível. Execute os testes primeiro._\n');
  }
  
  // 7. Qualidade dos Testes
  sections.push(`## 🔬 Qualidade dos Testes\n`);
  if (testLogicData?.metrics) {
    const { qualityScore, grade, scenarioCoverage, assertions, mocking } = testLogicData.metrics;
    
    sections.push(`### Score de Qualidade: **${qualityScore}/100 (${grade})**\n`);
    
    sections.push('### Cobertura de Cenários\n');
    sections.push(`- 🎯 **Happy Path:** ${scenarioCoverage.happy.toFixed(1)}%`);
    sections.push(`- ⚠️ **Error Handling:** ${scenarioCoverage.error.toFixed(1)}%`);
    sections.push(`- 🔀 **Edge Cases:** ${scenarioCoverage.edge.toFixed(1)}%`);
    sections.push(`- 🔄 **Side Effects:** ${scenarioCoverage.side.toFixed(1)}%`);
    sections.push('\n');
    
    if (assertions) {
      sections.push('### Assertions\n');
      sections.push(`- **Total:** ${assertions.total}`);
      sections.push(`- **Por teste:** ${assertions.avgPerTest.toFixed(1)}`);
      sections.push(`- **Testes sem assertions:** ${assertions.testsWithoutAssertions}`);
      sections.push('\n');
    }
    
    if (mocking) {
      sections.push('### Mocking\n');
      sections.push(`- **Testes com mocks:** ${mocking.testsWithMocks}`);
      sections.push(`- **Total de mocks:** ${mocking.totalMocks}`);
      sections.push('\n');
    }
  } else {
    sections.push('_Análise de qualidade não disponível._\n');
  }
  
  // 8. Recomendações
  if (analyzeData?.recommendations && analyzeData.recommendations.length > 0) {
    sections.push(`## 💡 Recomendações\n`);
    analyzeData.recommendations.forEach((rec: string, idx: number) => {
      sections.push(`${idx + 1}. ${rec}`);
    });
    sections.push('\n');
  }
  
  // Footer
  sections.push(`---\n`);
  sections.push(`**Gerado por:** Quality MCP v0.4.0`);
  sections.push(`**Timestamp:** ${new Date().toISOString()}`);
  
  // Salvar relatório
  const outputPath = join(paths.reports, 'CODE-ANALYSIS.md');
  await writeFileSafe(outputPath, sections.join('\n'));
  
  console.log(`✅ Relatório consolidado: ${outputPath}`);
  
  return { ok: true, path: outputPath };
}

/**
 * Consolida todo planejamento de testes em um único relatório TEST-PLAN.md
 * Inclui: TEST-PLAN, TEST-STRATEGY, PYRAMID-REPORT, portfolio-plan
 */
export async function consolidateTestPlanReport(
  repoPath: string,
  product: string
): Promise<{ ok: boolean; path: string }> {
  console.log('📋 Consolidando plano de testes...');
  
  const paths = getPaths(repoPath, product);
  
  // Carregar dados de planejamento
  const planPath = join(paths.reports, 'TEST-PLAN.md');
  const strategyPath = join(paths.analyses, 'TEST-STRATEGY-RECOMMENDATION.md');
  const pyramidPath = join(paths.reports, 'PYRAMID-REPORT.md');
  const portfolioPath = join(paths.reports, 'PORTFOLIO-PLAN.md');
  
  const planContent = await loadFileIfExists(planPath);
  const strategyContent = await loadFileIfExists(strategyPath);
  const pyramidContent = await loadFileIfExists(pyramidPath);
  const portfolioContent = await loadFileIfExists(portfolioPath);
  
  const coverageData = await loadJsonIfExists(join(paths.analyses, 'coverage-analysis.json'));
  const riskData = await loadJsonIfExists(join(paths.analyses, 'risk-register.json'));
  
  // Construir relatório consolidado
  const sections: string[] = [];
  
  // Header
  sections.push(`# 📋 Plano Estratégico de Testes - ${product}`);
  sections.push(`\n**Data:** ${new Date().toISOString().split('T')[0]}`);
  sections.push(`\n---\n`);
  
  // 1. Objetivo e Escopo
  sections.push(`## 🎯 Objetivo e Escopo\n`);
  sections.push(`Este documento consolida a estratégia completa de testes para **${product}**, incluindo:`);
  sections.push(`- Estratégia de testes baseada na pirâmide de testes`);
  sections.push(`- Plano de implementação priorizado por risco`);
  sections.push(`- Recomendações de arquitetura de testes`);
  sections.push(`- Distribuição ideal de testes (Unit/Integration/E2E)\n`);
  sections.push(`\n---\n`);
  
  // 2. Estratégia de Testes (do TEST-STRATEGY-RECOMMENDATION)
  if (strategyContent) {
    sections.push(`## 📐 Estratégia de Testes\n`);
    // Extrair a parte relevante do strategy (remover header duplicado)
    const strategyBody = strategyContent
      .replace(/^#.*\n/, '')
      .replace(/\*\*Data:\*\*.*\n/, '')
      .replace(/^---\n/, '')
      .trim();
    sections.push(strategyBody);
    sections.push(`\n---\n`);
  }
  
  // 3. Pirâmide de Testes Atual vs Ideal (do PYRAMID-REPORT)
  sections.push(`## 📊 Pirâmide de Testes: Atual vs Ideal\n`);
  if (coverageData?.pyramid) {
    const { unit, integration, e2e } = coverageData.pyramid;
    
    sections.push('### Distribuição Atual\n');
    sections.push('| Tipo | Quantidade | % do Total |');
    sections.push('|------|-----------|-----------|');
    sections.push(`| Unit | ${unit?.count || 0} | ${unit?.percentage || 0}% |`);
    sections.push(`| Integration | ${integration?.count || 0} | ${integration?.percentage || 0}% |`);
    sections.push(`| E2E | ${e2e?.count || 0} | ${e2e?.percentage || 0}% |`);
    sections.push('\n');
    
    sections.push('### Distribuição Ideal (Recomendada)\n');
    sections.push('| Tipo | % Recomendado | Gap |');
    sections.push('|------|--------------|-----|');
    sections.push(`| Unit | 70% | ${Math.abs(70 - (unit?.percentage || 0)).toFixed(1)}% |`);
    sections.push(`| Integration | 20% | ${Math.abs(20 - (integration?.percentage || 0)).toFixed(1)}% |`);
    sections.push(`| E2E | 10% | ${Math.abs(10 - (e2e?.percentage || 0)).toFixed(1)}% |`);
    sections.push('\n');
    
    if (coverageData.health) {
      sections.push(`**Saúde da Pirâmide:** ${coverageData.health}\n`);
    }
  } else {
    sections.push('_Análise da pirâmide não disponível. Execute a análise de cobertura primeiro._\n');
  }
  sections.push(`\n---\n`);
  
  // 4. Plano de Implementação (do TEST-PLAN)
  if (planContent) {
    sections.push(`## 🗓️ Plano de Implementação\n`);
    // Extrair a parte relevante do plano (remover header duplicado)
    const planBody = planContent
      .replace(/^#.*\n/, '')
      .replace(/\*\*Data:\*\*.*\n/, '')
      .replace(/^---\n/, '')
      .trim();
    sections.push(planBody);
    sections.push(`\n---\n`);
  }
  
  // 5. Portfolio de Testes (do PORTFOLIO-PLAN)
  if (portfolioContent) {
    sections.push(`## 📦 Portfolio de Testes\n`);
    const portfolioBody = portfolioContent
      .replace(/^#.*\n/, '')
      .replace(/\*\*Data:\*\*.*\n/, '')
      .replace(/^---\n/, '')
      .trim();
    sections.push(portfolioBody);
    sections.push(`\n---\n`);
  }
  
  // 6. Módulos Prioritários (baseado em riscos)
  if (riskData?.risks && riskData.risks.length > 0) {
    sections.push(`## 🎯 Módulos Prioritários para Testes\n`);
    sections.push('Priorização baseada no score de risco:\n');
    sections.push('| Módulo | Prioridade | Score | Ação Recomendada |');
    sections.push('|--------|-----------|-------|------------------|');
    
    const topRisks = riskData.risks
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
      .slice(0, 10);
    
    topRisks.forEach((risk: any) => {
      const icon = risk.priority === 'critical' ? '🔴' : risk.priority === 'high' ? '🟡' : '🟢';
      const action = risk.priority === 'critical' 
        ? 'E2E + Unit completo'
        : risk.priority === 'high'
        ? 'Unit + Integration'
        : 'Unit básico';
      sections.push(`| ${risk.area || risk.name} | ${icon} ${risk.priority} | ${risk.score || 'N/A'} | ${action} |`);
    });
    sections.push('\n');
  }
  
  // 7. Métricas e Gates de Qualidade
  sections.push(`## ✅ Métricas e Gates de Qualidade\n`);
  sections.push('### Targets Recomendados\n');
  sections.push('| Métrica | Target | Descrição |');
  sections.push('|---------|--------|-----------|');
  sections.push('| Coverage (Lines) | ≥ 80% | Cobertura mínima de linhas |');
  sections.push('| Coverage (Branches) | ≥ 75% | Cobertura de branches |');
  sections.push('| Diff Coverage | ≥ 80% | Cobertura em PRs |');
  sections.push('| Mutation Score | ≥ 70% | Qualidade dos testes |');
  sections.push('| Flaky Rate | ≤ 3% | Taxa de testes instáveis |');
  sections.push('| CI P95 Time | ≤ 15min | Tempo de execução |');
  sections.push('\n');
  
  // 8. Roadmap
  sections.push(`## 🗺️ Roadmap de Implementação\n`);
  sections.push('### Fase 1: Foundation (Sprint 1-2)\n');
  sections.push('- [ ] Setup de infraestrutura de testes');
  sections.push('- [ ] Implementar testes unitários para módulos críticos (P1)');
  sections.push('- [ ] Configurar CI/CD com gates de qualidade');
  sections.push('- [ ] Estabelecer baselines de coverage\n');
  
  sections.push('### Fase 2: Core Coverage (Sprint 3-4)\n');
  sections.push('- [ ] Completar cobertura unit dos módulos P1 e P2');
  sections.push('- [ ] Implementar testes de integração principais');
  sections.push('- [ ] Adicionar testes E2E para CUJs críticos');
  sections.push('- [ ] Atingir 60% de coverage geral\n');
  
  sections.push('### Fase 3: Quality Excellence (Sprint 5-6)\n');
  sections.push('- [ ] Mutation testing para módulos críticos');
  sections.push('- [ ] Refatoração de testes flaky');
  sections.push('- [ ] Contract testing (CDC) entre serviços');
  sections.push('- [ ] Atingir 80% de coverage e mutation score ≥ 70%\n');
  
  sections.push('### Fase 4: Automation & Monitoring (Sprint 7+)\n');
  sections.push('- [ ] Dashboard de qualidade automatizado');
  sections.push('- [ ] Alertas de regressão de qualidade');
  sections.push('- [ ] Otimização de performance de testes');
  sections.push('- [ ] Documentação e treinamento da equipe\n');
  
  // Footer
  sections.push(`---\n`);
  sections.push(`## 📚 Recursos e Ferramentas\n`);
  sections.push('### Frameworks e Ferramentas Recomendadas\n');
  sections.push('- **Unit Tests:** Vitest / Jest');
  sections.push('- **E2E Tests:** Playwright');
  sections.push('- **Contract Tests:** Pact');
  sections.push('- **Mutation Testing:** Stryker');
  sections.push('- **Coverage:** c8 / Istanbul');
  sections.push('- **CI/CD:** GitHub Actions / GitLab CI\n');
  
  sections.push(`---\n`);
  sections.push(`**Gerado por:** Quality MCP v0.4.0`);
  sections.push(`**Timestamp:** ${new Date().toISOString()}`);
  
  // Salvar relatório
  const outputPath = join(paths.reports, 'TEST-PLAN.md');
  await writeFileSafe(outputPath, sections.join('\n'));
  
  console.log(`✅ Plano de testes consolidado: ${outputPath}`);
  
  return { ok: true, path: outputPath };
}

/**
 * Helper: carrega arquivo JSON se existir
 */
async function loadJsonIfExists(path: string): Promise<any | null> {
  try {
    if (await fileExists(path)) {
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`⚠️  Erro ao carregar ${path}:`, error);
  }
  return null;
}

/**
 * Helper: carrega arquivo de texto se existir
 */
async function loadFileIfExists(path: string): Promise<string | null> {
  try {
    if (await fileExists(path)) {
      return await readFile(path, 'utf-8');
    }
  } catch (error) {
    console.warn(`⚠️  Erro ao carregar ${path}:`, error);
  }
  return null;
}

