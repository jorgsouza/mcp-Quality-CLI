import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { loadMCPSettings, mergeSettings, createMCPSettingsTemplate, MCPSettings, MCPSettingsSchema } from '../config.js';
import { fileExists } from '../fs.js';

vi.mock('../fs.js', () => ({
  fileExists: vi.fn(),
  readFile: vi.fn(),
  writeFileSafe: vi.fn()
}));

describe('config.ts - loadMCPSettings', () => {
  const mockRepoPath = '/mock/repo';
  const mockProduct = 'TestProduct';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should load settings from /qa/<product>/mcp-settings.json with priority', async () => {
    const mockSettings: MCPSettings = {
      product: 'TestProduct',
      base_url: 'https://example.com',
      domains: ['api', 'auth'],
      critical_flows: ['login', 'checkout'],
      targets: {
        diff_coverage_min: 85,
        flaky_pct_max: 3,
        ci_p95_min: 10
      },
      environments: {
        dev: { url: 'https://dev.example.com' }
      },
      auth: {
        strategy: 'storageState',
        storageStatePath: 'fixtures/auth/state.json'
      }
    };

    vi.mocked(fileExists).mockImplementation(async (path: string) => {
      return path === join(mockRepoPath, 'qa', mockProduct, 'mcp-settings.json');
    });

    const { readFile } = await import('../fs.js');
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSettings));

    const result = await loadMCPSettings(mockRepoPath, mockProduct);

    expect(result).toEqual(mockSettings);
    expect(fileExists).toHaveBeenCalledWith(join(mockRepoPath, 'qa', mockProduct, 'mcp-settings.json'));
  });

  it('should fall back to root mcp-settings.json if product settings not found', async () => {
    const mockSettings: MCPSettings = {
      product: 'RootProduct',
      base_url: 'https://root.example.com',
      domains: [],
      critical_flows: [],
      targets: {
        diff_coverage_min: 80,
        flaky_pct_max: 5,
        ci_p95_min: 10
      },
      environments: {},
      auth: {}
    };

    vi.mocked(fileExists).mockImplementation(async (path: string) => {
      return path === join(mockRepoPath, 'mcp-settings.json');
    });

    const { readFile } = await import('../fs.js');
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockSettings));

    const result = await loadMCPSettings(mockRepoPath, mockProduct);

    expect(result).toEqual(mockSettings);
    expect(fileExists).toHaveBeenCalledWith(join(mockRepoPath, 'mcp-settings.json'));
  });

  it('should return null if no settings file found', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);

    const result = await loadMCPSettings(mockRepoPath, mockProduct);

    expect(result).toBeNull();
  });

  it('should handle invalid JSON and return null', async () => {
    vi.mocked(fileExists).mockResolvedValue(true);
    const { readFile } = await import('../fs.js');
    vi.mocked(readFile).mockResolvedValue('{ invalid json }');

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await loadMCPSettings(mockRepoPath, mockProduct);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should validate settings with Zod schema and reject invalid data', async () => {
    const invalidSettings = {
      product: '', // Invalid: empty string
      base_url: 'not-a-url', // Invalid: not a URL
      targets: {
        diff_coverage_min: 150 // Invalid: > 100
      }
    };

    vi.mocked(fileExists).mockResolvedValue(true);
    const { readFile } = await import('../fs.js');
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidSettings));

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await loadMCPSettings(mockRepoPath, mockProduct);

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should accept minimal valid settings with defaults', async () => {
    const minimalSettings = {
      product: 'MinimalProduct',
      base_url: 'https://minimal.example.com'
    };

    vi.mocked(fileExists).mockResolvedValue(true);
    const { readFile } = await import('../fs.js');
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(minimalSettings));

    const result = await loadMCPSettings(mockRepoPath, mockProduct);

    expect(result).toMatchObject({
      product: 'MinimalProduct',
      base_url: 'https://minimal.example.com',
      domains: [],
      critical_flows: [],
      targets: {
        diff_coverage_min: 80,
        flaky_pct_max: 5,
        ci_p95_min: 10
      },
      environments: {},
      auth: {}
    });
  });
});

