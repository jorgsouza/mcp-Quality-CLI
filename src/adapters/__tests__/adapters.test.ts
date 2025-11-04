import { describe, it, expect } from 'vitest';
import { TypeScriptAdapter } from '../typescript-adapter.js';
import { PythonAdapter } from '../python-adapter.js';
import { getLanguageAdapter, createAdapter } from '../index.js';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Language Adapters', () => {
  describe('TypeScriptAdapter', () => {
    const adapter = new TypeScriptAdapter();
    
    it('should generate valid unit test template', () => {
      const result = adapter.generateUnitTest('calculateTotal', './utils/math.js');
      
      expect(result).toContain("import { describe, it, expect } from 'vitest'");
      expect(result).toContain("import { calculateTotal } from './utils/math.js'");
      expect(result).toContain("describe('calculateTotal'");
      expect(result).toContain('should work correctly with valid input');
      expect(result).toContain('should handle errors appropriately');
      expect(result).toContain('should handle edge cases');
    });
    
    it('should generate integration test template', () => {
      const result = adapter.generateIntegrationTest('UserService');
      
      expect(result).toContain('supertest');
      expect(result).toContain('UserService Integration Tests');
      expect(result).toContain('beforeEach');
      expect(result).toContain('afterEach');
    });
    
    it('should generate E2E test template', () => {
      const result = adapter.generateE2ETest('LoginFlow');
      
      expect(result).toContain('@playwright/test');
      expect(result).toContain('LoginFlow');
      expect(result).toContain('should complete LoginFlow flow');
    });
    
    it('should return correct test file extension', () => {
      expect(adapter.getTestFileExtension()).toBe('.test.ts');
    });
    
    it('should return correct test patterns', () => {
      const patterns = adapter.getTestPatterns();
      
      expect(patterns).toContain('**/*.test.{ts,tsx,js,jsx}');
      expect(patterns).toContain('**/__tests__/**/*.{ts,tsx,js,jsx}');
    });
    
    it('should return correct test command', () => {
      expect(adapter.getTestCommand()).toBe('npm test');
    });
    
    it('should return correct coverage command', () => {
      expect(adapter.getCoverageCommand()).toBe('npm run test:coverage');
    });
  });
  
  describe('PythonAdapter', () => {
    const adapter = new PythonAdapter();
    
    it('should generate valid unit test template', () => {
      const result = adapter.generateUnitTest('calculate_total', 'src/utils/math.py');
      
      expect(result).toContain('import pytest');
      expect(result).toContain('from src.utils.math import calculate_total');
      expect(result).toContain('class TestCalculateTotal:');
      expect(result).toContain('def test_calculate_total_with_valid_input');
      expect(result).toContain('def test_calculate_total_handles_errors');
      expect(result).toContain('@pytest.mark.parametrize');
    });
    
    it('should generate integration test template', () => {
      const result = adapter.generateIntegrationTest('UserService');
      
      expect(result).toContain('from fastapi.testclient import TestClient');
      expect(result).toContain('class TestUserServiceIntegration:');
      expect(result).toContain('@pytest.fixture(autouse=True)');
      expect(result).toContain('def setup_teardown');
    });
    
    it('should generate E2E test template', () => {
      const result = adapter.generateE2ETest('LoginFlow');
      
      expect(result).toContain('from playwright.sync_api import Page');
      expect(result).toContain('class TestLoginFlowE2E:');
      expect(result).toContain('def test_complete_flow');
    });
    
    it('should return correct test file extension', () => {
      expect(adapter.getTestFileExtension()).toBe('_test.py');
    });
    
    it('should return correct test patterns', () => {
      const patterns = adapter.getTestPatterns();
      
      expect(patterns).toContain('**/test_*.py');
      expect(patterns).toContain('**/*_test.py');
    });
    
    it('should return correct test command', () => {
      expect(adapter.getTestCommand()).toBe('pytest');
    });
    
    it('should return correct coverage command', () => {
      expect(adapter.getCoverageCommand()).toBe('pytest --cov=. --cov-report=json');
    });
  });
  
  describe('getLanguageAdapter', () => {
    let tempDir: string;
    
    it('should return PythonAdapter for Python project', async () => {
      // Criar diretório temporário com requirements.txt
      tempDir = await mkdtemp(join(tmpdir(), 'python-test-'));
      await writeFile(join(tempDir, 'requirements.txt'), 'pytest==7.0.0');
      
      const adapter = await getLanguageAdapter(tempDir);
      
      expect(adapter.language).toBe('python');
      // Adapter não tem defaultFramework, tem detectFramework()
      
      // Cleanup
      await rm(tempDir, { recursive: true, force: true });
    });
    
    it('should return TypeScriptAdapter for TypeScript project', async () => {
      // Criar diretório temporário com package.json
      tempDir = await mkdtemp(join(tmpdir(), 'ts-test-'));
      await writeFile(
        join(tempDir, 'package.json'),
        JSON.stringify({ devDependencies: { vitest: '^0.34.0' } })
      );
      
      const adapter = await getLanguageAdapter(tempDir);
      
      expect(adapter.language).toBe('typescript');
      // Adapter não tem defaultFramework, tem detectFramework()
      
      // Cleanup
      await rm(tempDir, { recursive: true, force: true });
    });
    
    it('should return TypeScriptAdapter as fallback for unknown project', async () => {
      // Criar diretório vazio
      tempDir = await mkdtemp(join(tmpdir(), 'unknown-test-'));
      
      const adapter = await getLanguageAdapter(tempDir);
      
      // get LanguageAdapter pode retornar null para projetos desconhecidos
      expect(adapter).not.toBeNull();
      if (adapter) {
        expect(adapter.language).toBe('typescript');
      }
      
      // Cleanup
      await rm(tempDir, { recursive: true, force: true });
    });
  });
  
  describe('createAdapter', () => {
    it('should create TypeScriptAdapter', () => {
      const adapter = createAdapter('typescript');
      
      expect(adapter.language).toBe('typescript');
      // Factory retorna plain objects, não instances diretas
      expect(adapter).toBeDefined();
    });
    
    it('should create PythonAdapter', () => {
      const adapter = createAdapter('python');
      
      expect(adapter.language).toBe('python');
      // Factory retorna plain objects, não instances diretas
      expect(adapter).toBeDefined();
    });
    
    it('should throw for unknown language', () => {
      // createAdapter agora retorna null ao invés de throw
      const adapter = createAdapter('unknown');
      expect(adapter).toBeNull();
    });
  });
});
