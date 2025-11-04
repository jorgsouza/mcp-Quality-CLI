/**
 * Python Language Adapter
 * 
 * Implementa LanguageAdapter para Python usando:
 * - pytest para testes
 * - coverage.py para cobertura
 * - mutmut para mutation testing
 * 
 * FASE A.3 - Implementação do PythonAdapter
 * 
 * @see ROADMAP-V1-COMPLETO.md (Fase A)
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { promises as fs } from 'node:fs';
import { glob } from 'glob';
import { execSync } from 'node:child_process';
import type {
  LanguageAdapter,
  Framework,
  TestFile,
  RunOptions,
  TestResult,
  Coverage,
  CoverageMetric,
  FileCoverage,
  MutationResult,
  Mutation,
  TestTarget,
} from './base/LanguageAdapter.js';

/**
 * Python Adapter
 * 
 * Suporta:
 * - Framework: pytest, unittest
 * - Coverage: coverage.py
 * - Mutation: mutmut
 */
export class PythonAdapter implements LanguageAdapter {
  readonly language = 'python';
  readonly fileExtensions = ['.py'];

  /**
   * Detecta framework de testes Python
   */
  async detectFramework(repo: string): Promise<Framework | null> {
    // 1. Verificar pytest.ini ou pyproject.toml
    if (existsSync(join(repo, 'pytest.ini')) || existsSync(join(repo, 'pyproject.toml'))) {
      const version = await this.getPythonPackageVersion(repo, 'pytest');
      return {
        name: 'pytest',
        version,
        configFile: existsSync(join(repo, 'pytest.ini'))
          ? 'pytest.ini'
          : existsSync(join(repo, 'pyproject.toml'))
          ? 'pyproject.toml'
          : undefined,
        testDir: 'tests',
        coverageTool: 'coverage.py',
        mutationTool: 'mutmut',
      };
    }

    // 2. Verificar setup.py ou requirements.txt
    const setupPy = join(repo, 'setup.py');
    const requirementsTxt = join(repo, 'requirements.txt');
    const requirementsDev = join(repo, 'requirements-dev.txt');

    const filesToCheck = [setupPy, requirementsTxt, requirementsDev];

    for (const file of filesToCheck) {
      if (existsSync(file)) {
        const content = readFileSync(file, 'utf-8');

        if (content.includes('pytest')) {
          return {
            name: 'pytest',
            coverageTool: 'coverage.py',
            mutationTool: 'mutmut',
          };
        }

        if (content.includes('unittest')) {
          return {
            name: 'unittest',
            coverageTool: 'coverage.py',
            mutationTool: 'mutmut',
          };
        }
      }
    }

    // 3. Verificar se tem arquivos test_*.py (indica pytest/unittest)
    const testFiles = await glob('**/test_*.py', {
      cwd: repo,
      ignore: ['**/venv/**', '**/.venv/**', '**/node_modules/**'],
    });

    if (testFiles.length > 0) {
      return {
        name: 'pytest', // Default para Python
        testDir: 'tests',
        coverageTool: 'coverage.py',
        mutationTool: 'mutmut',
      };
    }

    return null;
  }

