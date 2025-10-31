import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { recommendTestStrategy } from '../recommend-strategy.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('recommendTestStrategy', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `recommend-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 1. Detectar CLI tool
  it('deve detectar isCLI=true se tem commander', async () => {
    await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
      name: 'cli-app',
      dependencies: {
        'commander': '^12.0.0'
      }
    }));

    const result = await recommendTestStrategy({
      repo: testDir,
      product: 'CLI App',
      auto_generate: true
    });

    expect(result.ok).toBe(true);
    expect(result.recommendation?.appType).toContain('CLI');
    
    // CLI deve recomendar 90% unit
    expect(result.recommendation?.strategy.unit).toContain('90');
  });

  // 2. Detectar MCP Server
  it('deve detectar isMCPServer=true se tem @modelcontextprotocol/sdk', async () => {
    await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
      name: 'mcp-server',
      dependencies: {
        '@modelcontextprotocol/sdk': '^0.0.10'
      }
    }));

    const result = await recommendTestStrategy({
      repo: testDir,
      product: 'MCP Server',
      auto_generate: true
    });

    expect(result.ok).toBe(true);
    expect(result.recommendation?.appType).toContain('MCP');
    
    // MCP deve recomendar 90% unit, 0% E2E
    expect(result.recommendation?.strategy.unit).toContain('90');
    expect(result.recommendation?.strategy.e2e).toContain('0');
  });

  // 3. Detectar Web UI
  it('deve detectar hasWebUI=true se tem react/next', async () => {
    await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
      name: 'web-app',
      dependencies: {
        'react': '^18.0.0',
        'next': '^14.0.0'
      }
    }));

    const result = await recommendTestStrategy({
      repo: testDir,
      product: 'Web App',
      auto_generate: true
    });

    expect(result.ok).toBe(true);
    expect(result.recommendation?.appType).toContain('Web');
    
    // Web app deve ter E2E > 0%
    const e2ePct = parseInt(result.recommendation?.strategy.e2e || '0');
    expect(e2ePct).toBeGreaterThan(0);
  });

  // 4. Calcular complexidade
  it('deve calcular complexity baseado em features', async () => {
    // App complexo: React + Express + Prisma + Passport + Kafka
    await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
      name: 'complex-app',
      dependencies: {
        'react': '^18.0.0',
        'express': '^4.0.0',
        'prisma': '^5.0.0',
        'passport': '^0.6.0',
        'kafkajs': '^2.0.0'
      }
    }));

    const result = await recommendTestStrategy({
      repo: testDir,
      product: 'Complex App',
      auto_generate: true
    });

    expect(result.ok).toBe(true);
    expect(result.recommendation?.complexity).toBe('high');
  });

  // 5. CLI Tool → 90/10/0
  it('deve recomendar 90% unit para CLI tools', async () => {
    await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
      name: 'cli-tool',
      bin: {
        'mycli': './bin/cli.js'
      },
      dependencies: {
        'commander': '^12.0.0'
      }
    }));

    const result = await recommendTestStrategy({
      repo: testDir,
      product: 'CLI Tool',
      auto_generate: true
    });

    expect(result.ok).toBe(true);
    
    // Deve recomendar 90/10/0
    expect(result.recommendation?.strategy.unit).toContain('90');
    expect(result.recommendation?.strategy.integration).toContain('10');
    expect(result.recommendation?.strategy.e2e).toContain('0');
    
    // Deve ter justificativa
    expect(result.recommendation?.reasoning).toBeDefined();
    expect(result.recommendation?.reasoning.length).toBeGreaterThan(0);
  });

  // 6. Web App → 60/25/15
  it('deve recomendar 60/25/15 para web apps complexos', async () => {
    // Web app complexo
    await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
      name: 'web-app',
      dependencies: {
        'react': '^18.0.0',
        'next': '^14.0.0',
        'express': '^4.0.0',
        'prisma': '^5.0.0',
        'passport': '^0.6.0'
      }
    }));

    const result = await recommendTestStrategy({
      repo: testDir,
      product: 'Web App',
      auto_generate: true
    });

    expect(result.ok).toBe(true);
    expect(result.recommendation?.complexity).toBe('high');
    
    // Web app complexo deve ter proporções balanceadas
    const unitPct = parseInt(result.recommendation?.strategy.unit || '0');
    const integrationPct = parseInt(result.recommendation?.strategy.integration || '0');
    const e2ePct = parseInt(result.recommendation?.strategy.e2e || '0');
    
    expect(unitPct).toBeGreaterThanOrEqual(50);
    expect(unitPct).toBeLessThanOrEqual(70);
    expect(integrationPct).toBeGreaterThanOrEqual(20);
    expect(e2ePct).toBeGreaterThanOrEqual(10);
  });

  // Teste adicional: arquivo já existe
  it('deve detectar se documento já existe', async () => {
    await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
      name: 'test-app',
      dependencies: { 'commander': '^12.0.0' }
    }));

    // Primeira chamada - cria documento
    const result1 = await recommendTestStrategy({
      repo: testDir,
      product: 'Test',
      auto_generate: true
    });

    expect(result1.ok).toBe(true);
    expect(result1.file).toBeDefined();

    // Segunda chamada - detecta que já existe
    const result2 = await recommendTestStrategy({
      repo: testDir,
      product: 'Test',
      auto_generate: false
    });

    expect(result2.ok).toBe(true);
    expect(result2.exists).toBe(true);
  });

  // Teste adicional: prioridades de arquivos
  it('deve identificar arquivos prioritários', async () => {
    await fs.writeFile(join(testDir, 'package.json'), JSON.stringify({
      name: 'test-app'
    }));

    // Criar arquivos fonte
    await fs.mkdir(join(testDir, 'src/detectors'), { recursive: true });
    await fs.mkdir(join(testDir, 'src/utils'), { recursive: true });
    await fs.writeFile(join(testDir, 'src/detectors/parser.ts'), 'export function parse() {}');
    await fs.writeFile(join(testDir, 'src/utils/helper.ts'), 'export function help() {}');

    const result = await recommendTestStrategy({
      repo: testDir,
      product: 'Test',
      auto_generate: true
    });

    expect(result.ok).toBe(true);
    expect(result.recommendation?.priorities).toBeDefined();
    expect(result.recommendation?.priorities.length).toBeGreaterThan(0);
    
    // Arquivos com 'parser' devem ter prioridade HIGH
    const parserFile = result.recommendation?.priorities.find(p => p.file.includes('parser'));
    if (parserFile) {
      expect(parserFile.priority).toBe('HIGH');
    }
  });
});

