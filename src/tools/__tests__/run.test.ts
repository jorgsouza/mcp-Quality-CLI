import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { runPlaywright } from '../run';

// Mock execFile
vi.mock('node:child_process', () => ({
  execFile: vi.fn()
}));

describe('runPlaywright', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/run-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(join(testDir, 'reports'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation((cmd, args, opts, cb: any) => {
      cb(null, { stdout: 'ok', stderr: '' });
      return {} as any;
    });

    vi.spyOn(fs, 'access').mockResolvedValue(undefined);

    const result = await runPlaywright({
      repo: testDir,
      e2e_dir: 'e2e',
      report_dir: 'reports'
    });

    expect(result.ok).toBe(true);
    
    const htmlExists = await fs.access(join(testDir, 'reports/html')).then(() => true).catch(() => false);
    const jsonExists = await fs.access(join(testDir, 'reports/json')).then(() => true).catch(() => false);
    const junitExists = await fs.access(join(testDir, 'reports/junit')).then(() => true).catch(() => false);
    
    expect(htmlExists).toBe(true);
    expect(jsonExists).toBe(true);
    expect(junitExists).toBe(true);
  });

  it('deve configurar variáveis de ambiente', async () => {
    const { execFile } = await import('node:child_process');
    let capturedEnv: any;
    
    vi.mocked(execFile).mockImplementation((cmd, args, opts: any, cb: any) => {
      capturedEnv = opts.env;
      cb(null, { stdout: 'ok', stderr: '' });
      return {} as any;
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
    const { execFile } = await import('node:child_process');
    let capturedEnv: any;
    
    vi.mocked(execFile).mockImplementation((cmd, args, opts: any, cb: any) => {
      capturedEnv = opts.env;
      cb(null, { stdout: 'ok', stderr: '' });
      return {} as any;
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
    const { execFile } = await import('node:child_process');
    let capturedEnv: any;
    
    vi.mocked(execFile).mockImplementation((cmd, args, opts: any, cb: any) => {
      capturedEnv = opts.env;
      cb(null, { stdout: 'ok', stderr: '' });
      return {} as any;
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
    const { execFile } = await import('node:child_process');
    let capturedEnv: any;
    
    vi.mocked(execFile).mockImplementation((cmd, args, opts: any, cb: any) => {
      capturedEnv = opts.env;
      cb(null, { stdout: 'ok', stderr: '' });
      return {} as any;
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
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation((cmd, args, opts, cb: any) => {
      cb(null, { stdout: 'ok', stderr: '' });
      return {} as any;
    });

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
    const { execFile } = await import('node:child_process');
    vi.mocked(execFile).mockImplementation((cmd, args, opts, cb: any) => {
      if (args && args[0] === 'playwright' && args[1] === 'install') {
        cb(new Error('Failed to install'), { stdout: '', stderr: 'error' });
      } else {
        cb(null, { stdout: 'ok', stderr: '' });
      }
      return {} as any;
    });

    await expect(runPlaywright({
      repo: testDir,
      e2e_dir: 'e2e',
      report_dir: 'reports'
    })).rejects.toThrow();
  });

  it('deve lidar com erro ao executar testes', async () => {
    const { execFile } = await import('node:child_process');
    let callCount = 0;
    
    vi.mocked(execFile).mockImplementation((cmd, args, opts, cb: any) => {
      callCount++;
      if (callCount === 1) {
        // Install success
        cb(null, { stdout: 'ok', stderr: '' });
      } else {
        // Test execution failure
        cb(new Error('Tests failed'), { stdout: '', stderr: 'test error' });
      }
      return {} as any;
    });

    await expect(runPlaywright({
      repo: testDir,
      e2e_dir: 'e2e',
      report_dir: 'reports'
    })).rejects.toThrow();
  });
});

