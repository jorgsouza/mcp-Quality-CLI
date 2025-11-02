import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runDiffCoverage } from '../run-diff-coverage.js';
import * as fs from '../../utils/fs.js';
import { spawn } from 'node:child_process';
import * as paths from '../../utils/paths.js';

// Mock do spawn
vi.mock('node:child_process');

describe('runDiffCoverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock ensurePaths para não tentar criar diretórios reais
    vi.spyOn(paths, 'ensurePaths').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve retornar 100% quando não há mudanças', async () => {
    // Mock git diff retornando vazio
    vi.mocked(spawn).mockImplementation((cmd: string, args: any) => {
      const mockProcess: any = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: (event: string, callback: Function) => {
          if (event === 'close') {
            callback(0);
          }
        }
      };
      return mockProcess;
    });

    const result = await runDiffCoverage({
      repo: '/fake/repo',
      product: 'TestProduct'
    });

    expect(result.ok).toBe(true);
    expect(result.diff_coverage_percent).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.changed_files).toHaveLength(0);
  });

  it('deve calcular cobertura corretamente com arquivos modificados', async () => {
    let callCount = 0;
    
    vi.mocked(spawn).mockImplementation((cmd: string, args: any) => {
      const mockProcess: any = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: (event: string, callback: Function) => {
          if (event === 'close') {
            callback(0);
          }
        }
      };

      // Primeira chamada: git diff
      if (callCount === 0) {
        callCount++;
        mockProcess.stdout.on = (event: string, callback: Function) => {
          if (event === 'data') {
            callback('10\t5\tsrc/test.ts\n20\t10\tsrc/other.ts\n');
          }
        };
      }

      return mockProcess;
    });

    vi.spyOn(fs, 'fileExists').mockResolvedValue(false);
    vi.spyOn(fs, 'writeFileSafe').mockResolvedValue(undefined);

    const result = await runDiffCoverage({
      repo: '/fake/repo',
      product: 'TestProduct',
      target_min: 60
    });

    expect(result.changed_files.length).toBeGreaterThan(0);
    expect(result.total_changed_lines).toBeGreaterThan(0);
  });

  it('deve falhar quando diff coverage < target_min', async () => {
    let callCount = 0;
    
    vi.mocked(spawn).mockImplementation((cmd: string, args: any) => {
      const mockProcess: any = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: (event: string, callback: Function) => {
          if (event === 'close') {
            callback(0);
          }
        }
      };

      if (callCount === 0) {
        callCount++;
        mockProcess.stdout.on = (event: string, callback: Function) => {
          if (event === 'data') {
            callback('100\t0\tsrc/uncovered.ts\n');
          }
        };
      }

      return mockProcess;
    });

    vi.spyOn(fs, 'fileExists').mockResolvedValue(false);
    vi.spyOn(fs, 'writeFileSafe').mockResolvedValue(undefined);

    const result = await runDiffCoverage({
      repo: '/fake/repo',
      product: 'TestProduct',
      target_min: 80,
      fail_on_low: true
    });

    expect(result.passed).toBe(false);
    expect(result.diff_coverage_percent).toBeLessThan(80);
  });

  it('deve usar configuração do mcp-settings.json', async () => {
    vi.mocked(spawn).mockImplementation(() => {
      const mockProcess: any = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: (event: string, callback: Function) => {
          if (event === 'close') callback(0);
        }
      };
      return mockProcess;
    });

    vi.spyOn(fs, 'fileExists').mockResolvedValue(true);
    vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
      product: 'TestProduct',
      base_url: 'https://test.com',
      targets: {
        diff_coverage_min: 75
      }
    }));
    vi.spyOn(fs, 'writeFileSafe').mockResolvedValue(undefined);

    const result = await runDiffCoverage({
      repo: '/fake/repo',
      product: 'TestProduct'
    });

    expect(result.target_min).toBe(75);
  });

  it('deve gerar relatório em markdown', async () => {
    let callCount = 0;
    
    vi.mocked(spawn).mockImplementation(() => {
      const mockProcess: any = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: (event: string, callback: Function) => {
          if (event === 'close') callback(0);
        }
      };

      // Mock git diff retornando arquivos modificados
      if (callCount === 0) {
        callCount++;
        mockProcess.stdout.on = (event: string, callback: Function) => {
          if (event === 'data') {
            callback('10\t0\tsrc/test.ts\n');
          }
        };
      }

      return mockProcess;
    });

    vi.spyOn(fs, 'fileExists').mockResolvedValue(false);
    
    let savedReport = '';
    vi.spyOn(fs, 'writeFileSafe').mockImplementation(async (path: string, content: string) => {
      if (path.includes('DIFF-COVERAGE-REPORT.md')) {
        savedReport = content;
      }
    });

    await runDiffCoverage({
      repo: '/fake/repo',
      product: 'TestProduct'
    });

    expect(savedReport).toContain('# Diff Coverage Report');
    expect(savedReport).toContain('TestProduct');
  });

  it('deve identificar arquivos sem testes', async () => {
    let callCount = 0;
    
    vi.mocked(spawn).mockImplementation((cmd: string, args: any) => {
      const mockProcess: any = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: (event: string, callback: Function) => {
          if (event === 'close') {
            callback(0);
          }
        }
      };

      if (callCount === 0) {
        callCount++;
        mockProcess.stdout.on = (event: string, callback: Function) => {
          if (event === 'data') {
            callback('50\t0\tsrc/new-feature.ts\n');
          }
        };
      }

      return mockProcess;
    });

    vi.spyOn(fs, 'fileExists').mockResolvedValue(false);
    vi.spyOn(fs, 'writeFileSafe').mockResolvedValue(undefined);

    const result = await runDiffCoverage({
      repo: '/fake/repo',
      product: 'TestProduct'
    });

    expect(result.changed_files.some(f => f.status === 'no_tests')).toBe(true);
  });
});
