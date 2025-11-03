import { promises as fs } from 'node:fs';
import { join } from 'node:path';

/**
 * Verifica se um diretório contém arquivos com determinada extensão
 */
async function checkDirectory(dirPath: string, extension: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(extension)) {
        return true;
      }
      
      // Busca recursiva em subdiretórios (mas não muito fundo - max 2 níveis)
      if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.includes('node_modules')) {
        const subDirPath = join(dirPath, entry.name);
        const hasFiles = await checkDirectory(subDirPath, extension).catch(() => false);
        if (hasFiles) return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

export interface LanguageDetection {
  primary: string; // 'typescript' | 'javascript' | 'java' | 'go' | 'ruby' | 'python' | 'csharp' | 'php'
  framework?: string; // 'vitest' | 'jest' | 'junit' | 'go-test' | 'rspec' | 'pytest' | 'nunit' | 'phpunit'
  testCommand: string;
  coverageCommand: string;
  coverageFile: string; // Caminho relativo do arquivo de cobertura
  testPatterns: string[]; // Padrões de arquivos de teste
  sourcePatterns: string[]; // Padrões de arquivos fonte
}

export async function detectLanguage(repoPath: string): Promise<LanguageDetection> {
  console.log('🔍 Detectando linguagem e framework de teste...');

  // Verificar arquivos de configuração
  const files: string[] = await fs.readdir(repoPath).catch(() => []);
  
  // [FIX] Python - VERIFICAR PRIMEIRO (antes de package.json)
  // Mesmo sem requirements.txt, se há .py files, é Python
  if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('pyproject.toml')) {
    console.log('✅ Detectado: Python com pytest (via arquivos de config)');
    return {
      primary: 'python',
      framework: 'pytest',
      testCommand: 'pytest',
      coverageCommand: 'pytest --cov=. --cov-report=json',
      coverageFile: 'coverage.json',
      testPatterns: ['**/test_*.py', '**/*_test.py', '**/tests/**/*.py'],
      sourcePatterns: ['**/*.py']
    };
  }
  
  // [FIX] Python - Detectar por extensão .py (sem arquivos de config)
  const hasPythonFiles = files.some(f => f.endsWith('.py')) || 
                          files.includes('src') && await checkDirectory(join(repoPath, 'src'), '.py');
  
  if (hasPythonFiles) {
    console.log('✅ Detectado: Python com pytest (via arquivos .py)');
    return {
      primary: 'python',
      framework: 'pytest',
      testCommand: 'pytest',
      coverageCommand: 'pytest --cov=. --cov-report=json',
      coverageFile: 'coverage.json',
      testPatterns: ['**/test_*.py', '**/*_test.py', '**/tests/**/*.py'],
      sourcePatterns: ['**/*.py']
    };
  }
  
  // TypeScript/JavaScript
  if (files.includes('package.json')) {
    const packageJson = JSON.parse(
      await fs.readFile(join(repoPath, 'package.json'), 'utf-8')
    );
    
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Vitest
    if (deps.vitest) {
      console.log('✅ Detectado: TypeScript/JavaScript com Vitest');
      return {
        primary: 'typescript',
        framework: 'vitest',
        testCommand: 'npm test',
        coverageCommand: 'npm run test:coverage',
        coverageFile: 'coverage/coverage-summary.json',
        testPatterns: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}', '**/__tests__/**/*.{ts,tsx,js,jsx}'],
        sourcePatterns: ['src/**/*.{ts,tsx,js,jsx}', 'lib/**/*.{ts,tsx,js,jsx}']
      };
    }

    // Jest
    if (deps.jest || files.includes('jest.config.js') || files.includes('jest.config.ts')) {
      console.log('✅ Detectado: TypeScript/JavaScript com Jest');
      return {
        primary: 'typescript',
        framework: 'jest',
        testCommand: 'npm test',
        coverageCommand: 'npm test -- --coverage',
        coverageFile: 'coverage/coverage-summary.json',
        testPatterns: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}', '**/__tests__/**/*.{ts,tsx,js,jsx}'],
        sourcePatterns: ['src/**/*.{ts,tsx,js,jsx}', 'lib/**/*.{ts,tsx,js,jsx}']
      };
    }

    // Mocha
    if (deps.mocha) {
      console.log('✅ Detectado: TypeScript/JavaScript com Mocha');
      return {
        primary: 'typescript',
        framework: 'mocha',
        testCommand: 'npm test',
        coverageCommand: 'npx nyc npm test',
        coverageFile: 'coverage/coverage-summary.json',
        testPatterns: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}', '**/test/**/*.{ts,tsx,js,jsx}'],
        sourcePatterns: ['src/**/*.{ts,tsx,js,jsx}', 'lib/**/*.{ts,tsx,js,jsx}']
      };
    }
  }

  // Java
  if (files.includes('pom.xml')) {
    console.log('✅ Detectado: Java com Maven (JUnit)');
    return {
      primary: 'java',
      framework: 'junit',
      testCommand: 'mvn test',
      coverageCommand: 'mvn clean test jacoco:report',
      coverageFile: 'target/site/jacoco/jacoco.xml',
      testPatterns: ['**/src/test/**/*Test.java', '**/src/test/**/*Tests.java'],
      sourcePatterns: ['**/src/main/**/*.java']
    };
  }

  if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
    console.log('✅ Detectado: Java/Kotlin com Gradle (JUnit)');
    return {
      primary: 'java',
      framework: 'junit',
      testCommand: './gradlew test',
      coverageCommand: './gradlew test jacocoTestReport',
      coverageFile: 'build/reports/jacoco/test/jacocoTestReport.xml',
      testPatterns: ['**/src/test/**/*Test.java', '**/src/test/**/*Test.kt'],
      sourcePatterns: ['**/src/main/**/*.java', '**/src/main/**/*.kt']
    };
  }

  // Go
  if (files.includes('go.mod')) {
    console.log('✅ Detectado: Go');
    return {
      primary: 'go',
      framework: 'go-test',
      testCommand: 'go test ./...',
      coverageCommand: 'go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out',
      coverageFile: 'coverage.out',
      testPatterns: ['**/*_test.go'],
      sourcePatterns: ['**/*.go']
    };
  }
  
  // [FIX] Go - Detectar por arquivos .go (sem go.mod)
  const hasGoFiles = files.some(f => f.endsWith('.go')) || 
                     files.includes('src') && await checkDirectory(join(repoPath, 'src'), '.go');
  
  if (hasGoFiles) {
    console.log('✅ Detectado: Go (via arquivos .go)');
    return {
      primary: 'go',
      framework: 'go-test',
      testCommand: 'go test ./...',
      coverageCommand: 'go test -coverprofile=coverage.out ./... && go tool cover -func=coverage.out',
      coverageFile: 'coverage.out',
      testPatterns: ['**/*_test.go'],
      sourcePatterns: ['**/*.go']
    };
  }

  // Ruby
  if (files.includes('Gemfile')) {
    const gemfile = await fs.readFile(join(repoPath, 'Gemfile'), 'utf-8').catch(() => '');
    
    if (gemfile.includes('rspec')) {
      console.log('✅ Detectado: Ruby com RSpec');
      return {
        primary: 'ruby',
        framework: 'rspec',
        testCommand: 'bundle exec rspec',
        coverageCommand: 'bundle exec rspec',
        coverageFile: 'coverage/.resultset.json',
        testPatterns: ['**/spec/**/*_spec.rb'],
        sourcePatterns: ['**/app/**/*.rb', '**/lib/**/*.rb']
      };
    }

    console.log('✅ Detectado: Ruby com Minitest');
    return {
      primary: 'ruby',
      framework: 'minitest',
      testCommand: 'bundle exec rake test',
      coverageCommand: 'bundle exec rake test',
      coverageFile: 'coverage/.resultset.json',
      testPatterns: ['**/test/**/*_test.rb'],
      sourcePatterns: ['**/app/**/*.rb', '**/lib/**/*.rb']
    };
  }

  // Python
  if (files.includes('requirements.txt') || files.includes('setup.py') || files.includes('pyproject.toml')) {
    console.log('✅ Detectado: Python com pytest');
    return {
      primary: 'python',
      framework: 'pytest',
      testCommand: 'pytest',
      coverageCommand: 'pytest --cov=. --cov-report=json',
      coverageFile: 'coverage.json',
      testPatterns: ['**/test_*.py', '**/*_test.py', '**/tests/**/*.py'],
      sourcePatterns: ['**/*.py']
    };
  }

  // C#
  if (files.some(f => f.endsWith('.csproj') || f.endsWith('.sln'))) {
    console.log('✅ Detectado: C# com .NET');
    return {
      primary: 'csharp',
      framework: 'nunit',
      testCommand: 'dotnet test',
      coverageCommand: 'dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura',
      coverageFile: 'coverage.cobertura.xml',
      testPatterns: ['**/*Tests.cs', '**/*Test.cs'],
      sourcePatterns: ['**/*.cs']
    };
  }

  // PHP
  if (files.includes('composer.json')) {
    console.log('✅ Detectado: PHP com PHPUnit');
    return {
      primary: 'php',
      framework: 'phpunit',
      testCommand: './vendor/bin/phpunit',
      coverageCommand: './vendor/bin/phpunit --coverage-clover coverage.xml',
      coverageFile: 'coverage.xml',
      testPatterns: ['**/tests/**/*Test.php'],
      sourcePatterns: ['**/src/**/*.php', '**/app/**/*.php']
    };
  }

  // Rust
  if (files.includes('Cargo.toml')) {
    console.log('✅ Detectado: Rust');
    return {
      primary: 'rust',
      framework: 'cargo-test',
      testCommand: 'cargo test',
      coverageCommand: 'cargo tarpaulin --out Json',
      coverageFile: 'tarpaulin-report.json',
      testPatterns: ['**/tests/**/*.rs', '**/*_test.rs'],
      sourcePatterns: ['**/src/**/*.rs']
    };
  }
  
  // [FIX] Rust - Detectar por arquivos .rs (sem Cargo.toml)
  const hasRustFiles = files.some(f => f.endsWith('.rs')) || 
                       files.includes('src') && await checkDirectory(join(repoPath, 'src'), '.rs');
  
  if (hasRustFiles) {
    console.log('✅ Detectado: Rust (via arquivos .rs)');
    return {
      primary: 'rust',
      framework: 'cargo-test',
      testCommand: 'cargo test',
      coverageCommand: 'cargo tarpaulin --out Json',
      coverageFile: 'tarpaulin-report.json',
      testPatterns: ['**/tests/**/*.rs', '**/*_test.rs'],
      sourcePatterns: ['**/src/**/*.rs']
    };
  }
  
  // [FIX] Java - Detectar por arquivos .java (sem Maven/Gradle)
  const hasJavaFiles = files.some(f => f.endsWith('.java')) || 
                       files.includes('src') && await checkDirectory(join(repoPath, 'src'), '.java');
  
  if (hasJavaFiles) {
    console.log('✅ Detectado: Java (via arquivos .java)');
    return {
      primary: 'java',
      framework: 'junit',
      testCommand: 'mvn test',
      coverageCommand: 'mvn clean test jacoco:report',
      coverageFile: 'target/site/jacoco/jacoco.xml',
      testPatterns: ['**/src/test/**/*Test.java', '**/src/test/**/*Tests.java'],
      sourcePatterns: ['**/src/main/**/*.java']
    };
  }
  
  // [FIX] Ruby - Detectar por arquivos .rb (sem Gemfile)
  const hasRubyFiles = files.some(f => f.endsWith('.rb')) || 
                       files.includes('app') && await checkDirectory(join(repoPath, 'app'), '.rb');
  
  if (hasRubyFiles) {
    console.log('✅ Detectado: Ruby (via arquivos .rb)');
    return {
      primary: 'ruby',
      framework: 'rspec',
      testCommand: 'bundle exec rspec',
      coverageCommand: 'bundle exec rspec',
      coverageFile: 'coverage/.resultset.json',
      testPatterns: ['**/spec/**/*_spec.rb'],
      sourcePatterns: ['**/app/**/*.rb', '**/lib/**/*.rb']
    };
  }
  
  // [FIX] PHP - Detectar por arquivos .php (sem composer.json)
  const hasPhpFiles = files.some(f => f.endsWith('.php')) || 
                      files.includes('src') && await checkDirectory(join(repoPath, 'src'), '.php');
  
  if (hasPhpFiles) {
    console.log('✅ Detectado: PHP (via arquivos .php)');
    return {
      primary: 'php',
      framework: 'phpunit',
      testCommand: './vendor/bin/phpunit',
      coverageCommand: './vendor/bin/phpunit --coverage-clover coverage.xml',
      coverageFile: 'coverage.xml',
      testPatterns: ['**/tests/**/*Test.php'],
      sourcePatterns: ['**/src/**/*.php', '**/app/**/*.php']
    };
  }
  
  // [FIX] C# - Detectar por arquivos .cs (sem .csproj/.sln)
  const hasCsharpFiles = files.some(f => f.endsWith('.cs')) || 
                         files.includes('src') && await checkDirectory(join(repoPath, 'src'), '.cs');
  
  if (hasCsharpFiles) {
    console.log('✅ Detectado: C# (via arquivos .cs)');
    return {
      primary: 'csharp',
      framework: 'nunit',
      testCommand: 'dotnet test',
      coverageCommand: 'dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura',
      coverageFile: 'coverage.cobertura.xml',
      testPatterns: ['**/*Tests.cs', '**/*Test.cs'],
      sourcePatterns: ['**/*.cs']
    };
  }

  // [FIX] Default mais inteligente - avisa usuário sobre linguagem desconhecida
  console.warn('⚠️  Linguagem não detectada automaticamente.');
  console.warn('💡 Arquivos encontrados:', files.slice(0, 10).join(', '));
  console.warn('📝 Usando fallback: TypeScript/JavaScript com Vitest');
  console.warn('🔧 Se seu projeto usa outra linguagem, adicione arquivo de configuração:');
  console.warn('   - Python: requirements.txt, setup.py ou pyproject.toml');
  console.warn('   - Java: pom.xml ou build.gradle');
  console.warn('   - Go: go.mod');
  console.warn('   - Ruby: Gemfile');
  console.warn('   - Rust: Cargo.toml');
  console.warn('   - PHP: composer.json');
  console.warn('   - C#: .csproj ou .sln');
  
  return {
    primary: 'typescript',
    framework: 'vitest',
    testCommand: 'npm test',
    coverageCommand: 'npm run test:coverage',
    coverageFile: 'coverage/coverage-summary.json',
    testPatterns: ['**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'],
    sourcePatterns: ['src/**/*.{ts,tsx,js,jsx}']
  };
}

