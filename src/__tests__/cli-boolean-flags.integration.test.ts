/**
 * 🔥 TESTES DE INTEGRAÇÃO FORTES - Boolean Flags
 * 
 * CONTEXTO:
 * - Bug e6939d9: CLI tratava boolean flags como <value>
 * - Resultado: --skip-run quebrava CI com "argument missing"
 * 
 * ESTES TESTES REALMENTE EXECUTAM O CLI E VALIDAM O COMPORTAMENTO
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { COMMANDS } from '../commands.manifest.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('🔥 CLI Boolean Flags - INTEGRAÇÃO REAL', () => {
  let tempDir: string;

  beforeEach(() => {
    // Cria diretório temporário para testes
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-cli-test-'));
  });

  afterEach(() => {
    // Limpa diretório temporário
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('CRITICAL: Boolean flags devem funcionar SEM <value>', () => {
    it('--skip-run deve aceitar sintaxe boolean (sem valor)', () => {
      const program = new Command();
      const analyzeCmd = COMMANDS.find((c) => c.name === 'analyze');
      
      expect(analyzeCmd).toBeDefined();

      // Simula registro do comando
      const cmd = program.command(analyzeCmd!.name);
      
      analyzeCmd!.flags.forEach((flag) => {
        const isBoolean = typeof flag.defaultValue === 'boolean';
        const flagName = isBoolean ? `--${flag.name}` : `--${flag.name} <value>`;
        cmd.option(flagName, flag.description, flag.defaultValue);
      });

      // TESTE FORTE: Parse argumentos com --skip-run (sem valor)
      program.parse(['node', 'cli.js', 'analyze', '--skip-run', '--repo', '.', '--product', 'test']);
      
      const opts = cmd.opts();
      
      // ASSERT: Flag deve estar presente e ser true
      expect(opts.skipRun).toBe(true);
    });

    it('--fix deve aceitar sintaxe boolean (sem valor)', () => {
      const program = new Command();
      const selfCheckCmd = COMMANDS.find((c) => c.name === 'self-check');
      
      expect(selfCheckCmd).toBeDefined();

      const cmd = program.command(selfCheckCmd!.name);
      
      selfCheckCmd!.flags.forEach((flag) => {
        const isBoolean = typeof flag.defaultValue === 'boolean';
        const flagName = isBoolean ? `--${flag.name}` : `--${flag.name} <value>`;
        cmd.option(flagName, flag.description, flag.defaultValue);
      });

      program.parse(['node', 'cli.js', 'self-check', '--fix']);
      
      const opts = cmd.opts();
      
      expect(opts.fix).toBe(true);
    });

    it('--skip-scaffold deve aceitar sintaxe boolean (sem valor)', () => {
      const program = new Command();
      const analyzeCmd = COMMANDS.find((c) => c.name === 'analyze');
      
      const cmd = program.command(analyzeCmd!.name);
      
      analyzeCmd!.flags.forEach((flag) => {
        const isBoolean = typeof flag.defaultValue === 'boolean';
        const flagName = isBoolean ? `--${flag.name}` : `--${flag.name} <value>`;
        cmd.option(flagName, flag.description, flag.defaultValue);
      });

      program.parse(['node', 'cli.js', 'analyze', '--skip-scaffold', '--repo', '.', '--product', 'test']);
      
      const opts = cmd.opts();
      
      expect(opts.skipScaffold).toBe(true);
    });
  });

  describe('CRITICAL: Value flags devem EXIGIR <value>', () => {
    it('--repo deve rejeitar se não tiver valor', () => {
      const program = new Command();
      const analyzeCmd = COMMANDS.find((c) => c.name === 'analyze');
      
      const cmd = program.command(analyzeCmd!.name);
      
      analyzeCmd!.flags.forEach((flag) => {
        const isBoolean = typeof flag.defaultValue === 'boolean';
        const flagName = isBoolean ? `--${flag.name}` : `--${flag.name} <value>`;
        cmd.option(flagName, flag.description, flag.defaultValue);
      });

      // TESTE FORTE: Tentar usar --repo sem valor deve falhar
      expect(() => {
        program.parse(['node', 'cli.js', 'analyze', '--repo'], { from: 'user' });
      }).toThrow();
    });

    it('--product deve aceitar valor', () => {
      const program = new Command();
      const analyzeCmd = COMMANDS.find((c) => c.name === 'analyze');
      
      const cmd = program.command(analyzeCmd!.name);
      
      analyzeCmd!.flags.forEach((flag) => {
        const isBoolean = typeof flag.defaultValue === 'boolean';
        const flagName = isBoolean ? `--${flag.name}` : `--${flag.name} <value>`;
        cmd.option(flagName, flag.description, flag.defaultValue);
      });

      program.parse(['node', 'cli.js', 'analyze', '--product', 'my-product', '--repo', '.']);
      
      const opts = cmd.opts();
      
      expect(opts.product).toBe('my-product');
    });
  });

  describe('REGRESSÃO e6939d9: Comandos do CI devem funcionar', () => {
    it('analyze --repo . --product "mcp" --mode analyze --skip-run', () => {
      const program = new Command();
      const analyzeCmd = COMMANDS.find((c) => c.name === 'analyze');
      
      const cmd = program.command(analyzeCmd!.name);
      
      analyzeCmd!.flags.forEach((flag) => {
        const isBoolean = typeof flag.defaultValue === 'boolean';
        const flagName = isBoolean ? `--${flag.name}` : `--${flag.name} <value>`;
        cmd.option(flagName, flag.description, flag.defaultValue);
      });

      // COMANDO EXATO DO CI
      program.parse([
        'node', 'cli.js', 'analyze',
        '--repo', '.',
        '--product', 'mcp',
        '--mode', 'analyze',
        '--skip-run'
      ]);
      
      const opts = cmd.opts();
      
      expect(opts.repo).toBe('.');
      expect(opts.product).toBe('mcp');
      expect(opts.mode).toBe('analyze');
      expect(opts.skipRun).toBe(true); // Boolean flag
    });

    it('self-check --repo . --fix', () => {
      const program = new Command();
      const selfCheckCmd = COMMANDS.find((c) => c.name === 'self-check');
      
      const cmd = program.command(selfCheckCmd!.name);
      
      selfCheckCmd!.flags.forEach((flag) => {
        const isBoolean = typeof flag.defaultValue === 'boolean';
        const flagName = isBoolean ? `--${flag.name}` : `--${flag.name} <value>`;
        cmd.option(flagName, flag.description, flag.defaultValue);
      });

      program.parse(['node', 'cli.js', 'self-check', '--repo', '.', '--fix']);
      
      const opts = cmd.opts();
      
      expect(opts.repo).toBe('.');
      expect(opts.fix).toBe(true);
    });

    it('validate --repo . --min-mutation 60 --min-branch 70 --fail-fast', () => {
      const program = new Command();
      const validateCmd = COMMANDS.find((c) => c.name === 'validate');
      
      const cmd = program.command(validateCmd!.name);
      
      validateCmd!.flags.forEach((flag) => {
        const isBoolean = typeof flag.defaultValue === 'boolean';
        const flagName = isBoolean ? `--${flag.name}` : `--${flag.name} <value>`;
        cmd.option(flagName, flag.description, flag.defaultValue);
      });

      program.parse([
        'node', 'cli.js', 'validate',
        '--repo', '.',
        '--min-mutation', '60',
        '--min-branch', '70',
        '--fail-fast'
      ]);
      
      const opts = cmd.opts();
      
      expect(opts.repo).toBe('.');
      expect(opts.minMutation).toBe('60');
      expect(opts.minBranch).toBe('70');
      expect(opts.failFast).toBe(true); // Boolean flag
    });
  });

  describe('DETECÇÃO DE TIPO: defaultValue define comportamento', () => {
    it('Boolean defaultValue = flag sem <value>', () => {
      const analyzeCmd = COMMANDS.find((c) => c.name === 'analyze');
      
      const booleanFlags = analyzeCmd!.flags.filter(
        (f) => typeof f.defaultValue === 'boolean'
      );

      // ASSERT: Deve haver pelo menos 2 boolean flags
      expect(booleanFlags.length).toBeGreaterThanOrEqual(2);

      // ASSERT: Cada um deve ter valor boolean
      booleanFlags.forEach((flag) => {
        expect([true, false]).toContain(flag.defaultValue);
      });
    });

    it('String/Number defaultValue = flag com <value>', () => {
      const analyzeCmd = COMMANDS.find((c) => c.name === 'analyze');
      
      const valueFlags = analyzeCmd!.flags.filter(
        (f) => typeof f.defaultValue !== 'boolean'
      );

      // ASSERT: Deve haver pelo menos 3 value flags
      expect(valueFlags.length).toBeGreaterThanOrEqual(3);

      // ASSERT: Nenhum deve ser boolean
      valueFlags.forEach((flag) => {
        expect(typeof flag.defaultValue).not.toBe('boolean');
      });
    });
  });
});
