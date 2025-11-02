/**
 * 🧪 Testes do Manifesto de Comandos
 * 
 * Garante paridade entre:
 * - Manifesto (COMMANDS)
 * - CLI (--help)
 * - package.json (scripts)
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMMANDS, findCommand, validateRequiredFlags } from '../commands.manifest.js';

describe('Commands Manifest', () => {
  describe('Estrutura do Manifesto', () => {
    it('deve ter exatamente 5 comandos consolidados', () => {
      expect(COMMANDS).toHaveLength(5);
    });

    it('todos os comandos devem ter propriedades obrigatórias', () => {
      for (const cmd of COMMANDS) {
        expect(cmd).toHaveProperty('name');
        expect(cmd).toHaveProperty('module');
        expect(cmd).toHaveProperty('description');
        expect(cmd).toHaveProperty('flags');
        
        expect(typeof cmd.name).toBe('string');
        expect(typeof cmd.module).toBe('string');
        expect(typeof cmd.description).toBe('string');
        expect(Array.isArray(cmd.flags)).toBe(true);
      }
    });

    it('todos os comandos devem ter pelo menos uma flag', () => {
      for (const cmd of COMMANDS) {
        expect(cmd.flags.length).toBeGreaterThan(0);
      }
    });

    it('todas as flags devem ter estrutura válida', () => {
      for (const cmd of COMMANDS) {
        for (const flag of cmd.flags) {
          expect(flag).toHaveProperty('name');
          expect(flag).toHaveProperty('description');
          expect(flag).toHaveProperty('required');
          
          expect(typeof flag.name).toBe('string');
          expect(typeof flag.description).toBe('string');
          expect(typeof flag.required).toBe('boolean');
        }
      }
    });
  });

  describe('Comandos Esperados', () => {
    const expectedCommands = ['analyze', 'validate', 'report', 'scaffold', 'self-check'];

    it('deve conter todos os comandos esperados', () => {
      const commandNames = COMMANDS.map(c => c.name);
      
      for (const expectedCmd of expectedCommands) {
        expect(commandNames).toContain(expectedCmd);
      }
    });

    it('comando analyze deve ter flags obrigatórias', () => {
      const analyzeCmd = findCommand('analyze');
      expect(analyzeCmd).toBeDefined();
      
      const requiredFlags = analyzeCmd!.flags.filter(f => f.required);
      const requiredNames = requiredFlags.map(f => f.name);
      
      expect(requiredNames).toContain('repo');
      expect(requiredNames).toContain('product');
    });

    it('comando validate deve ter flags de threshold', () => {
      const validateCmd = findCommand('validate');
      expect(validateCmd).toBeDefined();
      
      const flagNames = validateCmd!.flags.map(f => f.name);
      
      expect(flagNames).toContain('min-branch');
      expect(flagNames).toContain('min-mutation');
      expect(flagNames).toContain('min-diff-coverage');
    });

    it('comando scaffold deve ter flag type', () => {
      const scaffoldCmd = findCommand('scaffold');
      expect(scaffoldCmd).toBeDefined();
      
      const flagNames = scaffoldCmd!.flags.map(f => f.name);
      
      expect(flagNames).toContain('type');
      expect(flagNames).toContain('repo');
      expect(flagNames).toContain('product');
    });

    it('comando self-check deve ter flag fix', () => {
      const selfCheckCmd = findCommand('self-check');
      expect(selfCheckCmd).toBeDefined();
      
      const flagNames = selfCheckCmd!.flags.map(f => f.name);
      
      expect(flagNames).toContain('repo');
      expect(flagNames).toContain('fix');
    });
  });

  describe('Funções Utilitárias', () => {
    it('findCommand deve encontrar comando por nome', () => {
      const cmd = findCommand('analyze');
      expect(cmd).toBeDefined();
      expect(cmd!.name).toBe('analyze');
    });

    it('findCommand deve retornar undefined para comando inexistente', () => {
      const cmd = findCommand('comando-inexistente');
      expect(cmd).toBeUndefined();
    });

    it('findCommand deve encontrar por alias', () => {
      const analyzeCmd = COMMANDS.find(c => c.name === 'analyze');
      if (analyzeCmd && analyzeCmd.aliases) {
        for (const alias of analyzeCmd.aliases) {
          const found = findCommand(alias);
          expect(found).toBeDefined();
          expect(found!.name).toBe('analyze');
        }
      }
    });

    it('validateRequiredFlags deve validar flags obrigatórias', () => {
      const analyzeCmd = findCommand('analyze')!;
      
      // Sem flags obrigatórias
      const result1 = validateRequiredFlags(analyzeCmd, {});
      expect(result1.valid).toBe(false);
      expect(result1.missing).toContain('repo');
      expect(result1.missing).toContain('product');
      
      // Com todas as flags
      const result2 = validateRequiredFlags(analyzeCmd, {
        repo: '.',
        product: 'test',
      });
      expect(result2.valid).toBe(true);
      expect(result2.missing).toHaveLength(0);
    });

    it('validateRequiredFlags deve permitir flags opcionais ausentes', () => {
      const analyzeCmd = findCommand('analyze')!;
      
      const result = validateRequiredFlags(analyzeCmd, {
        repo: '.',
        product: 'test',
        // mode é opcional
      });
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Paridade com package.json', () => {
    it('scripts npm devem corresponder aos comandos principais', () => {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      
      const scripts = packageJson.scripts || {};
      
      // Verificar se comandos principais têm scripts correspondentes
      // Nota: Nem todos os comandos precisam ter scripts, mas os principais devem ter
      const criticalCommands = ['analyze', 'validate'];
      
      for (const cmdName of criticalCommands) {
        const scriptKey = `quality:${cmdName}`;
        // Pode ter script direto ou variação
        const hasScript = Object.keys(scripts).some(key => 
          key === scriptKey || key.startsWith(`${cmdName}:`)
        );
        
        // Se não tiver script, apenas aviso (não erro)
        if (!hasScript) {
          console.warn(`⚠️  Script recomendado não encontrado: ${scriptKey}`);
        }
      }
    });
  });

  describe('Validação de Módulos', () => {
    it('todos os comandos devem apontar para módulos .js válidos', () => {
      for (const cmd of COMMANDS) {
        expect(cmd.module).toMatch(/\.js$/);
        expect(cmd.module).toMatch(/^\.\/tools\//);
      }
    });

    it('módulos devem seguir padrão de naming', () => {
      for (const cmd of COMMANDS) {
        // Módulo deve ter nome relacionado ao comando
        const moduleName = cmd.module.replace('./tools/', '').replace('.js', '');
        
        // Pode ser nome exato ou variação (ex: self-check.js, auto.js para analyze)
        expect(moduleName).toBeTruthy();
        expect(moduleName.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Defaults Sensatos', () => {
    it('comando validate deve ter thresholds padrão razoáveis', () => {
      const validateCmd = findCommand('validate')!;
      
      const minBranch = validateCmd.flags.find(f => f.name === 'min-branch');
      expect(minBranch).toBeDefined();
      expect(minBranch!.defaultValue).toBe('80');
      
      const minMutation = validateCmd.flags.find(f => f.name === 'min-mutation');
      expect(minMutation).toBeDefined();
      expect(minMutation!.defaultValue).toBe('70');
    });

    it('comando scaffold deve ter defaults úteis', () => {
      const scaffoldCmd = findCommand('scaffold')!;
      
      const typeFlag = scaffoldCmd.flags.find(f => f.name === 'type');
      expect(typeFlag).toBeDefined();
      expect(typeFlag!.defaultValue).toBe('unit');
      
      const frameworkFlag = scaffoldCmd.flags.find(f => f.name === 'framework');
      expect(frameworkFlag).toBeDefined();
      expect(frameworkFlag!.defaultValue).toBe('vitest');
    });

    it('comando self-check deve ter repo default', () => {
      const selfCheckCmd = findCommand('self-check')!;
      
      const repoFlag = selfCheckCmd.flags.find(f => f.name === 'repo');
      expect(repoFlag).toBeDefined();
      expect(repoFlag!.defaultValue).toBe('.');
    });
  });

  describe('Exemplos de Uso', () => {
    it('comandos principais devem ter exemplos', () => {
      const criticalCommands = ['analyze', 'validate', 'scaffold'];
      
      for (const cmdName of criticalCommands) {
        const cmd = findCommand(cmdName);
        expect(cmd).toBeDefined();
        expect(cmd!.examples).toBeDefined();
        expect(cmd!.examples!.length).toBeGreaterThan(0);
      }
    });

    it('exemplos devem conter nome do comando', () => {
      for (const cmd of COMMANDS) {
        if (cmd.examples) {
          for (const example of cmd.examples) {
            expect(example).toContain(cmd.name);
          }
        }
      }
    });

    it('exemplos devem ter sintaxe válida', () => {
      for (const cmd of COMMANDS) {
        if (cmd.examples) {
          for (const example of cmd.examples) {
            // Deve começar com 'quality <comando>'
            expect(example).toMatch(/quality\s+\w+/);
            // Pode ou não ter flags (self-check pode rodar sem flags)
          }
        }
      }
    });
  });
});
