import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { detectLanguage, getTestFileExtension, getTestTemplate, LanguageDetection } from '../language';

// Mock do filesystem
vi.mock('node:fs', () => ({
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn(),
  }
}));

describe('detectLanguage', () => {
  const mockFs = fs as any;
  let testDir: string;

  beforeEach(() => {
    testDir = '/tmp/test-project';
    vi.clearAllMocks();
    // Mock console.log e console.warn para não poluir output dos testes
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('TypeScript/JavaScript Detection', () => {
    it('deve detectar TypeScript com Vitest', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['package.json', 'src']);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        devDependencies: {
          vitest: '^0.34.0',
          typescript: '^5.0.0'
        }
      }));

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('typescript');
      expect(result.framework).toBe('vitest');
      expect(result.testCommand).toBe('npm test');
      expect(result.coverageCommand).toBe('npm run test:coverage');
      expect(result.coverageFile).toBe('coverage/coverage-summary.json');
      expect(result.testPatterns).toEqual([
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        '**/__tests__/**/*.{ts,tsx,js,jsx}'
      ]);
    });

    it('deve detectar TypeScript com Jest', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['package.json', 'jest.config.js']);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        devDependencies: {
          jest: '^29.0.0',
          '@types/jest': '^29.0.0'
        }
      }));

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('typescript');
      expect(result.framework).toBe('jest');
      expect(result.testCommand).toBe('npm test');
      expect(result.coverageCommand).toBe('npm test -- --coverage');
    });

    it('deve detectar JavaScript puro (sem TypeScript)', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['package.json']);
      mockFs.readFile.mockResolvedValue(JSON.stringify({
        devDependencies: {
          jest: '^29.0.0'
        }
        // Sem typescript nas deps
      }));

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('typescript'); // Ainda retorna typescript como padrão
      expect(result.framework).toBe('jest');
    });
  });

  describe('Go Detection', () => {
    it('deve detectar Go com go.mod', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['go.mod', 'main.go']);
      mockFs.readFile.mockResolvedValue('module example.com/myapp\n\ngo 1.21');

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('go');
      expect(result.framework).toBe('go-test');
      expect(result.testCommand).toBe('go test ./...');
      expect(result.coverageCommand).toBe('go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out');
      expect(result.coverageFile).toBe('coverage.out');
      expect(result.testPatterns).toEqual(['**/*_test.go']);
      expect(result.sourcePatterns).toEqual(['**/*.go']);
    });

    it('deve detectar Go com testify framework', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['go.mod', 'go.sum']);
      mockFs.readFile.mockResolvedValue(`module example.com/myapp

go 1.21

require (
    github.com/stretchr/testify v1.8.4
)`);

      // Execute  
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('go');
      expect(result.framework).toBe('go-test');
    });
  });

  describe('Java Detection', () => {
    it('deve detectar Java com Maven (pom.xml)', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['pom.xml', 'src']);
      mockFs.readFile.mockResolvedValue(`<?xml version="1.0"?>
<project>
  <dependencies>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
    </dependency>
  </dependencies>
</project>`);

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('java');
      expect(result.framework).toBe('junit');
      expect(result.testCommand).toBe('mvn test');
      expect(result.coverageCommand).toBe('mvn clean test jacoco:report');
      expect(result.testPatterns).toEqual([
        '**/src/test/**/*Test.java',
        '**/src/test/**/*Tests.java'
      ]);
    });

    it('deve detectar Java com Gradle (build.gradle)', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['build.gradle', 'src']);
      mockFs.readFile.mockResolvedValue(`dependencies {
    testImplementation 'org.junit.jupiter:junit-jupiter:5.8.2'
}`);

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('java');
      expect(result.framework).toBe('junit');
      expect(result.testCommand).toBe('./gradlew test');
      expect(result.coverageCommand).toBe('./gradlew test jacocoTestReport');
    });
  });

  describe('Python Detection', () => {
    it('deve detectar Python com requirements.txt e pytest', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['requirements.txt', 'setup.py']);
      mockFs.readFile.mockResolvedValue(`pytest==7.0.0
requests==2.28.0`);

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('python');
      expect(result.framework).toBe('pytest');
      expect(result.testCommand).toBe('pytest');
      expect(result.coverageCommand).toBe('pytest --cov=. --cov-report=json');
      expect(result.testPatterns).toEqual([
        '**/test_*.py',
        '**/*_test.py',
        '**/tests/**/*.py'
      ]);
    });

    it('deve detectar Python com pyproject.toml', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['pyproject.toml']);
      mockFs.readFile.mockResolvedValue(`[tool.poetry]
name = "myapp"

[tool.poetry.dependencies]
python = "^3.9"
pytest = "^7.0"`);

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('python');
      expect(result.framework).toBe('pytest');
    });
  });

  describe('Ruby Detection', () => {
    it('deve detectar Ruby com Gemfile e RSpec', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['Gemfile', 'Rakefile']);
      mockFs.readFile.mockResolvedValue(`gem 'rspec', '~> 3.11'
gem 'rails', '~> 7.0'`);

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('ruby');
      expect(result.framework).toBe('rspec');
      expect(result.testCommand).toBe('bundle exec rspec');
      expect(result.coverageCommand).toBe('bundle exec rspec');
      expect(result.testPatterns).toEqual([
        '**/spec/**/*_spec.rb'
      ]);
    });
  });

  describe('C# Detection', () => {
    it('deve detectar C# com arquivo .csproj', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['MyApp.csproj', 'Program.cs']);
      mockFs.readFile.mockResolvedValue(`<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="xunit" Version="2.4.2" />
  </ItemGroup>
</Project>`);

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('csharp');
      expect(result.framework).toBe('nunit');
      expect(result.testCommand).toBe('dotnet test');
    });
  });

  describe('Fallback e Edge Cases', () => {
    it('deve usar fallback para TypeScript quando não detecta linguagem', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['README.md', 'index.html']);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('typescript');
      expect(result.framework).toBe('vitest');
      expect(console.warn).toHaveBeenCalledWith('⚠️  Linguagem não detectada automaticamente.');
    });

    it('deve lidar com erro de leitura de diretório', async () => {
      // Setup
      mockFs.readdir.mockRejectedValue(new Error('Permission denied'));

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('typescript');
      expect(result.framework).toBe('vitest');
    });

    it('deve lidar com package.json inválido', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['package.json']);
      mockFs.readFile.mockResolvedValue('invalid json content');

      // Execute & Verify
      await expect(detectLanguage(testDir)).rejects.toThrow();
    });

    it('deve lidar com arquivos vazios', async () => {
      // Setup
      mockFs.readdir.mockResolvedValue(['package.json']);
      mockFs.readFile.mockResolvedValue('{}'); // JSON vazio

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('typescript');
      expect(result.framework).toBe('vitest'); // Fallback
    });
  });

  describe('Projetos Multi-linguagem', () => {
    it('deve priorizar Go quando tem go.mod e package.json', async () => {
      // Setup: Go.mod é verificado antes de package.json
      mockFs.readdir.mockResolvedValue(['go.mod', 'package.json', 'main.go']);
      // Quando go.mod for lido, retorna conteúdo válido
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('go.mod')) {
          return Promise.resolve('module example.com/myapp\n\ngo 1.21');
        }
        return Promise.resolve('{}'); // package.json não será processado
      });

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('go');
      expect(result.framework).toBe('go-test');
    });

    it('deve priorizar Java quando tem pom.xml e package.json', async () => {
      // Setup: pom.xml é verificado antes de package.json
      mockFs.readdir.mockResolvedValue(['pom.xml', 'package.json']);
      // Quando pom.xml for lido, retorna conteúdo válido
      mockFs.readFile.mockImplementation((path: string) => {
        if (path.includes('pom.xml')) {
          return Promise.resolve('<project><dependencies></dependencies></project>');
        }
        return Promise.resolve('{}'); // package.json não será processado
      });

      // Execute
      const result = await detectLanguage(testDir);

      // Verify
      expect(result.primary).toBe('java');
      expect(result.framework).toBe('junit');
    });
  });
});

