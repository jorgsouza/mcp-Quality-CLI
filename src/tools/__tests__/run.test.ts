import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { runPlaywright } from '../run';
import { EventEmitter } from 'events';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

describe('runPlaywright', () => {
  let testDir: string;
  let spawnMock: any;

  // Helper para criar um processo mock
  const createMockProcess = (exitCode = 0) => {
    const proc = new EventEmitter() as any;
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    
    // Simula a conclusão do processo de forma assíncrona
    process.nextTick(() => {
      proc.emit('close', exitCode);
    });
    
    return proc;
  };

  beforeEach(async () => {
    testDir = `/tmp/run-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(join(testDir, 'reports'), { recursive: true });
    await fs.mkdir(join(testDir, 'e2e'), { recursive: true });
    
    // Setup do mock do spawn - retorna sucesso por padrão
    const { spawn } = await import('node:child_process');
    spawnMock = vi.mocked(spawn);
    spawnMock.mockImplementation(() => createMockProcess(0));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('deve executar testes Playwright com todas as opções', async () => {
    const result = await runPlaywright({
      repo: testDir,
      e2e_dir: 'e2e',
      report_dir: 'reports'
    });

    expect(result.ok).toBe(true);
    expect(result.reports).toBeDefined();
    expect(result.reports.html).toContain('reports/html');
    expect(result.reports.json).toContain('reports/json');
    expect(result.reports.junit).toContain('reports/junit');
  });

  it('deve configurar variáveis de ambiente', async () => {
    const { spawn } = await import('node:child_process');
    let capturedEnv: any;
    
    vi.mocked(spawn).mockImplementation((cmd, args, opts: any) => {
      capturedEnv = opts.env;
      return createMockProcess(0);
    });

    process.env.E2E_BASE_URL = 'https://test.com';
    process.env.E2E_USER = 'testuser';
    process.env.E2E_PASS = 'testpass';

    await runPlaywright({
      repo: testDir,
      e2e_dir: 'e2e',
      report_dir: 'reports'
    });

    expect(capturedEnv.E2E_BASE_URL).toBe('https://test.com');
    expect(capturedEnv.E2E_USER).toBe('testuser');
    expect(capturedEnv.E2E_PASS).toBe('testpass');
  });

  it('deve usar valores padrão para env quando não especificados', async () => {
    const { spawn } = await import('node:child_process');
    let capturedEnv: any;
    
    vi.mocked(spawn).mockImplementation((cmd, args, opts: any) => {
      capturedEnv = opts.env;
      return createMockProcess(0);
    });

    delete process.env.E2E_BASE_URL;
    delete process.env.E2E_USER;
    delete process.env.E2E_PASS;

    await runPlaywright({
      repo: testDir,
      e2e_dir: 'e2e',
      report_dir: 'reports'
    });

    expect(capturedEnv.E2E_BASE_URL).toBeDefined();
    expect(capturedEnv.E2E_USER).toBeDefined();
    expect(capturedEnv.E2E_PASS).toBeDefined();
  });

  it('deve configurar modo headless', async () => {
    const { spawn } = await import('node:child_process');
    let capturedEnv: any;
    
    vi.mocked(spawn).mockImplementation((cmd, args, opts: any) => {
      capturedEnv = opts.env;
      return createMockProcess(0);
    });

    await runPlaywright({
      repo: testDir,
      e2e_dir: 'e2e',
      report_dir: 'reports',
      headless: true
    });

    expect(capturedEnv.HEADLESS).toBe('1');
  });

  it('deve configurar modo headed', async () => {
    const { spawn } = await import('node:child_process');
    let capturedEnv: any;
    
    vi.mocked(spawn).mockImplementation((cmd, args, opts: any) => {
      capturedEnv = opts.env;
      return createMockProcess(0);
    });

    await runPlaywright({
      repo: testDir,
      e2e_dir: 'e2e',
      report_dir: 'reports',
      headless: false
    });

    expect(capturedEnv.HEADLESS).toBe('0');
  });

  it('deve retornar caminhos dos relatórios', async () => {
    const result = await runPlaywright({
      repo: testDir,
      e2e_dir: 'e2e',
      report_dir: 'reports'
    });

    expect(result.ok).toBe(true);
    expect(result.reports).toBeDefined();
    expect(result.reports.html).toContain('reports/html');
    expect(result.reports.junit).toContain('reports/junit/results.xml');
    expect(result.reports.json).toContain('reports/json/results.json');
  });

  it('deve lidar com erro ao instalar Playwright', async () => {
    const { spawn } = await import('node:child_process');
    
    vi.mocked(spawn).mockImplementation((cmd, args: any) => {
      // Se for o comando de instalação, retorna erro
      if (args && args[0] === 'playwright' && args[1] === 'install') {
        return createMockProcess(1);
      }
      return createMockProcess(0);
    });

    const result = await runPlaywright({
      repo: testDir,
      e2e_dir: 'e2e',
      report_dir: 'reports'
    });
    
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('deve lidar com erro ao executar testes', async () => {
    const { spawn } = await import('node:child_process');
    let callCount = 0;
    
    vi.mocked(spawn).mockImplementation((cmd, args: any) => {
      callCount++;
      if (callCount === 1) {
        // Install success
        return createMockProcess(0);
      } else {
        // Test execution failure
        return createMockProcess(1);
      }
    });

    const result = await runPlaywright({
      repo: testDir,
      e2e_dir: 'e2e',
      report_dir: 'reports'
    });
    
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

