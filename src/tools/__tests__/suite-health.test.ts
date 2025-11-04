/**
 * Testes para suite-health.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { suiteHealth } from '../suite-health.js';

describe('suiteHealth', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(process.cwd(), `.test-suite-health-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    await fs.writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ 
        name: 'test-app',
        devDependencies: { vitest: '^2.0.0' }
      }),
      'utf-8'
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('deve medir saúde básica da suíte', async () => {
    // Criar estrutura QA
    const qaDir = join(tempDir, 'qa', 'TestApp', 'tests');
    await fs.mkdir(qaDir, { recursive: true });
    await fs.mkdir(join(qaDir, 'reports'), { recursive: true });

    // Criar alguns arquivos de teste
    await fs.mkdir(join(tempDir, 'src', '__tests__'), { recursive: true });
    await fs.writeFile(
      join(tempDir, 'src', '__tests__', 'test1.test.ts'),
      'import { it } from "vitest"; it("test", () => {});'
    );
    await fs.writeFile(
      join(tempDir, 'src', '__tests__', 'test2.test.ts'),
      'import { it } from "vitest"; it("test", () => {});'
    );

    const result = await suiteHealth({
      repo: tempDir,
      product: 'TestApp',
    });

    expect(result.ok).toBe(true);
    expect(result.total_runtime_sec).toBeGreaterThanOrEqual(0);
    expect(result.flaky_tests_count).toBeGreaterThanOrEqual(0);
    expect(result.instability_index).toBeGreaterThanOrEqual(0);
    expect(result.instability_index).toBeLessThanOrEqual(1);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('deve calcular instability index', async () => {
    const qaDir = join(tempDir, 'qa', 'TestApp', 'tests');
    await fs.mkdir(join(qaDir, 'reports'), { recursive: true });

    const result = await suiteHealth({
      repo: tempDir,
      product: 'TestApp',
    });

    expect(result.instability_index).toBeDefined();
    expect(typeof result.instability_index).toBe('number');
    expect(result.instability_index).toBeGreaterThanOrEqual(0);
    expect(result.instability_index).toBeLessThanOrEqual(1);
  });

  it('deve gerar recomendações', async () => {
    const qaDir = join(tempDir, 'qa', 'TestApp', 'tests');
    await fs.mkdir(join(qaDir, 'reports'), { recursive: true });

    const result = await suiteHealth({
      repo: tempDir,
      product: 'TestApp',
    });

    expect(result.recommendations).toBeDefined();
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('deve salvar relatório em JSON', async () => {
    const qaDir = join(tempDir, 'qa', 'TestApp', 'tests');
    await fs.mkdir(join(qaDir, 'reports'), { recursive: true });

    const result = await suiteHealth({
      repo: tempDir,
      product: 'TestApp',
    });

    expect(result.output).toContain('suite-health.json');
    
    // Verificar se arquivo foi criado
    const exists = await fs.access(result.output).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    // Verificar estrutura
    const content = JSON.parse(await fs.readFile(result.output, 'utf-8'));
    expect(content).toHaveProperty('timestamp');
    expect(content).toHaveProperty('total_runtime_sec');
    expect(content).toHaveProperty('instability_index');
    expect(content).toHaveProperty('recommendations');
  });
});

