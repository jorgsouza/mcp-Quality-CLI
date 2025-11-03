import type { LanguageAdapter, TestGenerationOptions, TestScenario } from './base-adapter.js';

export class TypeScriptAdapter implements LanguageAdapter {
  language = 'typescript';
  defaultFramework = 'vitest';
  
  generateUnitTest(functionName: string, filePath: string, options?: TestGenerationOptions): string {
    const framework = options?.framework || this.defaultFramework;
    const scenarios = options?.scenarios || ['happy', 'error', 'edge'];
    const includeComments = options?.includeComments !== false;
    
    const testCases = this.generateScenarios(functionName, scenarios, includeComments);
    
    return `import { describe, it, expect } from '${framework}';
import { ${functionName} } from '${filePath}';

describe('${functionName}', () => {
${testCases.map(tc => tc.code).join('\n\n')}
});
`;
  }
  
  generateIntegrationTest(componentName: string, options?: TestGenerationOptions): string {
    const framework = options?.framework || this.defaultFramework;
    
    return `import { describe, it, expect, beforeEach, afterEach } from '${framework}';
import request from 'supertest';
import { app } from '../src/app.js';

describe('${componentName} Integration Tests', () => {
  beforeEach(async () => {
    // Setup: Inicializar banco de dados de teste, mocks, etc.
  });
  
  afterEach(async () => {
    // Cleanup: Limpar dados de teste
  });
  
  it('should handle successful requests', async () => {
    const response = await request(app)
      .get('/api/${componentName.toLowerCase()}')
      .expect(200);
    
    expect(response.body).toBeDefined();
  });
  
  it('should handle invalid input', async () => {
    const response = await request(app)
      .post('/api/${componentName.toLowerCase()}')
      .send({ invalid: 'data' })
      .expect(400);
    
    expect(response.body.error).toBeDefined();
  });
  
  it('should handle database errors', async () => {
    // Mock database failure
    // Assert error handling
  });
});
`;
  }
  
  generateE2ETest(scenarioName: string, options?: TestGenerationOptions): string {
    return `import { test, expect } from '@playwright/test';

test.describe('${scenarioName}', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Navegar para página inicial
    await page.goto('/');
  });
  
  test('should complete ${scenarioName} flow', async ({ page }) => {
    // 1. Arrange: Preparar estado inicial
    
    // 2. Act: Executar ações do usuário
    
    // 3. Assert: Verificar resultado esperado
    await expect(page).toHaveURL(/success/);
  });
  
  test('should handle errors gracefully', async ({ page }) => {
    // Testar cenário de erro
    
    // Verificar mensagem de erro
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });
});
`;
  }
  
  getTestFileExtension(): string {
    return '.test.ts';
  }
  
  getTestPatterns(): string[] {
    return [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/__tests__/**/*.{ts,tsx,js,jsx}'
    ];
  }
  
  getTestCommand(): string {
    return 'npm test';
  }
  
  getCoverageCommand(): string {
    return 'npm run test:coverage';
  }
  
  getCoverageFile(): string {
    return 'coverage/coverage-summary.json';
  }
  
  private generateScenarios(functionName: string, scenarios: string[], includeComments: boolean): TestScenario[] {
    const result: TestScenario[] = [];
    
    if (scenarios.includes('happy')) {
      result.push({
        name: 'happy path',
        description: 'Testa cenário de sucesso com entradas válidas',
        code: `  it('should work correctly with valid input', () => {
    ${includeComments ? '// Arrange: Preparar dados de entrada válidos\n    ' : ''}const input = {}; // TODO: Definir input válido
    
    ${includeComments ? '// Act: Executar função\n    ' : ''}const result = ${functionName}(input);
    
    ${includeComments ? '// Assert: Verificar resultado esperado\n    ' : ''}expect(result).toBeDefined();
    // TODO: Adicionar assertions específicas
  })`
      });
    }
    
    if (scenarios.includes('error')) {
      result.push({
        name: 'error handling',
        description: 'Testa tratamento de erros',
        code: `  it('should handle errors appropriately', () => {
    ${includeComments ? '// Arrange: Preparar entrada inválida\n    ' : ''}const invalidInput = null;
    
    ${includeComments ? '// Act & Assert: Verificar que erro é lançado\n    ' : ''}expect(() => ${functionName}(invalidInput)).toThrow();
    // TODO: Verificar tipo/mensagem do erro
  })`
      });
    }
    
    if (scenarios.includes('edge')) {
      result.push({
        name: 'edge cases',
        description: 'Testa casos extremos',
        code: `  it('should handle edge cases', () => {
    ${includeComments ? '// Arrange: Preparar casos extremos (empty, null, max, min)\n    ' : ''}const edgeCases = [[], '', 0, -1, Infinity];
    
    ${includeComments ? '// Act & Assert: Verificar comportamento para cada caso\n    ' : ''}edgeCases.forEach(input => {
      const result = ${functionName}(input);
      expect(result).toBeDefined();
      // TODO: Validar comportamento esperado
    });
  })`
      });
    }
    
    return result;
  }
}
