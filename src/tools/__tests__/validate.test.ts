/**
 * 🧪 Testes para validate.ts - Mutation Score Gates
 * 
 * ⚠️ IMPORTANTE: Estes testes NÃO executam Stryker real!
 * Usam fixtures estáticas de JSON para testar a lógica de validação.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validate, type ValidateOptions, type ValidationResult } from '../validate.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('validate.ts - Mutation Score Gates', () => {
  let testDir: string;

  beforeEach(() => {
    // Cria diretório temporário para cada teste
    testDir = mkdtempSync(join(tmpdir(), 'validate-test-'));
  });

  afterEach(() => {
    // Limpa diretório temporário
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignora erros de cleanup
    }
  });

  it('deve PASSAR quando mutation score >= threshold', async () => {
    // Arrange: Cria relatório com 80% de mutation score
    const mutationReport = {
      files: [
        {
          source: 'src/utils/parse.ts',
          mutants: [
            { id: '1', status: 'Killed', mutatorName: 'ConditionalExpression' },
            { id: '2', status: 'Killed', mutatorName: 'EqualityOperator' },
            { id: '3', status: 'Killed', mutatorName: 'ArithmeticOperator' },
            { id: '4', status: 'Killed', mutatorName: 'BlockStatement' },
            { id: '5', status: 'Survived', mutatorName: 'StringLiteral', originalString: 'hello', mutatedString: 'world' },
          ],
        },
      ],
    };

    mkdirSync(join(testDir, 'reports', 'mutation'), { recursive: true });
    writeFileSync(
      join(testDir, 'reports', 'mutation', 'mutation.json'),
      JSON.stringify(mutationReport)
    );

    const options: ValidateOptions = {
      repo: testDir,
      minMutation: 70,  // 80% >= 70% → PASSA
    };

    // Act
    const result = await validate(options);

    // Assert
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('deve FALHAR quando mutation score < threshold', async () => {
    // Arrange: Cria relatório com 40% de mutation score
    const mutationReport = {
      files: [
        {
          source: 'src/utils/weak.ts',
          mutants: [
            { id: '1', status: 'Killed', mutatorName: 'ConditionalExpression' },
            { id: '2', status: 'Killed', mutatorName: 'EqualityOperator' },
            { id: '3', status: 'Survived', mutatorName: 'ArithmeticOperator', originalString: '+', mutatedString: '-', location: { start: { line: 10 } } },
            { id: '4', status: 'Survived', mutatorName: 'BlockStatement', originalString: '{}', mutatedString: '', location: { start: { line: 15 } } },
            { id: '5', status: 'Survived', mutatorName: 'StringLiteral', originalString: 'test', mutatedString: '', location: { start: { line: 20 } } },
          ],
        },
      ],
    };

    mkdirSync(join(testDir, 'reports', 'mutation'), { recursive: true });
    writeFileSync(
      join(testDir, 'reports', 'mutation', 'mutation.json'),
      JSON.stringify(mutationReport)
    );

    const options: ValidateOptions = {
      repo: testDir,
      minMutation: 70,  // 40% < 70% → FALHA
    };

    // Act
    const result = await validate(options);

    // Assert
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].gate).toBe('Mutation Score');
    expect(result.violations[0].threshold).toBe(70);
    expect(result.violations[0].actual).toBe(40);
    expect(result.violations[0].suggestions).toContain('📊 Mutation Score: 40% (threshold: 70%)');
  });

  it('deve retornar sugestões de correção para mutantes sobreviventes', async () => {
    // Arrange: Relatório com mutantes sobreviventes
    const mutationReport = {
      files: [
        {
          source: 'src/critical.ts',
          mutants: [
            { 
              id: '1', 
              status: 'Survived', 
              mutatorName: 'ConditionalExpression',
              originalString: 'x > 0',
              mutatedString: 'false',
              location: { start: { line: 42 } }
            },
          ],
        },
      ],
    };

    mkdirSync(join(testDir, 'reports', 'mutation'), { recursive: true });
    writeFileSync(
      join(testDir, 'reports', 'mutation', 'mutation.json'),
      JSON.stringify(mutationReport)
    );

    const options: ValidateOptions = {
      repo: testDir,
      minMutation: 50,
    };

    // Act
    const result = await validate(options);

    // Assert
    expect(result.passed).toBe(false);
    expect(result.violations[0].suggestions).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ConditionalExpression'),
        expect.stringContaining('x > 0'),
        expect.stringContaining('false'),
      ])
    );
  });

  it('deve FALHAR quando relatório de mutação não existe', async () => {
    // Arrange: Nenhum relatório criado
    const options: ValidateOptions = {
      repo: testDir,
      minMutation: 70,
    };

    // Act
    const result = await validate(options);

    // Assert
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toContain('Nenhum relatório de mutação encontrado');
    expect(result.violations[0].suggestions).toContain('1. Instale Stryker: npm install --save-dev @stryker-mutator/core @stryker-mutator/vitest-runner');
  });

  it('deve lidar com relatório JSON malformado', async () => {
    // Arrange: Cria JSON inválido
    mkdirSync(join(testDir, 'reports', 'mutation'), { recursive: true });
    writeFileSync(
      join(testDir, 'reports', 'mutation', 'mutation.json'),
      '{ invalid json'
    );

    const options: ValidateOptions = {
      repo: testDir,
      minMutation: 70,
    };

    // Act
    const result = await validate(options);

    // Assert
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].message).toContain('Erro ao ler relatório de mutação');
  });

  it('deve ignorar minMutation se não fornecido', async () => {
    // Arrange: Sem mutation report, mas sem threshold também
    const options: ValidateOptions = {
      repo: testDir,
      // minMutation não fornecido
    };

    // Act
    const result = await validate(options);

    // Assert: Passa porque não há gates configurados
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});

// Helper function para criar diretórios (polyfill para Node < 16.7)
function mkdirSync(path: string, options: { recursive: boolean }) {
  const { mkdirSync: mkdirSyncNative } = require('node:fs');
  return mkdirSyncNative(path, options);
}
