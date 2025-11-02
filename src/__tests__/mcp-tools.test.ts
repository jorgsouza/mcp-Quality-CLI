/**
 * 🧪 Testes do MCP Tools Manifest
 */

import { describe, it, expect } from 'vitest';
import { MCP_TOOLS, findTool } from '../mcp-tools.manifest.js';

describe('MCP Tools Manifest', () => {
  it('deve ter exatamente 5 tools consolidados', () => {
    expect(MCP_TOOLS).toHaveLength(5);
  });

  it('tools devem ter propriedades obrigatórias', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      
      expect(typeof tool.name).toBe('string');
      expect(typeof tool.description).toBe('string');
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('deve conter todos os 5 tools esperados', () => {
    const expected = ['analyze', 'validate', 'report', 'scaffold', 'self_check'];
    const names = MCP_TOOLS.map(t => t.name);
    
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });

  it('findTool deve encontrar tool por nome', () => {
    const tool = findTool('analyze');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('analyze');
  });

  it('findTool deve retornar undefined para tool inexistente', () => {
    const tool = findTool('tool-inexistente');
    expect(tool).toBeUndefined();
  });

  it('tool analyze deve ter campos repo e product obrigatórios', () => {
    const tool = findTool('analyze')!;
    expect(tool.inputSchema.required).toContain('repo');
    expect(tool.inputSchema.required).toContain('product');
  });

  it('tool validate deve ter campos de threshold', () => {
    const tool = findTool('validate')!;
    const props = tool.inputSchema.properties;
    
    expect(props).toHaveProperty('minBranch');
    expect(props).toHaveProperty('minMutation');
    expect(props).toHaveProperty('minDiffCoverage');
  });

  it('tool scaffold deve ter campo type com enum', () => {
    const tool = findTool('scaffold')!;
    const typeField = tool.inputSchema.properties.type;
    
    expect(typeField.enum).toEqual(['unit', 'integration', 'e2e']);
  });

  it('todos os tools devem ter description com emoji', () => {
    for (const tool of MCP_TOOLS) {
      // Emojis são caracteres multi-byte
      expect(tool.description.length).toBeGreaterThan(10);
      // Deve começar com emoji (caractere especial)
      expect(tool.description.charCodeAt(0)).toBeGreaterThan(255);
    }
  });
});
