import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPaths, ensurePaths, isWithinQARoot, getOutputPath, getRelativePath } from '../paths.js';
import type { QAPaths } from '../paths.js';
import type { MCPSettings } from '../config.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('getPaths', () => {
  it('deve gerar paths padrão para qa/<product>', () => {
    const paths = getPaths('/repo', 'my-app');
    
    expect(paths.root).toBe('/repo/qa/my-app');
    expect(paths.analyses).toBe('/repo/qa/my-app/tests/analyses');
    expect(paths.reports).toBe('/repo/qa/my-app/tests/reports');
    expect(paths.playwrightReports).toBe('/repo/qa/my-app/tests/reports/playwright');
    expect(paths.unit).toBe('/repo/qa/my-app/tests/unit');
    expect(paths.integration).toBe('/repo/qa/my-app/tests/integration');
    expect(paths.e2e).toBe('/repo/qa/my-app/tests/e2e');
    expect(paths.fixtures).toBe('/repo/qa/my-app/fixtures');
    expect(paths.fixturesAuth).toBe('/repo/qa/my-app/fixtures/auth');
    expect(paths.dashboards).toBe('/repo/qa/my-app/dashboards');
    expect(paths.patches).toBe('/repo/qa/my-app/patches');
  });

  it('deve respeitar output_root customizado via settings', () => {
    const settings: Partial<MCPSettings> = {
      paths: {
        output_root: 'custom/qa-output'
      }
    } as MCPSettings;
    
    const paths = getPaths('/repo', 'my-app', settings as MCPSettings);
    
    expect(paths.root).toBe('/repo/custom/qa-output');
    expect(paths.analyses).toBe('/repo/custom/qa-output/tests/analyses');
    expect(paths.reports).toBe('/repo/custom/qa-output/tests/reports');
  });

  it('deve funcionar com paths absolutos Windows-style', () => {
    const paths = getPaths('C:\\Users\\dev\\repo', 'my-app');
    
    expect(paths.root).toContain('my-app');
    expect(paths.analyses).toContain('tests');
  });

  it('deve sanitizar corretamente nomes de produto com caracteres especiais', () => {
    const paths1 = getPaths('/repo', '@scope/package');
    const paths2 = getPaths('/repo', 'my_app-v2');
    
    expect(paths1.root).toBe('/repo/qa/@scope/package');
    expect(paths2.root).toBe('/repo/qa/my_app-v2');
  });
});

