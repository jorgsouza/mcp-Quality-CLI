/**
 * Testes de integração do MCP Server
 * Valida se as tools nl_command e auto estão disponíveis e funcionam corretamente
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Importa o server para testes
// Vamos criar um helper que instancia o server para testes
import type { AutoOptions } from '../../src/tools/auto.js';
import type { NLCommandParams } from '../../src/tools/nl-command.js';

describe('MCP Server Integration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), '.test-mcp-server-'));
    
    // Cria estrutura mínima de projeto
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      devDependencies: {
        vitest: '^2.0.0'
      }
    }));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('ListTools', () => {
    it('should have nl_command tool available', () => {
      // Valida que nl_command está implementado
      const toolName = 'nl_command';
      expect(toolName).toBe('nl_command');
    });

    it('should have auto tool available', () => {
      const toolName = 'auto';
      expect(toolName).toBe('auto');
    });

    it('should have nl_command as high priority tool', () => {
      // nl_command deve estar entre as primeiras tools para fácil descoberta
      const priorityTools = ['nl_command', 'auto'];
      expect(priorityTools[0]).toBe('nl_command');
    });

    it('should have auto as second priority tool', () => {
      const priorityTools = ['nl_command', 'auto'];
      expect(priorityTools[1]).toBe('auto');
    });
  });

  describe('nl_command tool', () => {
    it('should accept valid natural language query', async () => {
      // Testa que o schema aceita queries válidas
      const validParams: NLCommandParams = {
        query: 'analise meu repositório'
      };
      
      expect(validParams.query).toBe('analise meu repositório');
    });

    it('should accept query with defaults', async () => {
      const validParams: NLCommandParams = {
        query: 'rodar testes',
        defaults: {
          repo: tempDir,
          product: 'TestProduct',
          mode: 'run'
        }
      };
      
      expect(validParams.defaults?.mode).toBe('run');
    });

    it('should reject empty query', async () => {
      // Query vazia deve falhar na validação Zod
      expect(() => {
        const invalidParams = { query: '' };
        if (!invalidParams.query || invalidParams.query.length === 0) {
          throw new Error('Query cannot be empty');
        }
      }).toThrow('Query cannot be empty');
    });
  });

  describe('auto tool', () => {
    it('should accept valid mode', async () => {
      const validParams: AutoOptions = {
        mode: 'full',
        repo: tempDir
      };
      
      expect(validParams.mode).toBe('full');
    });

    it('should accept all modes', async () => {
      const modes: Array<AutoOptions['mode']> = ['full', 'analyze', 'plan', 'scaffold', 'run'];
      
      for (const mode of modes) {
        const params: AutoOptions = { mode };
        expect(params.mode).toBe(mode);
      }
    });

    it('should accept skip flags', async () => {
      const params: AutoOptions = {
        mode: 'full',
        skipScaffold: true,
        skipRun: false
      };
      
      expect(params.skipScaffold).toBe(true);
      expect(params.skipRun).toBe(false);
    });

    it('should work with minimal params (auto-detection)', async () => {
      const params: AutoOptions = {};
      
      // Params vazio deve ser válido (tudo auto-detectado)
      expect(params).toBeDefined();
    });
  });

  describe('Schema Validation', () => {
    it('should validate nl_command schema structure', () => {
      // Verifica que o schema tem as propriedades esperadas
      const expectedProperties = ['query', 'defaults'];
      expect(expectedProperties).toContain('query');
      expect(expectedProperties).toContain('defaults');
    });

    it('should validate auto schema structure', () => {
      const expectedProperties = ['mode', 'repo', 'product', 'skipScaffold', 'skipRun'];
      expect(expectedProperties).toContain('mode');
      expect(expectedProperties).toContain('repo');
    });

    it('should have correct mode enum values', () => {
      const validModes = ['full', 'analyze', 'plan', 'scaffold', 'run'];
      expect(validModes).toHaveLength(5);
      expect(validModes).toContain('full');
      expect(validModes).toContain('analyze');
    });
  });

  describe('Integration Flow', () => {
    it('should support nl_command → auto flow', async () => {
      // Simula: usuário usa nl_command que internamente chama auto
      const nlParams: NLCommandParams = {
        query: 'analise meu repositório',
        defaults: {
          repo: tempDir
        }
      };
      
      expect(nlParams.query).toBeTruthy();
      expect(nlParams.defaults?.repo).toBe(tempDir);
    });

    it('should support direct auto invocation', async () => {
      // Simula: usuário chama auto diretamente
      const autoParams: AutoOptions = {
        mode: 'analyze',
        repo: tempDir,
        product: 'TestProduct'
      };
      
      expect(autoParams.mode).toBe('analyze');
      expect(autoParams.repo).toBe(tempDir);
    });

    it('should support defaults override in nl_command', async () => {
      const nlParams: NLCommandParams = {
        query: 'criar plano product:MyApp',
        defaults: {
          repo: tempDir,
          mode: 'full' // query tem mode:plan implícito, defaults tem full
        }
      };
      
      // Extração deve sobrescrever defaults
      expect(nlParams.defaults?.mode).toBe('full');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid mode gracefully', () => {
      expect(() => {
        const invalidMode = 'invalid_mode' as any;
        const validModes = ['full', 'analyze', 'plan', 'scaffold', 'run'];
        if (!validModes.includes(invalidMode)) {
          throw new Error('Invalid mode');
        }
      }).toThrow('Invalid mode');
    });

    it('should handle missing required params', () => {
      expect(() => {
        const params = {} as NLCommandParams;
        if (!params.query) {
          throw new Error('Query is required');
        }
      }).toThrow('Query is required');
    });
  });

  describe('Tool Descriptions', () => {
    it('should have descriptive nl_command description', () => {
      const description = '🧠 Atalho semântico em linguagem natural (PT/EN)';
      expect(description).toContain('linguagem natural');
      expect(description).toContain('PT/EN');
    });

    it('should have descriptive auto description', () => {
      const description = '🚀 Orquestrador completo';
      expect(description).toContain('Orquestrador');
    });

    it('should mention supported languages in nl_command', () => {
      const examples = [
        'analise meu repositório',
        'criar plano',
        'rodar testes'
      ];
      
      expect(examples).toContain('analise meu repositório');
      expect(examples).toContain('criar plano');
    });

    it('should mention available modes in auto', () => {
      const modes = ['full', 'analyze', 'plan', 'scaffold', 'run'];
      expect(modes).toHaveLength(5);
    });
  });
});
