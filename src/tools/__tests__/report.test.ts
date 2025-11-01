import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { buildReport } from '../report';

describe('buildReport', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/report-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(join(testDir, 'json'), { recursive: true });
    await fs.mkdir(join(testDir, 'html'), { recursive: true });
    await fs.mkdir(join(testDir, 'junit'), { recursive: true });
    await fs.mkdir(join(testDir, 'coverage'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve ler JSON do Playwright e gerar relatório', async () => {
    await fs.writeFile(
      join(testDir, 'json/results.json'),
      JSON.stringify({
        stats: {
          expected: 50,
          passed: 45,
          failed: 3,
          flaky: 2,
          duration: 120000
        }
      })
    );

    const result = await buildReport({
      in_dir: testDir,
      out_file: join(testDir, 'SUMMARY.md')
    });

    expect(result.ok).toBe(true);
    expect(result.out).toBe(join(testDir, 'SUMMARY.md'));

    const content = await fs.readFile(result.out, 'utf-8');
    expect(content).toContain('QA Report');
    expect(content).toContain('| **Passou** | 45 (90.00%) |');
    expect(content).toContain('| **Falhou** | 3 |');
    expect(content).toContain('| **Flaky** | 2 (4.00%) ❌ |');
  });

  it('deve incluir artefatos no relatório', async () => {
    await fs.writeFile(
      join(testDir, 'json/results.json'),
      JSON.stringify({
        stats: {
          expected: 10,
          passed: 10,
          failed: 0,
          flaky: 0,
          duration: 30000
        }
      })
    );

    const result = await buildReport({
      in_dir: testDir,
      out_file: join(testDir, 'SUMMARY.md')
    });

    expect(result.ok).toBe(true);

    const content = await fs.readFile(result.out, 'utf-8');
    expect(content).toContain('Artefatos');
    expect(content).toContain('html/index.html');
    expect(content).toContain('junit/results.xml');
    expect(content).toContain('json/results.json');
  });

  it('deve adicionar recomendações ao relatório', async () => {
    await fs.writeFile(
      join(testDir, 'json/results.json'),
      JSON.stringify({
        stats: {
          expected: 20,
          passed: 15,
          failed: 3,
          flaky: 2,
          duration: 60000
        }
      })
    );

    const result = await buildReport({
      in_dir: testDir,
      out_file: join(testDir, 'SUMMARY.md')
    });

    expect(result.ok).toBe(true);

    const content = await fs.readFile(result.out, 'utf-8');
    expect(content).toContain('Próximas Ações');
    expect(content).toContain('flaky');
  });

  it('deve verificar thresholds de flaky', async () => {
    await fs.writeFile(
      join(testDir, 'json/results.json'),
      JSON.stringify({
        stats: {
          expected: 100,
          passed: 95,
          failed: 0,
          flaky: 5,
          duration: 180000
        }
      })
    );

    const result = await buildReport({
      in_dir: testDir,
      out_file: join(testDir, 'SUMMARY.md'),
      thresholds: {
        flaky_pct_max: 3
      }
    });

    expect(result.ok).toBe(true);

    const content = await fs.readFile(result.out, 'utf-8');
    expect(content).toContain('❌ Resolver testes flaky (meta: ≤ 3%)');
  });

  it('deve verificar thresholds de diff-coverage', async () => {
    await fs.writeFile(
      join(testDir, 'json/results.json'),
      JSON.stringify({
        stats: {
          expected: 50,
          passed: 50,
          failed: 0,
          flaky: 0,
          duration: 90000
        }
      })
    );

    const result = await buildReport({
      in_dir: testDir,
      out_file: join(testDir, 'SUMMARY.md'),
      thresholds: {
        diff_coverage_min: 60
      }
    });

    expect(result.ok).toBe(true);

    const content = await fs.readFile(result.out, 'utf-8');
    expect(content).toContain('N/A*');
  });

  it('deve lidar com arquivo JSON inexistente', async () => {
    const result = await buildReport({
      in_dir: testDir,
      out_file: join(testDir, 'SUMMARY.md')
    });

    expect(result.ok).toBe(true);
    
    const content = await fs.readFile(result.out, 'utf-8');
    expect(content).toContain('0 (0.00%)');
  });

  it('deve calcular duração em segundos corretamente', async () => {
    await fs.writeFile(
      join(testDir, 'json/results.json'),
      JSON.stringify({
        stats: {
          expected: 10,
          passed: 10,
          failed: 0,
          flaky: 0,
          duration: 125000 // 125 segundos
        }
      })
    );

    const result = await buildReport({
      in_dir: testDir,
      out_file: join(testDir, 'SUMMARY.md')
    });

    expect(result.ok).toBe(true);

    const content = await fs.readFile(result.out, 'utf-8');
    expect(content).toContain('125s');
  });

  it('deve usar thresholds padrão quando não especificados', async () => {
    await fs.writeFile(
      join(testDir, 'json/results.json'),
      JSON.stringify({
        stats: {
          expected: 30,
          passed: 30,
          failed: 0,
          flaky: 0,
          duration: 45000
        }
      })
    );

    const result = await buildReport({
      in_dir: testDir,
      out_file: join(testDir, 'SUMMARY.md')
    });

    expect(result.ok).toBe(true);

    const content = await fs.readFile(result.out, 'utf-8');
    expect(content).toContain('✅ Resolver testes flaky (meta: ≤ 3%)');
    expect(content).toContain('N/A*');
  });
});