describe('config.ts - mergeSettings', () => {
  it('should return params when fileSettings is null', () => {
    const params = { repo: '/test', product: 'Test' };
    const result = mergeSettings(null, params);

    expect(result).toEqual(params);
  });

  it('should merge fileSettings with params, giving precedence to params', () => {
    const fileSettings: MCPSettings = {
      product: 'FileProduct',
      base_url: 'https://file.example.com',
      domains: ['api'],
      critical_flows: ['login'],
      targets: {
        diff_coverage_min: 85,
        flaky_pct_max: 3,
        ci_p95_min: 10
      },
      environments: {},
      auth: {}
    };

    const params = {
      product: 'ParamProduct',
      base_url: 'https://param.example.com'
    };

    const result = mergeSettings(fileSettings, params);

    expect(result.product).toBe('ParamProduct');
    expect(result.base_url).toBe('https://param.example.com');
    expect(result.domains).toEqual(['api']);
    expect(result.targets?.diff_coverage_min).toBe(85);
  });

  it('should deep merge targets object', () => {
    const fileSettings: MCPSettings = {
      product: 'Test',
      base_url: 'https://test.com',
      targets: {
        diff_coverage_min: 85,
        flaky_pct_max: 3,
        ci_p95_min: 10
      },
      domains: [],
      critical_flows: [],
      environments: {},
      auth: {}
    };

    const params = {
      targets: {
        diff_coverage_min: 90
      }
    };

    const result = mergeSettings(fileSettings, params);

    expect(result.targets).toEqual({
      diff_coverage_min: 90,
      flaky_pct_max: 3,
      ci_p95_min: 10
    });
  });
});

describe('config.ts - createMCPSettingsTemplate', () => {
  const mockRepoPath = '/mock/repo';
  const mockProduct = 'NewProduct';
  const mockBaseUrl = 'https://www.example.com';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create directory structure and settings template', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);
    
    const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

    const result = await createMCPSettingsTemplate(mockRepoPath, mockProduct, mockBaseUrl);

    expect(result).toBe(join(mockRepoPath, 'qa', mockProduct, 'mcp-settings.json'));
    
    // Verifica criação de diretórios
    expect(mkdirSpy).toHaveBeenCalledWith(join(mockRepoPath, 'qa', mockProduct), { recursive: true });
    expect(mkdirSpy).toHaveBeenCalledWith(join(mockRepoPath, 'qa', mockProduct, 'tests', 'unit'), { recursive: true });
    expect(mkdirSpy).toHaveBeenCalledWith(join(mockRepoPath, 'qa', mockProduct, 'tests', 'integration'), { recursive: true });
    expect(mkdirSpy).toHaveBeenCalledWith(join(mockRepoPath, 'qa', mockProduct, 'tests', 'e2e'), { recursive: true });
    expect(mkdirSpy).toHaveBeenCalledWith(join(mockRepoPath, 'qa', mockProduct, 'fixtures', 'auth'), { recursive: true });

    // Verifica criação do arquivo
    expect(writeFileSpy).toHaveBeenCalled();
    const writtenContent = JSON.parse(writeFileSpy.mock.calls[0][1] as string);
    expect(writtenContent).toMatchObject({
      product: mockProduct,
      base_url: mockBaseUrl,
      targets: {
        diff_coverage_min: 80,
        flaky_pct_max: 5,
        ci_p95_min: 10
      }
    });
  });

  it('should not overwrite existing settings file', async () => {
    vi.mocked(fileExists).mockResolvedValue(true);
    
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

    await createMCPSettingsTemplate(mockRepoPath, mockProduct, mockBaseUrl);

    expect(writeFileSpy).not.toHaveBeenCalled();
  });

  it('should use generic localhost environments (agnóstico)', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);
    
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

    await createMCPSettingsTemplate(mockRepoPath, mockProduct, 'https://www.example.com');

    const writtenContent = JSON.parse(writeFileSpy.mock.calls[0][1] as string);
    // Agora usa localhost genérico independente do base_url
    expect(writtenContent.environments).toEqual({
      dev: { url: 'http://localhost:3000' },
      stg: { url: 'http://localhost:3001' },
      prod: { url: 'http://localhost:3002' }
    });
  });
});

describe('config.ts - MCPSettingsSchema validation', () => {
  it('should validate correct schema', () => {
    const validSettings = {
      product: 'ValidProduct',
      base_url: 'https://valid.example.com',
      domains: ['api', 'auth'],
      critical_flows: ['login'],
      targets: {
        diff_coverage_min: 80,
        flaky_pct_max: 5,
        ci_p95_min: 10
      },
      environments: {
        dev: { url: 'https://dev.example.com' }
      },
      auth: {
        strategy: 'storageState' as const,
        storageStatePath: 'path/to/state.json'
      }
    };

    const result = MCPSettingsSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
  });

  it('should reject invalid product name (empty)', () => {
    const invalidSettings = {
      product: '',
      base_url: 'https://example.com'
    };

    const result = MCPSettingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });

  it('should reject invalid base_url', () => {
    const invalidSettings = {
      product: 'Product',
      base_url: 'not-a-url'
    };

    const result = MCPSettingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });

  it('should reject diff_coverage_min out of range', () => {
    const invalidSettings = {
      product: 'Product',
      base_url: 'https://example.com',
      targets: {
        diff_coverage_min: 150
      }
    };

    const result = MCPSettingsSchema.safeParse(invalidSettings);
    expect(result.success).toBe(false);
  });

  it('should apply default values for optional fields', () => {
    const minimalSettings = {
      product: 'Minimal',
      base_url: 'https://minimal.com'
    };

    const result = MCPSettingsSchema.parse(minimalSettings);
    expect(result.domains).toEqual([]);
    expect(result.critical_flows).toEqual([]);
    expect(result.targets).toEqual({
      diff_coverage_min: 80,
      flaky_pct_max: 5,
      ci_p95_min: 10
    });
    expect(result.environments).toEqual({});
    expect(result.auth).toEqual({});
  });
});