describe('ensurePaths', () => {
  let tempDir: string;
  let paths: QAPaths;

  beforeEach(async () => {
    // Cria diretório temporário único para cada teste
    tempDir = join(tmpdir(), `mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await fs.mkdir(tempDir, { recursive: true });
    paths = getPaths(tempDir, 'test-product');
  });

  afterEach(async () => {
    // Limpa diretório temporário
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignora erros de cleanup (Windows pode falhar às vezes)
    }
  });

  it('deve criar todos os diretórios da estrutura', async () => {
    await ensurePaths(paths);
    
    // Verifica se todos os diretórios existem
    const dirsToCheck = [
      paths.root,
      paths.analyses,
      paths.reports,
      paths.playwrightReports,
      paths.unit,
      paths.integration,
      paths.e2e,
      paths.fixtures,
      paths.fixturesAuth,
      paths.dashboards,
      paths.patches
    ];

    for (const dir of dirsToCheck) {
      const stats = await fs.stat(dir);
      expect(stats.isDirectory()).toBe(true);
    }
  });

  it('deve ser idempotente (não falhar se diretórios já existem)', async () => {
    // Cria estrutura
    await ensurePaths(paths);
    
    // Tenta criar novamente - não deve falhar
    await expect(ensurePaths(paths)).resolves.not.toThrow();
  });

  it('deve criar estrutura mesmo se diretório pai não existir', async () => {
    const deepPaths = getPaths(join(tempDir, 'deep', 'nested', 'path'), 'product');
    
    await ensurePaths(deepPaths);
    
    const stats = await fs.stat(deepPaths.root);
    expect(stats.isDirectory()).toBe(true);
  });
});

describe('isWithinQARoot', () => {
  const paths = getPaths('/repo', 'my-app');

  it('deve retornar true para paths dentro de qa/<product>', () => {
    expect(isWithinQARoot('/repo/qa/my-app/tests/unit/foo.test.ts', paths)).toBe(true);
    expect(isWithinQARoot('/repo/qa/my-app/tests/analyses/analyze.json', paths)).toBe(true);
    expect(isWithinQARoot('/repo/qa/my-app/dashboards/dashboard.html', paths)).toBe(true);
  });

  it('deve retornar false para paths fora de qa/<product>', () => {
    expect(isWithinQARoot('/repo/src/index.ts', paths)).toBe(false);
    expect(isWithinQARoot('/repo/tests/unit/foo.test.ts', paths)).toBe(false);
    expect(isWithinQARoot('/other/repo/qa/my-app/foo.ts', paths)).toBe(false);
  });

  it('deve normalizar separadores de path (Windows vs Unix)', () => {
    const windowsPath = 'C:\\repo\\qa\\my-app\\tests\\unit\\foo.test.ts';
    const unixPath = '/repo/qa/my-app/tests/unit/foo.test.ts';
    
    const windowsPaths = getPaths('C:\\repo', 'my-app');
    const unixPaths = getPaths('/repo', 'my-app');
    
    expect(isWithinQARoot(windowsPath, windowsPaths)).toBe(true);
    expect(isWithinQARoot(unixPath, unixPaths)).toBe(true);
  });
});

describe('getOutputPath', () => {
  const paths = getPaths('/repo', 'my-app');

  it('deve mapear JSON para analyses/', () => {
    expect(getOutputPath('analyze.json', paths)).toBe('/repo/qa/my-app/tests/analyses/analyze.json');
    expect(getOutputPath('coverage-analysis.json', paths)).toBe('/repo/qa/my-app/tests/analyses/coverage-analysis.json');
    expect(getOutputPath('TEST-QUALITY-LOGICAL.json', paths)).toBe('/repo/qa/my-app/tests/analyses/TEST-QUALITY-LOGICAL.json');
  });

  it('deve mapear MD e HTML para reports/', () => {
    expect(getOutputPath('PLAN.md', paths)).toBe('/repo/qa/my-app/tests/reports/PLAN.md');
    expect(getOutputPath('QUALITY-REPORT.md', paths)).toBe('/repo/qa/my-app/tests/reports/QUALITY-REPORT.md');
    expect(getOutputPath('PYRAMID.html', paths)).toBe('/repo/qa/my-app/tests/reports/PYRAMID.html');
  });

  it('deve mapear dashboard.html para dashboards/', () => {
    expect(getOutputPath('dashboard.html', paths)).toBe('/repo/qa/my-app/dashboards/dashboard.html');
    expect(getOutputPath('Dashboard.html', paths)).toBe('/repo/qa/my-app/dashboards/Dashboard.html');
  });

  it('deve mapear .patch para patches/', () => {
    expect(getOutputPath('fix-weak-assertions.patch', paths)).toBe('/repo/qa/my-app/patches/fix-weak-assertions.patch');
  });

  it('deve usar root como fallback para tipos desconhecidos', () => {
    expect(getOutputPath('unknown.txt', paths)).toBe('/repo/qa/my-app/unknown.txt');
    expect(getOutputPath('package.json', paths)).toBe('/repo/qa/my-app/package.json');
  });

  it('deve ser case-insensitive para extensões', () => {
    expect(getOutputPath('REPORT.MD', paths)).toBe('/repo/qa/my-app/tests/reports/REPORT.MD');
    expect(getOutputPath('Data.JSON', paths)).toBe('/repo/qa/my-app/tests/analyses/Data.JSON');
  });
});

describe('getRelativePath', () => {
  const paths = getPaths('/repo', 'my-app');

  it('deve retornar path relativo ao root do QA', () => {
    expect(getRelativePath('/repo/qa/my-app/tests/reports/PLAN.md', paths))
      .toBe('tests/reports/PLAN.md');
    
    expect(getRelativePath('/repo/qa/my-app/tests/analyses/analyze.json', paths))
      .toBe('tests/analyses/analyze.json');
    
    expect(getRelativePath('/repo/qa/my-app/dashboards/dashboard.html', paths))
      .toBe('dashboards/dashboard.html');
  });

  it('deve retornar path original se não estiver dentro do root', () => {
    const outsidePath = '/repo/src/index.ts';
    expect(getRelativePath(outsidePath, paths)).toBe(outsidePath);
  });

  it('deve normalizar separadores de path', () => {
    const windowsPath = 'C:\\repo\\qa\\my-app\\tests\\unit\\foo.test.ts';
    const windowsPaths = getPaths('C:\\repo', 'my-app');
    
    const relative = getRelativePath(windowsPath, windowsPaths);
    expect(relative).toBe('tests/unit/foo.test.ts');
  });
});

describe('QAPaths interface compliance', () => {
  it('deve ter todas as propriedades necessárias', () => {
    const paths = getPaths('/repo', 'my-app');
    
    // Verifica que todas as propriedades existem e são strings
    const requiredProps: (keyof QAPaths)[] = [
      'root',
      'analyses',
      'reports',
      'playwrightReports',
      'unit',
      'integration',
      'e2e',
      'fixtures',
      'fixturesAuth',
      'dashboards',
      'patches'
    ];

    for (const prop of requiredProps) {
      expect(paths).toHaveProperty(prop);
      expect(typeof paths[prop]).toBe('string');
      expect(paths[prop].length).toBeGreaterThan(0);
    }
  });

  it('deve ter paths únicos (sem duplicatas)', () => {
    const paths = getPaths('/repo', 'my-app');
    
    const allPaths = Object.values(paths);
    const uniquePaths = new Set(allPaths);
    
    expect(uniquePaths.size).toBe(allPaths.length);
  });
});

describe('Edge cases e validações', () => {
  it('deve lidar com product name vazio ou inválido', () => {
    // getPaths deve aceitar qualquer string como product
    const paths1 = getPaths('/repo', '');
    const paths2 = getPaths('/repo', ' ');
    
    // Com product vazio, cria qa/ ou qa/ 
    expect(paths1.root).toContain('/repo/qa');
    expect(paths2.root).toContain('/repo/qa');
    
    // Estrutura de subdiretorios ainda deve existir
    expect(paths1.analyses).toContain('tests/analyses');
    expect(paths2.analyses).toContain('tests/analyses');
  });

  it('deve lidar com repo path com espaços', () => {
    const paths = getPaths('/Users/my folder/repo', 'my-app');
    
    expect(paths.root).toBe('/Users/my folder/repo/qa/my-app');
    expect(paths.analyses).toContain('/Users/my folder/repo/qa/my-app/tests/analyses');
  });

  it('deve preservar case do product name', () => {
    const paths = getPaths('/repo', 'MyApp-V2');
    
    expect(paths.root).toBe('/repo/qa/MyApp-V2');
  });

  it('deve funcionar com settings undefined', () => {
    const paths = getPaths('/repo', 'my-app', undefined);
    
    expect(paths.root).toBe('/repo/qa/my-app');
  });

  it('deve funcionar com settings.paths undefined', () => {
    const settings = { product: 'test' } as any;
    const paths = getPaths('/repo', 'my-app', settings);
    
    expect(paths.root).toBe('/repo/qa/my-app');
  });
});