describe('getTestFileExtension', () => {
  it('deve retornar extensão correta para cada linguagem', () => {
    expect(getTestFileExtension('typescript')).toBe('.test.ts');
    expect(getTestFileExtension('javascript')).toBe('.test.ts');
    expect(getTestFileExtension('java')).toBe('Test.java');
    expect(getTestFileExtension('go')).toBe('_test.go');
    expect(getTestFileExtension('ruby')).toBe('_spec.rb');
    expect(getTestFileExtension('python')).toBe('_test.py');
    expect(getTestFileExtension('csharp')).toBe('Tests.cs');
    expect(getTestFileExtension('php')).toBe('Test.php');
    expect(getTestFileExtension('rust')).toBe('_test.rs');
  });

  it('deve usar fallback .test.ts para linguagens desconhecidas', () => {
    expect(getTestFileExtension('unknown')).toBe('.test.ts');
    expect(getTestFileExtension('')).toBe('.test.ts');
    expect(getTestFileExtension('kotlin')).toBe('.test.ts');
  });
});

describe('getTestTemplate', () => {
  it('deve gerar template TypeScript/JavaScript correto', () => {
    const template = getTestTemplate('typescript', 'myFunction', './myModule');
    
    expect(template).toContain("import { describe, it, expect } from 'vitest'");
    expect(template).toContain("import { myFunction } from './myModule'");
    expect(template).toContain("describe('myFunction', () => {");
    expect(template).toContain('should work correctly');
    expect(template).toContain('should handle edge cases');
    expect(template).toContain('should handle errors');
  });

  it('deve gerar template para diferentes linguagens', () => {
    // TypeScript
    const tsTemplate = getTestTemplate('typescript', 'parseData', '../parser');
    expect(tsTemplate).toContain('vitest');
    expect(tsTemplate).toContain('parseData');
    expect(tsTemplate).toContain('../parser');

    // JavaScript
    const jsTemplate = getTestTemplate('javascript', 'helper', './utils');
    expect(jsTemplate).toContain('vitest');
    expect(jsTemplate).toContain('helper');
  });

  it('deve funcionar com nomes de função complexos', () => {
    const template = getTestTemplate('typescript', 'calculateTotalPrice', '../business/pricing');
    
    expect(template).toContain('calculateTotalPrice');
    expect(template).toContain('../business/pricing');
    expect(template).toContain("describe('calculateTotalPrice'");
  });

  it('deve funcionar com caminhos relativos diferentes', () => {
    const template = getTestTemplate('typescript', 'validator', '../../shared/validation');
    
    expect(template).toContain('../../shared/validation');
  });
});