describe('config.ts - inferProductFromPackageJson', () => {
  const mockRepoPath = '/mock/repo';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should infer product name from package.json', async () => {
    const { inferProductFromPackageJson } = await import('../config.js');
    
    vi.mocked(fileExists).mockImplementation(async (path: string) => {
      return path === join(mockRepoPath, 'package.json');
    });

    const { readFile } = await import('../fs.js');
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      name: '@company/my-awesome-product',
      version: '1.0.0'
    }));

    const result = await inferProductFromPackageJson(mockRepoPath);
    expect(result).toBe('company-my-awesome-product'); // sanitized: @ e / removidos, - mantido
  });

  it('should return null when package.json not found', async () => {
    const { inferProductFromPackageJson } = await import('../config.js');
    
    vi.mocked(fileExists).mockResolvedValue(false);

    const result = await inferProductFromPackageJson(mockRepoPath);
    expect(result).toBe('repo'); // fallback to dirname
  });

  it('should handle invalid package.json gracefully', async () => {
    const { inferProductFromPackageJson } = await import('../config.js');
    
    vi.mocked(fileExists).mockResolvedValue(true);

    const { readFile } = await import('../fs.js');
    vi.mocked(readFile).mockResolvedValue('invalid json {{{');

    const result = await inferProductFromPackageJson(mockRepoPath);
    expect(result).toBe('repo'); // fallback to dirname
  });
});

describe('config.ts - createMCPSettingsTemplate (agnóstico)', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Criar diretório temporário para cada teste (usar path ABSOLUTO)
    const relativeTempDir = '.test-temp-config-' + Date.now();
    tempDir = join(process.cwd(), relativeTempDir);
    await fs.mkdir(tempDir, { recursive: true });
    
    // IMPORTANTE: Importar as implementações reais de fs.js usando vi.importActual
    const realFs = await vi.importActual<typeof import('../fs.js')>('../fs.js');
    
    // Resetar mocks
    vi.restoreAllMocks();
    
    // Mockar com as implementações reais (passthrough)
    vi.mocked(fileExists).mockImplementation(realFs.fileExists);
    const { readFile: readFileFn } = await import('../fs.js');
    vi.mocked(readFileFn).mockImplementation(realFs.readFile);
    const { writeFileSafe } = await import('../fs.js');
    vi.mocked(writeFileSafe).mockImplementation(realFs.writeFileSafe);
  });

  afterEach(async () => {
    // Limpar diretório temporário
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should create generic template with localhost defaults', async () => {
    const { createMCPSettingsTemplate } = await import('../config.js');
    
    const settingsPath = await createMCPSettingsTemplate(tempDir, 'TestProduct');

    // Verificar que arquivo foi criado
    const exists = await fs.access(settingsPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    // Ler e validar conteúdo
    const content = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    expect(content.product).toBe('TestProduct');
    expect(content.base_url).toBe('http://localhost:3000');
    expect(content.domains).toEqual([]);
    expect(content.critical_flows).toEqual([]);
    expect(content.targets.diff_coverage_min).toBe(80);
    expect(content.environments.dev.url).toBe('http://localhost:3000');
  });

  it('should create mcp-settings.example.json automatically', async () => {
    const { createMCPSettingsTemplate } = await import('../config.js');
    
    await createMCPSettingsTemplate(tempDir, 'TestProduct');

    // Verificar que exemplo foi criado
    const examplePath = join(tempDir, 'qa', 'TestProduct', 'mcp-settings.example.json');
    const exists = await fs.access(examplePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    // Ler e validar conteúdo do exemplo
    const content = JSON.parse(await fs.readFile(examplePath, 'utf-8'));
    expect(content.product).toBe('MyProduct');
    expect(content.domains).toContain('billing');
    expect(content.critical_flows).toContain('login');
  });

  it('should infer product from package.json when not provided', async () => {
    const { createMCPSettingsTemplate } = await import('../config.js');
    
    // IMPORTANTE: Criar package.json ANTES de chamar createMCPSettingsTemplate
    const pkgContent = { name: 'my-cool-app', version: '1.0.0' };
    await fs.writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify(pkgContent, null, 2),
      'utf-8'
    );

    // Agora chamar sem passar produto explicitamente
    const settingsPath = await createMCPSettingsTemplate(tempDir);

    // Verificar que produto foi inferido do package.json
    const content = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    expect(content.product).toBe('my-cool-app');
  });
});