  /**
   * Descobre arquivos de teste Python
   */
  async discoverTests(
    repo: string,
    options?: { types?: string[]; patterns?: string[] }
  ): Promise<TestFile[]> {
    const tests: TestFile[] = [];

    // Padrões padrão para Python
    const defaultPatterns = [
      '**/test_*.py',
      '**/*_test.py',
      '**/tests/**/*.py',
    ];

    const patterns = options?.patterns || defaultPatterns;

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: repo,
        ignore: ['**/venv/**', '**/.venv/**', '**/node_modules/**', '**/__pycache__/**'],
      });

      for (const file of files) {
        const filePath = join(repo, file);
        const content = await fs.readFile(filePath, 'utf-8');

        // Detectar tipo de teste
        const type = this.detectTestType(file, content);

        // Contar testes
        const testCount = this.countTests(content);

        // Detectar framework
        const framework = this.detectTestFramework(content);

        tests.push({
          path: relative(repo, filePath),
          type,
          language: 'python',
          framework,
          testCount,
        });
      }
    }

    return tests;
  }

  /**
   * Executa testes Python
   */
  async runTests(repo: string, options: RunOptions = {}): Promise<TestResult> {
    const framework = await this.detectFramework(repo);

    if (!framework) {
      throw new Error('Nenhum framework de testes Python detectado');
    }

    let command = '';
    let output = '';

    try {
      if (framework.name === 'pytest') {
        command = `python -m pytest`;

        // Opções pytest
        if (options.coverage) {
          command += ` --cov=. --cov-report=xml --cov-report=term`;
        }

        if (options.maxWorkers) {
          command += ` -n ${options.maxWorkers}`; // pytest-xdist
        }

        if (options.tags && options.tags.length > 0) {
          command += ` -m "${options.tags.join(' or ')}"`;
        }

        if (options.files && options.files.length > 0) {
          command += ` ${options.files.join(' ')}`;
        }

        // Adicionar flags úteis
        command += ` -v`; // verbose
      } else if (framework.name === 'unittest') {
        command = `python -m unittest discover`;

        if (options.files && options.files.length > 0) {
          command = `python -m unittest ${options.files.join(' ')}`;
        }
      }

      output = execSync(command, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
        env: { ...process.env, ...options.env },
      });

      // Parsear resultado
      return this.parseTestOutput(framework.name, output, true);
    } catch (error: any) {
      // Teste falhou
      output = error.stdout || error.stderr || '';
      return this.parseTestOutput(framework.name, output, false);
    }
  }

  /**
   * Faz parsing de arquivo de cobertura Python (Cobertura XML format)
   */
  async parseCoverage(coverageFile: string): Promise<Coverage> {
    // Python usa coverage.py que gera:
    // - coverage.xml (Cobertura XML format)
    // - .coverage (binary format)
    // - htmlcov/ (HTML report)

    if (!existsSync(coverageFile)) {
      throw new Error(`Arquivo de cobertura não encontrado: ${coverageFile}`);
    }

    if (coverageFile.endsWith('.xml') || coverageFile.includes('coverage')) {
      return this.parseCoberturaXml(coverageFile);
    }

    throw new Error(`Formato de cobertura não suportado: ${coverageFile}`);
  }

  /**
   * Executa mutation testing com mutmut
   */
  async runMutation(
    repo: string,
    targets: string[],
    options?: { threshold?: number; timeout?: number }
  ): Promise<MutationResult> {
    // Verificar se mutmut está instalado
    const hasMutmut = await this.hasPythonPackage(repo, 'mutmut');

    if (!hasMutmut) {
      console.warn('⚠️  mutmut não instalado. Execute: pip install mutmut');
      return {
        ok: false,
        framework: 'mutmut',
        totalMutants: 0,
        killed: 0,
        survived: 0,
        timeout: 0,
        noCoverage: 0,
        score: 0,
        threshold: options?.threshold || 0.5,
      };
    }

    try {
      // Executar mutmut
      // mutmut run --paths-to-mutate=src/
      const pathsArg = targets.length > 0 ? `--paths-to-mutate=${targets.join(',')}` : '';
      const command = `python -m mutmut run ${pathsArg}`;

      execSync(command, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: options?.timeout || 300000, // 5 min default
      });

      // Gerar relatório JSON
      execSync('python -m mutmut junitxml > mutation-report.xml', {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      // Parsear relatório
      return this.parseMutationReport(repo, options?.threshold);
    } catch (error: any) {
      // mutmut pode retornar exit code != 0 se tiver mutantes sobreviventes
      return this.parseMutationReport(repo, options?.threshold);
    }
  }

  /**
   * Gera scaffold de teste pytest
   */
  async scaffoldTest(target: TestTarget): Promise<string> {
    const functionName = target.function || 'my_function';
    const moduleName = target.file.replace(/\.py$/, '').replace(/\//g, '.');

    if (target.type === 'unit') {
      return this.generatePytestUnitScaffold(moduleName, functionName);
    }

    if (target.type === 'integration') {
      return this.generatePytestIntegrationScaffold(moduleName, functionName);
    }

    if (target.type === 'property') {
      return this.generatePytestPropertyScaffold(moduleName, functionName);
    }

    return this.generatePytestUnitScaffold(moduleName, functionName);
  }

  /**
   * 🆕 Garante dependências Python instaladas
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

    // Verificar Python
    try {
      const pythonVersion = execSync('python3 --version || python --version', { encoding: 'utf-8', stdio: 'pipe' });
      installed.push(`Python: ${pythonVersion.trim()}`);
    } catch {
      missing.push('Python 3.9+');
      commands.push('# Ubuntu/Debian:\nsudo apt-get install -y python3 python3-pip python3-venv');
      commands.push('# macOS:\nbrew install python@3.11');
    }

    // Verificar pip
    try {
      const pipVersion = execSync('python3 -m pip --version || python -m pip --version', { encoding: 'utf-8', stdio: 'pipe' });
      installed.push(`pip: ${pipVersion.split('\n')[0]}`);
    } catch {
      missing.push('pip');
      commands.push('# Instalar pip:\npython3 -m ensurepip --upgrade');
    }

    // Verificar pytest
    if (await this.hasPythonPackage(repo, 'pytest')) {
      installed.push('pytest');
    } else {
      missing.push('pytest');
      commands.push('# Instalar pytest:\npython3 -m pip install pytest');
    }

    // Verificar coverage.py
    if (await this.hasPythonPackage(repo, 'coverage')) {
      installed.push('coverage.py');
    } else {
      missing.push('coverage.py');
      commands.push('# Instalar coverage:\npython3 -m pip install coverage');
    }

    // Verificar pytest-cov
    if (await this.hasPythonPackage(repo, 'pytest-cov')) {
      installed.push('pytest-cov');
    } else {
      missing.push('pytest-cov');
      commands.push('# Instalar pytest-cov:\npython3 -m pip install pytest-cov');
    }

    // Verificar mutmut (opcional)
    if (await this.hasPythonPackage(repo, 'mutmut')) {
      installed.push('mutmut');
    }

    // Verificar pact-python (opcional)
    if (await this.hasPythonPackage(repo, 'pact-python')) {
      installed.push('pact-python');
    }

    return {
      ok: missing.length === 0,
      installed,
      missing,
      commands: missing.length > 0 ? commands : undefined,
    };
  }

  /**
   * 🆕 Descobre contratos Pact (Python)
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

    // Python Pact: pacts/*.json ou tests/pacts/*.json
    const pactDirs = [
      join(repo, 'pacts'),
      join(repo, 'tests', 'pacts'),
    ];

    for (const pactDir of pactDirs) {
      if (!existsSync(pactDir)) continue;

      try {
        const files = await glob('*.json', { cwd: pactDir });

        for (const file of files) {
          try {
            const fullPath = join(pactDir, file);
            const content = readFileSync(fullPath, 'utf-8');
            const pact = JSON.parse(content);

            contracts.push({
              file: fullPath.replace(repo + '/', ''),
              consumer: pact.consumer?.name || 'unknown',
              provider: pact.provider?.name || 'unknown',
              type: 'consumer',
            });
          } catch {
            // Ignorar arquivos inválidos
          }
        }
      } catch {
        // Ignorar erro de glob
      }
    }

    return contracts;
  }

  /**
   * 🆕 Verifica contratos Pact (Python)
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
    // Python Pact: pact-verifier (provider side)
    // Formato: pact-verifier --provider-base-url http://localhost:5000 --pact-urls ./pacts/*.json

    const contracts = await this.discoverContracts(repo);

    if (contracts.length === 0) {
      return {
        ok: true,
        total: 0,
        verified: 0,
        failed: 0,
        results: [],
      };
    }

    // Construir comando
    let command = 'pact-verifier';

    if (options?.provider) {
      command += ` --provider-name ${options.provider}`;
    }

    if (options?.broker) {
      command += ` --pact-broker-url ${options.broker}`;
      if (options.token) {
        command += ` --pact-broker-token ${options.token}`;
      }
    } else {
      // Usar pacts locais
      const pactFiles = contracts.map(c => join(repo, c.file)).join(' ');
      command += ` --pact-urls ${pactFiles}`;
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

    // Parse output (básico)
    const verified = ok ? contracts.length : 0;
    const failed = contracts.length - verified;

    return {
      ok,
      total: contracts.length,
      verified,
      failed,
      results: [], // TODO: Parsear resultados detalhados
    };
  }

  /**
   * Valida ambiente Python
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

  // ==================== Helpers ====================

  private async getPythonPackageVersion(repo: string, packageName: string): Promise<string | undefined> {
    try {
      const output = execSync(`python -m pip show ${packageName}`, {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      const versionMatch = output.match(/Version:\s+([\d.]+)/);
      return versionMatch ? versionMatch[1] : undefined;
    } catch {
      return undefined;
    }
  }

  private async hasPythonPackage(repo: string, packageName: string): Promise<boolean> {
    try {
      execSync(`python -m pip show ${packageName}`, {
        cwd: repo,
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }

  private detectTestType(
    file: string,
    content: string
  ): 'unit' | 'integration' | 'e2e' | 'contract' | 'property' | 'approval' {
    if (file.includes('/e2e/') || file.includes('test_e2e_')) return 'e2e';
    if (file.includes('/integration/') || file.includes('test_integration_')) return 'integration';
    if (file.includes('/contract/') || content.includes('pact')) return 'contract';
    if (file.includes('/property/') || content.includes('hypothesis')) return 'property';
    if (file.includes('/approval/') || content.includes('pytest-regtest')) return 'approval';
    return 'unit';
  }

  private countTests(content: string): number {
    // Contar funções que começam com test_
    const testRegex = /def test_\w+\(/g;
    const matches = content.match(testRegex);
    return matches ? matches.length : 0;
  }

  private detectTestFramework(content: string): string {
    if (content.includes('import pytest') || content.includes('from pytest')) return 'pytest';
    if (content.includes('import unittest') || content.includes('from unittest')) return 'unittest';
    return 'pytest'; // Default
  }

  private parseTestOutput(framework: string, output: string, ok: boolean): TestResult {
    // Parsing simplificado - pytest output
    // Exemplo: "= 25 passed, 2 failed, 1 skipped in 2.34s ="

    const passedMatch = output.match(/(\d+)\s+passed/);
    const failedMatch = output.match(/(\d+)\s+failed/);
    const skippedMatch = output.match(/(\d+)\s+skipped/);
    const durationMatch = output.match(/in\s+([\d.]+)s/);

    const passed = passedMatch ? parseInt(passedMatch[1]) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1]) : 0;
    const skipped = skippedMatch ? parseInt(skippedMatch[1]) : 0;
    const totalTests = passed + failed + skipped;
    const duration = durationMatch ? parseFloat(durationMatch[1]) : 0;

    return {
      ok,
      framework,
      totalTests,
      passed,
      failed,
      skipped,
      duration,
      output,
    };
  }

  private async parseCoberturaXml(filePath: string): Promise<Coverage> {
    // Parse simplificado de Cobertura XML
    // Em produção, usar parser XML robusto
    const content = await fs.readFile(filePath, 'utf-8');

    // Extrair métricas do XML
    // <coverage line-rate="0.85" branch-rate="0.78" ...>
    const lineRateMatch = content.match(/line-rate="([\d.]+)"/);
    const branchRateMatch = content.match(/branch-rate="([\d.]+)"/);

    const lineRate = lineRateMatch ? parseFloat(lineRateMatch[1]) : 0;
    const branchRate = branchRateMatch ? parseFloat(branchRateMatch[1]) : 0;

    // Extrair totais de linhas
    const linesValidMatch = content.match(/lines-valid="(\d+)"/);
    const linesCoveredMatch = content.match(/lines-covered="(\d+)"/);
    const branchesValidMatch = content.match(/branches-valid="(\d+)"/);
    const branchesCoveredMatch = content.match(/branches-covered="(\d+)"/);

    const linesValid = linesValidMatch ? parseInt(linesValidMatch[1]) : 0;
    const linesCovered = linesCoveredMatch ? parseInt(linesCoveredMatch[1]) : 0;
    const branchesValid = branchesValidMatch ? parseInt(branchesValidMatch[1]) : 0;
    const branchesCovered = branchesCoveredMatch ? parseInt(branchesCoveredMatch[1]) : 0;

    return {
      lines: {
        total: linesValid,
        covered: linesCovered,
        skipped: 0,
        pct: lineRate * 100,
      },
      functions: {
        total: 0,
        covered: 0,
        skipped: 0,
        pct: 0,
      },
      branches: {
        total: branchesValid,
        covered: branchesCovered,
        skipped: 0,
        pct: branchRate * 100,
      },
      statements: {
        total: linesValid,
        covered: linesCovered,
        skipped: 0,
        pct: lineRate * 100,
      },
    };
  }

  private async parseMutationReport(repo: string, threshold = 0.5): Promise<MutationResult> {
    // mutmut gera relatório em mutation-report.xml ou HTML
    try {
      // Executar mutmut results para obter status
      const output = execSync('python -m mutmut results', {
        cwd: repo,
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      // Parse output
      // "Killed: 156, Survived: 44, ..."
      const killedMatch = output.match(/Killed:\s+(\d+)/);
      const survivedMatch = output.match(/Survived:\s+(\d+)/);
      const timeoutMatch = output.match(/Timeout:\s+(\d+)/);
      const suspiciousMatch = output.match(/Suspicious:\s+(\d+)/);

      const killed = killedMatch ? parseInt(killedMatch[1]) : 0;
      const survived = survivedMatch ? parseInt(survivedMatch[1]) : 0;
      const timeout = timeoutMatch ? parseInt(timeoutMatch[1]) : 0;
      const suspicious = suspiciousMatch ? parseInt(suspiciousMatch[1]) : 0;
      const noCoverage = 0;

      const totalMutants = killed + survived + timeout + suspicious;
      const score = totalMutants > 0 ? killed / totalMutants : 0;
      const ok = score >= threshold;

      return {
        ok,
        framework: 'mutmut',
        totalMutants,
        killed,
        survived,
        timeout,
        noCoverage,
        score,
        threshold,
      };
    } catch (error) {
      console.error('Erro ao ler relatório de mutação mutmut:', error);
      return {
        ok: false,
        framework: 'mutmut',
        totalMutants: 0,
        killed: 0,
        survived: 0,
        timeout: 0,
        noCoverage: 0,
        score: 0,
        threshold,
      };
    }
  }

  private generatePytestUnitScaffold(moduleName: string, functionName: string): string {
    return `import pytest
from ${moduleName} import ${functionName}


class Test${functionName.charAt(0).toUpperCase() + functionName.slice(1)}:
    """Unit tests for ${functionName}"""

    def test_happy_path(self):
        """Test happy path scenario"""
        # Arrange
        input_data = {}

        # Act
        result = ${functionName}(input_data)

        # Assert
        assert result is not None

    def test_error_handling(self):
        """Test error handling"""
        # Arrange
        invalid_input = None

        # Act & Assert
        with pytest.raises(ValueError):
            ${functionName}(invalid_input)

    def test_edge_cases(self):
        """Test edge cases"""
        # Arrange
        edge_input = []

        # Act
        result = ${functionName}(edge_input)

        # Assert
        assert result == []

    def test_side_effects(self, mocker):
        """Test side effects with mocks"""
        # Arrange
        mock_service = mocker.patch('${moduleName}.some_service')
        input_data = {}

        # Act
        ${functionName}(input_data)

        # Assert
        mock_service.assert_called_once()
`;
  }

  private generatePytestIntegrationScaffold(moduleName: string, functionName: string): string {
    return `import pytest
from ${moduleName} import ${functionName}


@pytest.mark.integration
class Test${functionName.charAt(0).toUpperCase() + functionName.slice(1)}Integration:
    """Integration tests for ${functionName}"""

    @pytest.fixture
    def setup_integration_env(self):
        """Setup integration environment"""
        # Setup code here
        yield
        # Teardown code here

    def test_integration_scenario(self, setup_integration_env):
        """Test integration scenario"""
        # Arrange
        input_data = {}

        # Act
        result = ${functionName}(input_data)

        # Assert
        assert result is not None
`;
  }

  private generatePytestPropertyScaffold(moduleName: string, functionName: string): string {
    return `import pytest
from hypothesis import given, strategies as st
from ${moduleName} import ${functionName}


@pytest.mark.property
class Test${functionName.charAt(0).toUpperCase() + functionName.slice(1)}Properties:
    """Property-based tests for ${functionName}"""

    @given(st.text())
    def test_property_always_returns_string(self, input_str):
        """Property: function always returns a string"""
        result = ${functionName}(input_str)
        assert isinstance(result, str)

    @given(st.lists(st.integers()))
    def test_property_length_invariant(self, input_list):
        """Property: output length equals input length"""
        result = ${functionName}(input_list)
        assert len(result) == len(input_list)
`;
  }
}

/**
 * Singleton instance
 */
export const pythonAdapter = new PythonAdapter();

/**
 * Default export
 */
export default PythonAdapter;