/**
 * @deprecated Use LanguageAdapter.getTestFileExtension() instead
 * @see src/adapters/index.ts
 * 
 * Esta função será removida na v2.0.0.
 * Use: const adapter = await getLanguageAdapter(repo); adapter.getTestFileExtension()
 */
export function getTestFileExtension(language: string): string {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return '.test.ts';
    case 'java':
      return 'Test.java';
    case 'go':
      return '_test.go';
    case 'ruby':
      return '_spec.rb';
    case 'python':
      return '_test.py';
    case 'csharp':
      return 'Tests.cs';
    case 'php':
      return 'Test.php';
    case 'rust':
      return '_test.rs';
    default:
      return '.test.ts';
  }
}

/**
 * @deprecated Use LanguageAdapter.generateUnitTest() instead
 * @see src/adapters/index.ts
 * 
 * Esta função será removida na v2.0.0.
 * Use: const adapter = await getLanguageAdapter(repo); adapter.generateUnitTest(functionName, filePath)
 */
export function getTestTemplate(language: string, functionName: string, filePath: string): string {
  switch (language) {
    case 'typescript':
    case 'javascript':
      return `import { describe, it, expect } from 'vitest';
import { ${functionName} } from '${filePath}';

describe('${functionName}', () => {
  it('should work correctly', () => {
    // TODO: Implementar teste
    expect(true).toBe(true);
  });

  it('should handle edge cases', () => {
    // TODO: Implementar teste de edge case
    expect(true).toBe(true);
  });

  it('should handle errors', () => {
    // TODO: Implementar teste de erro
    expect(true).toBe(true);
  });
});
`;

    case 'java':
      return `import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ${functionName}Test {
    @Test
    void shouldWorkCorrectly() {
        // TODO: Implementar teste
        assertTrue(true);
    }

    @Test
    void shouldHandleEdgeCases() {
        // TODO: Implementar teste de edge case
        assertTrue(true);
    }

    @Test
    void shouldHandleErrors() {
        // TODO: Implementar teste de erro
        assertTrue(true);
    }
}
`;

    case 'go':
      return `package main

import "testing"

func Test${functionName}(t *testing.T) {
    // TODO: Implementar teste
    if true != true {
        t.Error("Expected true, got false")
    }
}

func Test${functionName}EdgeCases(t *testing.T) {
    // TODO: Implementar teste de edge case
    if true != true {
        t.Error("Expected true, got false")
    }
}

func Test${functionName}Errors(t *testing.T) {
    // TODO: Implementar teste de erro
    if true != true {
        t.Error("Expected true, got false")
    }
}
`;

    case 'ruby':
      return `require 'spec_helper'

RSpec.describe ${functionName} do
  it 'works correctly' do
    # TODO: Implementar teste
    expect(true).to be true
  end

  it 'handles edge cases' do
    # TODO: Implementar teste de edge case
    expect(true).to be true
  end

  it 'handles errors' do
    # TODO: Implementar teste de erro
    expect(true).to be true
  end
end
`;

    case 'python':
      return `import pytest

def test_${functionName}_works_correctly():
    """TODO: Implementar teste"""
    assert True

def test_${functionName}_handles_edge_cases():
    """TODO: Implementar teste de edge case"""
    assert True

def test_${functionName}_handles_errors():
    """TODO: Implementar teste de erro"""
    assert True
`;

    case 'csharp':
      return `using NUnit.Framework;

[TestFixture]
public class ${functionName}Tests
{
    [Test]
    public void ShouldWorkCorrectly()
    {
        // TODO: Implementar teste
        Assert.IsTrue(true);
    }

    [Test]
    public void ShouldHandleEdgeCases()
    {
        // TODO: Implementar teste de edge case
        Assert.IsTrue(true);
    }

    [Test]
    public void ShouldHandleErrors()
    {
        // TODO: Implementar teste de erro
        Assert.IsTrue(true);
    }
}
`;

    case 'php':
      return `<?php

use PHPUnit\\Framework\\TestCase;

class ${functionName}Test extends TestCase
{
    public function testShouldWorkCorrectly()
    {
        // TODO: Implementar teste
        $this->assertTrue(true);
    }

    public function testShouldHandleEdgeCases()
    {
        // TODO: Implementar teste de edge case
        $this->assertTrue(true);
    }

    public function testShouldHandleErrors()
    {
        // TODO: Implementar teste de erro
        $this->assertTrue(true);
    }
}
`;

    case 'rust':
      return `#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_${functionName}_works_correctly() {
        // TODO: Implementar teste
        assert!(true);
    }

    #[test]
    fn test_${functionName}_handles_edge_cases() {
        // TODO: Implementar teste de edge case
        assert!(true);
    }

    #[test]
    fn test_${functionName}_handles_errors() {
        // TODO: Implementar teste de erro
        assert!(true);
    }
}
`;

    default:
      return `// TODO: Adicionar testes para ${functionName}`;
  }
}

