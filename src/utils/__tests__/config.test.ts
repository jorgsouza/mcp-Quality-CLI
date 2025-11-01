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
        ci_p95_min: 8
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
        ci_p95_min: 8
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
        ci_p95_min: 8
      }
    });
  });

  it('should not overwrite existing settings file', async () => {
    vi.mocked(fileExists).mockResolvedValue(true);
    
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

    await createMCPSettingsTemplate(mockRepoPath, mockProduct, mockBaseUrl);

    expect(writeFileSpy).not.toHaveBeenCalled();
  });

  it('should generate correct environment URLs from base_url', async () => {
    vi.mocked(fileExists).mockResolvedValue(false);
    
    vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

    await createMCPSettingsTemplate(mockRepoPath, mockProduct, 'https://www.example.com');

    const writtenContent = JSON.parse(writeFileSpy.mock.calls[0][1] as string);
    expect(writtenContent.environments).toEqual({
      dev: { url: 'https://dev.example.com' },
      stg: { url: 'https://stg.example.com' },
      prod: { url: 'https://www.example.com' }
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
        ci_p95_min: 8
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
      ci_p95_min: 8
    });
    expect(result.environments).toEqual({});
    expect(result.auth).toEqual({});
  });
});
