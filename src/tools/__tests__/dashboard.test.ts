import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { generateDashboard } from '../dashboard';

describe('generateDashboard', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/dashboard-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(join(testDir, 'tests/analyses'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve coletar métricas de testes', async () => {
    await fs.writeFile(
      join(testDir, 'tests/analyses/coverage-data.json'),
      JSON.stringify({ summary: { totalTests: 10, unit: 5, integration: 3, e2e: 2 }, health: { status: 'healthy', score: 90 } })
    );
    await fs.writeFile(
      join(testDir, 'tests/analyses/test-catalog.json'),
      JSON.stringify({ squads: [{ name: 'Squad A', scenarios: [] }] })
    );
    await fs.writeFile(
      join(testDir, 'tests/analyses/analyze.json'),
      JSON.stringify({ recommendations: [] })
    );

    const result = await generateDashboard({
      repo: testDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);
  });

  it('deve gerar dashboard HTML', async () => {
    await fs.writeFile(
      join(testDir, 'tests/analyses/coverage-data.json'),
      JSON.stringify({ summary: { totalTests: 10, unit: 5, integration: 3, e2e: 2 }, health: { status: 'healthy', score: 90 } })
    );
    await fs.writeFile(
      join(testDir, 'tests/analyses/test-catalog.json'),
      JSON.stringify({ squads: [{ name: 'Squad A', scenarios: [] }] })
    );
    await fs.writeFile(
      join(testDir, 'tests/analyses/analyze.json'),
      JSON.stringify({ recommendations: [] })
    );

    const result = await generateDashboard({
      repo: testDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);

    const dashboardPath = join(testDir, 'tests/analyses/dashboard.html');
    const exists = await fs.access(dashboardPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(dashboardPath, 'utf-8');
    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('TestApp');
  });

  it('deve incluir gráficos de cobertura', async () => {
    await fs.writeFile(
      join(testDir, 'tests/analyses/coverage-data.json'),
      JSON.stringify({ summary: { totalTests: 10, unit: 5, integration: 3, e2e: 2, ratio: '5:3:2' }, health: { status: 'healthy', score: 90 } })
    );
    await fs.writeFile(
      join(testDir, 'tests/analyses/test-catalog.json'),
      JSON.stringify({ squads: [{ name: 'Squad A', scenarios: [] }] })
    );
    await fs.writeFile(
      join(testDir, 'tests/analyses/analyze.json'),
      JSON.stringify({ recommendations: [] })
    );

    const result = await generateDashboard({
      repo: testDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);

    const dashboardPath = join(testDir, 'tests/analyses/dashboard.html');
    const content = await fs.readFile(dashboardPath, 'utf-8');
    expect(content).toContain('5:3:2');
  });

  it('deve incluir histórico de execuções', async () => {
    await fs.writeFile(
      join(testDir, 'tests/analyses/coverage-data.json'),
      JSON.stringify({ summary: { totalTests: 10, unit: 5, integration: 3, e2e: 2 }, health: { status: 'healthy', score: 90 } })
    );
    await fs.writeFile(
      join(testDir, 'tests/analyses/test-catalog.json'),
      JSON.stringify({ squads: [{ name: 'Squad A', scenarios: [] }] })
    );
    await fs.writeFile(
      join(testDir, 'tests/analyses/analyze.json'),
      JSON.stringify({ recommendations: [] })
    );

    const result = await generateDashboard({
      repo: testDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);

    const dashboardPath = join(testDir, 'tests/analyses/dashboard.html');
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
    await fs.writeFile(
      join(testDir, 'tests/analyses/coverage-data.json'),
      JSON.stringify({ summary: { totalTests: 10, unit: 5, integration: 3, e2e: 2 }, health: { status: 'healthy', score: 90 } })
    );
    await fs.writeFile(
      join(testDir, 'tests/analyses/test-catalog.json'),
      JSON.stringify({ squads: [{ name: 'Squad A', scenarios: [] }] })
    );
    await fs.writeFile(
      join(testDir, 'tests/analyses/analyze.json'),
      JSON.stringify({ recommendations: [] })
    );

    const result = await generateDashboard({
      repo: testDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);

    const dashboardPath = join(testDir, 'tests/analyses/dashboard.html');
    const content = await fs.readFile(dashboardPath, 'utf-8');
    expect(content).toContain('90/100');
  });
});

