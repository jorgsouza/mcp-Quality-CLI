import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { generateDashboard } from '../dashboard';

describe('generateDashboard', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/dashboard-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
    // [FASE 2] Criar estrutura qa/<product>/tests/analyses para getPaths()
    await fs.mkdir(join(testDir, 'qa/TestApp/tests/analyses'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve coletar métricas de testes', async () => {
    // [FASE 2] Criar arquivos em qa/<product>/tests/analyses (novo local via getPaths)
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/coverage-data.json'),
      JSON.stringify({ summary: { totalTests: 10, unit: 5, integration: 3, e2e: 2 }, health: { status: 'healthy', score: 90 } })
    );
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/test-catalog.json'),
      JSON.stringify({ squads: [{ name: 'Squad A', scenarios: [] }] })
    );
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/analyze.json'),
      JSON.stringify({ recommendations: [] })
    );

    const result = await generateDashboard({
      repo: testDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);
  });

  it('deve gerar dashboard HTML', async () => {
    // [FASE 2] Criar arquivos em qa/<product>/tests/analyses (novo local via getPaths)
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/coverage-data.json'),
      JSON.stringify({ summary: { totalTests: 10, unit: 5, integration: 3, e2e: 2 }, health: { status: 'healthy', score: 90 } })
    );
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/test-catalog.json'),
      JSON.stringify({ squads: [{ name: 'Squad A', scenarios: [] }] })
    );
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/analyze.json'),
      JSON.stringify({ recommendations: [] })
    );

    const result = await generateDashboard({
      repo: testDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);

    // [FASE 2] dashboard.ts agora usa paths.dashboards (qa/<product>/dashboards)
    const dashboardPath = join(testDir, 'qa/TestApp/dashboards/dashboard.html');
    const exists = await fs.access(dashboardPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(dashboardPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('TestApp');
  });

  it('deve incluir gráficos de cobertura', async () => {
    // [FASE 2] Criar arquivos em qa/<product>/tests/analyses (novo local via getPaths)
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/coverage-analysis.json'),
      JSON.stringify({
        pyramid: {
          unit: { test_cases: 50, files_found: 10 },
          integration: { test_cases: 30, files_found: 5 },
          e2e: { test_cases: 20, files_found: 3 }
        },
        health: 'healthy',
        recommendations: []
      })
    );
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/test-catalog.json'),
      JSON.stringify({ squads: [{ name: 'Squad A', scenarios: [] }] })
    );
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/analyze.json'),
      JSON.stringify({ recommendations: [] })
    );

    const result = await generateDashboard({
      repo: testDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);

    // [FASE 2] dashboard.ts agora usa paths.dashboards (qa/<product>/dashboards)
    const dashboardPath = join(testDir, 'qa/TestApp/dashboards/dashboard.html');
    const content = await fs.readFile(dashboardPath, 'utf-8');
    expect(content).toContain('50:30:20'); // Ratio calculado
  });

  it('deve gerar dashboard com visualização da pirâmide', async () => {
    // [FASE 2] Criar arquivos em qa/<product>/tests/analyses (novo local via getPaths)
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/coverage-analysis.json'),
      JSON.stringify({
        pyramid: {
          unit: { test_cases: 5, files_found: 3 },
          integration: { test_cases: 3, files_found: 2 },
          e2e: { test_cases: 2, files_found: 1 }
        },
        health: 'healthy',
        recommendations: []
      })
    );
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/test-catalog.json'),
      JSON.stringify({ squads: [{ name: 'Squad A', scenarios: [] }] })
    );
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/analyze.json'),
      JSON.stringify({ recommendations: [] })
    );

    const result = await generateDashboard({
      repo: testDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);

    // [FASE 2] dashboard.ts agora usa paths.dashboards (qa/<product>/dashboards)
    const dashboardPath = join(testDir, 'qa/TestApp/dashboards/dashboard.html');
    const content = await fs.readFile(dashboardPath, 'utf-8');
    expect(content).toContain('Visualização da Pirâmide');
  });

  it('deve lidar com ausência de métricas', async () => {
    const result = await generateDashboard({
      repo: testDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);
  });

  it('deve exibir status de saúde dos testes', async () => {
    // [FASE 2] Criar arquivos em qa/<product>/tests/analyses (novo local via getPaths)
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/coverage-analysis.json'),
      JSON.stringify({
        pyramid: {
          unit: { test_cases: 5, files_found: 3 },
          integration: { test_cases: 3, files_found: 2 },
          e2e: { test_cases: 2, files_found: 1 }
        },
        health: 'healthy',
        recommendations: []
      })
    );
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/test-catalog.json'),
      JSON.stringify({ squads: [{ name: 'Squad A', scenarios: [] }] })
    );
    await fs.writeFile(
      join(testDir, 'qa/TestApp/tests/analyses/analyze.json'),
      JSON.stringify({ recommendations: [] })
    );

    const result = await generateDashboard({
      repo: testDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);

    // [FASE 2] dashboard.ts agora usa paths.dashboards (qa/<product>/dashboards)
    const dashboardPath = join(testDir, 'qa/TestApp/dashboards/dashboard.html');
    const content = await fs.readFile(dashboardPath, 'utf-8');
    expect(content).toContain('85/100'); // Score 85 para health='healthy'
  });
});

