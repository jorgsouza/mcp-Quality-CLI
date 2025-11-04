/**
 * Testes para define-slos.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { defineSLOs } from '../define-slos.js';

describe('defineSLOs', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(process.cwd(), `.test-slos-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    // Criar package.json
    await fs.writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-app' }),
      'utf-8'
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('deve gerar SLOs com defaults baseados em criticidade', async () => {
    // Criar catálogo de CUJs
    const paths = await setupQAStructure(tempDir, 'TestApp');
    const cujCatalog = {
      timestamp: new Date().toISOString(),
      repo: tempDir,
      product: 'TestApp',
      sources: ['routes'],
      cujs: [
        {
          id: 'checkout',
          name: 'Checkout Flow',
          criticality: 'critical' as const,
          endpoints: ['/api/checkout'],
          dependencies: ['payment-gateway'],
        },
        {
          id: 'profile-view',
          name: 'View Profile',
          criticality: 'medium' as const,
          endpoints: ['/api/profile'],
          dependencies: [],
        },
      ],
      auto_detected: 2,
      manual_review_needed: false,
    };

    await fs.writeFile(
      join(paths.analyses, 'cuj-catalog.json'),
      JSON.stringify(cujCatalog, null, 2)
    );

    // Executar
    const result = await defineSLOs({
      repo: tempDir,
      product: 'TestApp',
    });

    // Verificar
    expect(result.ok).toBe(true);
    expect(result.slos_count).toBe(2);
    expect(result.custom_slos_count).toBe(0);

    // Verificar arquivo gerado
    const slosData = JSON.parse(
      await fs.readFile(result.output, 'utf-8')
    );

    expect(slosData.slos).toHaveLength(2);
    
    // CUJ crítico deve ter SLOs mais rigorosos
    const criticalSLO = slosData.slos.find((s: any) => s.cuj_id === 'checkout');
    expect(criticalSLO.latency_p99_ms).toBeLessThanOrEqual(500);
    expect(criticalSLO.error_rate_max).toBeLessThanOrEqual(0.01);
    expect(criticalSLO.availability_min).toBeGreaterThanOrEqual(0.995);
  });

  it('deve aplicar SLOs customizados quando fornecidos', async () => {
    const paths = await setupQAStructure(tempDir, 'TestApp');
    const cujCatalog = {
      timestamp: new Date().toISOString(),
      repo: tempDir,
      product: 'TestApp',
      sources: ['routes'],
      cujs: [
        {
          id: 'api-search',
          name: 'Search API',
          criticality: 'high' as const,
          endpoints: ['/api/search'],
          dependencies: ['elasticsearch'],
        },
      ],
      auto_detected: 1,
      manual_review_needed: false,
    };

    await fs.writeFile(
      join(paths.analyses, 'cuj-catalog.json'),
      JSON.stringify(cujCatalog, null, 2)
    );

    // Executar com SLO customizado
    const result = await defineSLOs({
      repo: tempDir,
      product: 'TestApp',
      custom_slos: [
        {
          cuj_id: 'api-search',
          slo: {
            latency_p99_ms: 200, // Mais rigoroso que o default
            error_rate_max: 0.001,
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.custom_slos_count).toBe(1);

    // Verificar arquivo gerado
    const slosData = JSON.parse(
      await fs.readFile(result.output, 'utf-8')
    );

    const searchSLO = slosData.slos[0];
    expect(searchSLO.latency_p99_ms).toBe(200);
    expect(searchSLO.error_rate_max).toBe(0.001);
  });

  it('deve aplicar defaults customizados globais', async () => {
    const paths = await setupQAStructure(tempDir, 'TestApp');
    const cujCatalog = {
      timestamp: new Date().toISOString(),
      repo: tempDir,
      product: 'TestApp',
      sources: ['routes'],
      cujs: [
        {
          id: 'api-test',
          name: 'Test API',
          criticality: 'low' as const,
          endpoints: ['/api/test'],
          dependencies: [],
        },
      ],
      auto_detected: 1,
      manual_review_needed: false,
    };

    await fs.writeFile(
      join(paths.analyses, 'cuj-catalog.json'),
      JSON.stringify(cujCatalog, null, 2)
    );

    // Executar com defaults customizados
    const result = await defineSLOs({
      repo: tempDir,
      product: 'TestApp',
      defaults: {
        latency_p99_ms: 1000,
        error_rate_max: 0.05,
        availability_min: 0.99,
      },
    });

    expect(result.ok).toBe(true);

    // Verificar
    const slosData = JSON.parse(
      await fs.readFile(result.output, 'utf-8')
    );

    const testSLO = slosData.slos[0];
    expect(testSLO.latency_p99_ms).toBe(1000);
    expect(testSLO.error_rate_max).toBe(0.05);
    expect(testSLO.availability_min).toBe(0.99);
  });

  it('deve lidar com catálogo vazio', async () => {
    const paths = await setupQAStructure(tempDir, 'TestApp');
    const cujCatalog = {
      timestamp: new Date().toISOString(),
      repo: tempDir,
      product: 'TestApp',
      sources: [],
      cujs: [],
      auto_detected: 0,
      manual_review_needed: false,
    };

    await fs.writeFile(
      join(paths.analyses, 'cuj-catalog.json'),
      JSON.stringify(cujCatalog, null, 2)
    );

    const result = await defineSLOs({
      repo: tempDir,
      product: 'TestApp',
    });

    expect(result.ok).toBe(true);
    expect(result.slos_count).toBe(0);
  });
});

/**
 * Helper para criar estrutura QA
 */
async function setupQAStructure(repo: string, product: string) {
  const paths = {
    root: join(repo, 'qa', product),
    analyses: join(repo, 'qa', product, 'tests', 'analyses'),
    reports: join(repo, 'qa', product, 'tests', 'reports'),
  };

  await fs.mkdir(paths.analyses, { recursive: true });
  await fs.mkdir(paths.reports, { recursive: true });

  return paths;
}

