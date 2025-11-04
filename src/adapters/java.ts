/**
 * Java Language Adapter
 * 
 * Implementação completa do LanguageAdapter para Java.
 * Suporta JUnit 5, JaCoCo (coverage), PIT (mutation).
 * 
 * COMPLETUDE FINAL - Java Support
 * 
 * @see ROADMAP-V1-COMPLETO.md (Fase C.3, C.5, C.10)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import type {
  LanguageAdapter,
  Framework,
  TestFile,
  RunOptions,
  TestResult,
  Coverage,
  MutationResult,
  TestTarget,
} from './base/LanguageAdapter.js';
import { parseJaCoCoXml } from '../parsers/coverage-parsers.js';
import { parsePITReport } from '../parsers/pit-parser.js';

export class JavaAdapter implements LanguageAdapter {
  language = 'java';
  fileExtensions = ['.java'];

  /**
   * Detecta framework de teste Java
   */
  async detectFramework(repo: string): Promise<Framework | null> {
    // Verificar se é projeto Java
    const hasPom = existsSync(join(repo, 'pom.xml'));
    const hasBuildGradle = existsSync(join(repo, 'build.gradle')) || existsSync(join(repo, 'build.gradle.kts'));

    if (!hasPom && !hasBuildGradle) {
      return null;
    }

    // Detectar JUnit version
    let version = '5';
    let name = 'junit';

    if (hasPom) {
      const pomContent = readFileSync(join(repo, 'pom.xml'), 'utf-8');
      
      if (pomContent.includes('junit-jupiter')) {
        name = 'junit5';
        version = '5';
      } else if (pomContent.includes('junit-vintage')) {
        name = 'junit4';
        version = '4';
      } else if (pomContent.includes('testng')) {
        name = 'testng';
        version = this.extractVersion(pomContent, 'testng');
      }
    } else if (hasBuildGradle) {
      const gradleFiles = [
        join(repo, 'build.gradle'),
        join(repo, 'build.gradle.kts'),
      ].filter(existsSync);

      if (gradleFiles.length > 0) {
        const gradleContent = readFileSync(gradleFiles[0], 'utf-8');
        
        if (gradleContent.includes('junit-jupiter')) {
          name = 'junit5';
          version = '5';
        } else if (gradleContent.includes('testng')) {
          name = 'testng';
          version = this.extractVersion(gradleContent, 'testng');
        }
      }
    }

    return {
      name,
      version,
      configFile: hasPom ? 'pom.xml' : 'build.gradle',
    };
  }

  /**
   * Descobre arquivos de teste
   */
  async discoverTests(repo: string): Promise<TestFile[]> {
    const testFiles: TestFile[] = [];

    // Maven padrão: src/test/java/**/*Test.java
    // Gradle padrão: src/test/java/**/*Test.java
    const testDirs = [
      join(repo, 'src', 'test', 'java'),
      join(repo, 'src', 'it', 'java'), // Integration tests
    ];

    for (const testDir of testDirs) {
      if (!existsSync(testDir)) continue;

      try {
        const output = execSync(`find "${testDir}" -name "*Test.java" -o -name "*Tests.java"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });

        const files = output.trim().split('\n').filter(Boolean);

        for (const file of files) {
          const relativePath = file.replace(repo + '/', '');
          testFiles.push({
            path: relativePath,
            type: file.includes('/it/') ? 'integration' : 'unit',
            framework: 'junit5',
            language: 'java',
          });
        }
      } catch {
        // Ignorar erro
      }
    }

    return testFiles;
  }

  /**
   * Executa testes Java
   */
  async runTests(repo: string, options: RunOptions = {}): Promise<TestResult> {
    const framework = await this.detectFramework(repo);

    if (!framework) {
      throw new Error('Projeto Java não detectado (falta pom.xml ou build.gradle)');
    }

    // Detectar build tool
    const hasMaven = existsSync(join(repo, 'pom.xml'));
    const hasGradle = existsSync(join(repo, 'build.gradle')) || existsSync(join(repo, 'build.gradle.kts'));

    let command = '';

    if (hasMaven) {
      command = 'mvn test';
      if (options.coverage) {
        command = 'mvn clean test jacoco:report';
      }
    } else if (hasGradle) {
      command = './gradlew test';
      if (options.coverage) {
        command = './gradlew test jacocoTestReport';
      }
    } else {
      throw new Error('Build tool não encontrado (Maven ou Gradle)');
    }

    // Executar
    let output = '';
    let ok = true;

    try {
      output = execSync(command, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error: any) {
      ok = false;
      output = error.stdout || error.stderr || '';
    }

    // Parse resultado
    return this.parseTestOutput(output, ok, framework.name);
  }

  /**
   * Parseia cobertura JaCoCo
   */
  async parseCoverage(coverageFile: string): Promise<Coverage> {
    return parseJaCoCoXml(coverageFile);
  }

  /**
   * Executa mutation testing com PIT
   */
  async runMutation(
    repo: string,
    targets: string[],
    options?: { threshold?: number; timeout?: number }
  ): Promise<MutationResult> {
    const hasMaven = existsSync(join(repo, 'pom.xml'));

    let command = '';

    if (hasMaven) {
      command = 'mvn org.pitest:pitest-maven:mutationCoverage';
    } else {
      command = './gradlew pitest';
    }

    let output = '';
    let ok = true;

    try {
      output = execSync(command, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: options?.timeout || 300000, // 5 min default
      });
    } catch (error: any) {
      ok = false;
      output = error.stdout || error.stderr || '';
    }

    // 🆕 Tentar parsear XML do PIT primeiro (mais preciso)
    const pitXmlPaths = [
      join(repo, 'target', 'pit-reports', 'mutations.xml'),
      join(repo, 'build', 'reports', 'pitest', 'mutations.xml'),
    ];

    for (const xmlPath of pitXmlPaths) {
      if (existsSync(xmlPath)) {
        try {
          return await parsePITReport(xmlPath, true);
        } catch (error) {
          console.warn('⚠️  Erro ao parsear PIT XML, usando fallback:', error);
        }
      }
    }

    // 🆕 Fallback: parsear stdout
    return parsePITReport(output, false);
  }

  /**
   * Gera scaffold de teste
   */
  async scaffoldTest(target: TestTarget): Promise<string> {
    const { file, function: functionName, class: className, type } = target;

    // Extrair nome da classe do arquivo
    const javaClassName = className || this.extractClassName(file);
    const testClassName = `${javaClassName}Test`;

    let template = '';

    if (type === 'unit') {
      template = this.generateUnitTestTemplate(javaClassName, testClassName, functionName);
    } else if (type === 'integration') {
      template = this.generateIntegrationTestTemplate(javaClassName, testClassName);
    } else {
      template = this.generateUnitTestTemplate(javaClassName, testClassName, functionName);
    }

    return template;
  }

  /**
   * 🆕 Garante dependências Java instaladas
   */
  async ensureDeps(repo: string, options?: { bootstrap?: boolean }): Promise<{
    ok: boolean;
    installed: string[];
    missing: string[];
    commands?: string[];
  }> {
    const installed: string[] = [];
    const missing: string[] = [];
    const commands: string[] = [];

    // Verificar Java
    try {
      const javaVersion = execSync('java -version', { encoding: 'utf-8', stdio: 'pipe' });
      installed.push(`Java: ${javaVersion.split('\n')[0]}`);
    } catch {
      missing.push('Java JDK 11+');
      commands.push('# Ubuntu/Debian:\nsudo apt-get install -y openjdk-17-jdk');
      commands.push('# macOS:\nbrew install openjdk@17');
    }

    // Verificar Maven
    const hasMaven = existsSync(join(repo, 'pom.xml'));
    if (hasMaven) {
      try {
        const mvnVersion = execSync('mvn -v', { encoding: 'utf-8', stdio: 'pipe' });
        installed.push(`Maven: ${mvnVersion.split('\n')[0]}`);
      } catch {
        missing.push('Maven 3.6+');
        commands.push('# Ubuntu/Debian:\nsudo apt-get install -y maven');
        commands.push('# macOS:\nbrew install maven');
      }

      // Verificar JaCoCo no pom.xml
      const pomContent = readFileSync(join(repo, 'pom.xml'), 'utf-8');
      if (pomContent.includes('jacoco')) {
        installed.push('JaCoCo plugin (pom.xml)');
      } else {
        missing.push('JaCoCo plugin no pom.xml');
        commands.push('# Adicionar ao pom.xml:\n<plugin>\n  <groupId>org.jacoco</groupId>\n  <artifactId>jacoco-maven-plugin</artifactId>\n  <version>0.8.10</version>\n</plugin>');
      }
    }

    // Verificar Gradle
    const hasGradle = existsSync(join(repo, 'build.gradle')) || existsSync(join(repo, 'build.gradle.kts'));
    if (hasGradle) {
      const gradlewExists = existsSync(join(repo, 'gradlew'));
      if (gradlewExists) {
        installed.push('Gradle wrapper (./gradlew)');
      } else {
        try {
          const gradleVersion = execSync('gradle -v', { encoding: 'utf-8', stdio: 'pipe' });
          installed.push(`Gradle: ${gradleVersion.split('\n')[0]}`);
        } catch {
          missing.push('Gradle 7+');
          commands.push('# Ubuntu/Debian:\nsudo apt-get install -y gradle');
          commands.push('# macOS:\nbrew install gradle');
        }
      }
    }

    // Verificar Pact (opcional)
    if (hasMaven) {
      const pomContent = readFileSync(join(repo, 'pom.xml'), 'utf-8');
      if (pomContent.includes('pact')) {
        installed.push('Pact JVM (pom.xml)');
      }
    }

    return {
      ok: missing.length === 0,
      installed,
      missing,
      commands: missing.length > 0 ? commands : undefined,
    };
  }

  /**
   * 🆕 Compila projeto Java
   */
  async build(repo: string, options?: { skipTests?: boolean }): Promise<{
    ok: boolean;
    output: string;
    duration: number;
  }> {
    const hasMaven = existsSync(join(repo, 'pom.xml'));
    const hasGradle = existsSync(join(repo, 'build.gradle')) || existsSync(join(repo, 'build.gradle.kts'));

    let command = '';

    if (hasMaven) {
      command = 'mvn clean compile';
      if (options?.skipTests) {
        command += ' -DskipTests';
      }
    } else if (hasGradle) {
      command = './gradlew clean build';
      if (options?.skipTests) {
        command += ' -x test';
      }
    } else {
      throw new Error('Build tool não encontrado (Maven ou Gradle)');
    }

    const startTime = Date.now();
    let output = '';
    let ok = true;

    try {
      output = execSync(command, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch (error: any) {
      ok = false;
      output = error.stdout || error.stderr || error.message;
    }

    const duration = Date.now() - startTime;

    return { ok, output, duration };
  }

  /**
   * 🆕 Descobre contratos Pact
   */
  async discoverContracts(repo: string): Promise<Array<{
    file: string;
    consumer: string;
    provider: string;
    type: 'consumer' | 'provider';
  }>> {
    const contracts: Array<{
      file: string;
      consumer: string;
      provider: string;
      type: 'consumer' | 'provider';
    }> = [];

    // Maven: target/pacts/*.json
    // Gradle: build/pacts/*.json
    const pactDirs = [
      join(repo, 'target', 'pacts'),
      join(repo, 'build', 'pacts'),
    ];

    for (const pactDir of pactDirs) {
      if (!existsSync(pactDir)) continue;

      try {
        const output = execSync(`find "${pactDir}" -name "*.json"`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        });

        const files = output.trim().split('\n').filter(Boolean);

        for (const file of files) {
          try {
            const content = readFileSync(file, 'utf-8');
            const pact = JSON.parse(content);

            contracts.push({
              file: file.replace(repo + '/', ''),
              consumer: pact.consumer?.name || 'unknown',
              provider: pact.provider?.name || 'unknown',
              type: 'consumer', // Pacts gerados são sempre do lado consumer
            });
          } catch {
            // Ignorar arquivos inválidos
          }
        }
      } catch {
        // Ignorar erro de find
      }
    }

    return contracts;
  }

  /**
   * 🆕 Verifica contratos Pact
   */
  async verifyContracts(repo: string, options?: {
    broker?: string;
    token?: string;
    provider?: string;
  }): Promise<{
    ok: boolean;
    total: number;
    verified: number;
    failed: number;
    results: Array<{
      contract: string;
      status: 'passed' | 'failed';
      message?: string;
    }>;
  }> {
    const hasMaven = existsSync(join(repo, 'pom.xml'));

    let command = '';

    if (hasMaven) {
      command = 'mvn pact:verify';
      if (options?.broker) {
        command += ` -Dpact.broker.url=${options.broker}`;
      }
      if (options?.token) {
        command += ` -Dpact.broker.token=${options.token}`;
      }
      if (options?.provider) {
        command += ` -Dpact.provider.name=${options.provider}`;
      }
    } else {
      command = './gradlew pactVerify';
    }

    let output = '';
    let ok = true;

    try {
      output = execSync(command, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 120000, // 2 min
      });
    } catch (error: any) {
      ok = false;
      output = error.stdout || error.stderr || error.message;
    }

    // Parse output
    // Maven Pact output: "Verified X out of Y interactions"
    const verifiedMatch = output.match(/Verified (\d+) out of (\d+)/);
    const total = verifiedMatch ? parseInt(verifiedMatch[2]) : 0;
    const verified = verifiedMatch ? parseInt(verifiedMatch[1]) : 0;
    const failed = total - verified;

    return {
      ok,
      total,
      verified,
      failed,
      results: [], // TODO: Parsear resultados detalhados
    };
  }

  /**
   * Valida ambiente Java
   */
  async validate(repo: string): Promise<{
    ok: boolean;
    framework?: Framework;
    missing?: string[];
    warnings?: string[];
  }> {
    const depsResult = await this.ensureDeps(repo);
    const framework = await this.detectFramework(repo);

    return {
      ok: depsResult.ok,
      framework: framework || undefined,
      missing: depsResult.missing,
      warnings: [],
    };
  }

  // ========== HELPERS ==========

  private extractVersion(content: string, dependency: string): string {
    const regex = new RegExp(`${dependency}.*?<version>([^<]+)</version>`);
    const match = content.match(regex);
    return match ? match[1] : 'unknown';
  }

  private parseTestOutput(output: string, ok: boolean, framework: string): TestResult {
    // Formato Maven/Gradle:
    // "Tests run: 25, Failures: 2, Errors: 1, Skipped: 3"

    const runMatch = output.match(/Tests run:\s*(\d+)/);
    const failMatch = output.match(/Failures:\s*(\d+)/);
    const errorMatch = output.match(/Errors:\s*(\d+)/);
    const skipMatch = output.match(/Skipped:\s*(\d+)/);

    const totalTests = runMatch ? parseInt(runMatch[1]) : 0;
    const failures = failMatch ? parseInt(failMatch[1]) : 0;
    const errors = errorMatch ? parseInt(errorMatch[1]) : 0;
    const skipped = skipMatch ? parseInt(skipMatch[1]) : 0;
    const failed = failures + errors;
    const passed = totalTests - failed - skipped;

    return {
      ok,
      framework,
      totalTests,
      passed,
      failed,
      skipped,
      duration: 0,
      output,
    };
  }

  // parsePitOutput removido - agora usa parsePITReport()

  private extractClassName(filePath: string): string {
    // "src/main/java/com/example/UserService.java" -> "UserService"
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.replace('.java', '');
  }

  private generateUnitTestTemplate(className: string, testClassName: string, methodName?: string): string {
    const method = methodName || 'someMethod';

    return `package com.example;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

@DisplayName("${className} Unit Tests")
class ${testClassName} {

    private ${className} subject;

    @BeforeEach
    void setUp() {
        subject = new ${className}();
    }

    @Test
    @DisplayName("${method} should work correctly")
    void ${method}_shouldWorkCorrectly() {
        // Arrange
        
        // Act
        var result = subject.${method}();
        
        // Assert
        assertNotNull(result);
    }

    @Test
    @DisplayName("${method} should handle null input")
    void ${method}_shouldHandleNullInput() {
        // Arrange & Act & Assert
        assertThrows(IllegalArgumentException.class, () -> {
            subject.${method}(null);
        });
    }

    @Test
    @DisplayName("${method} should handle empty input")
    void ${method}_shouldHandleEmptyInput() {
        // Arrange
        
        // Act
        var result = subject.${method}("");
        
        // Assert
        assertTrue(result.isEmpty());
    }
}
`;
  }

  private generateIntegrationTestTemplate(className: string, testClassName: string): string {
    return `package com.example;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.junit.jupiter.SpringExtension;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@DisplayName("${className} Integration Tests")
class ${testClassName} {

    @Autowired
    private ${className} subject;

    @BeforeEach
    void setUp() {
        // Setup integration test environment
    }

    @AfterEach
    void tearDown() {
        // Cleanup
    }

    @Test
    @DisplayName("Should integrate with database correctly")
    void shouldIntegrateWithDatabase() {
        // Arrange
        
        // Act
        var result = subject.findAll();
        
        // Assert
        assertNotNull(result);
        assertFalse(result.isEmpty());
    }

    @Test
    @DisplayName("Should handle transaction correctly")
    void shouldHandleTransaction() {
        // Arrange
        
        // Act & Assert
        assertDoesNotThrow(() -> {
            subject.saveWithTransaction();
        });
    }
}
`;
  }
}

// Export singleton instance
export const javaAdapter = new JavaAdapter();

