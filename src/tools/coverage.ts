import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import { spawn } from 'node:child_process';
import { writeFileSafe, fileExists, readFile } from '../utils/fs.js';
import { loadMCPSettings, mergeSettings } from '../utils/config.js';
import { detectLanguage } from '../detectors/language.js';

export interface CoverageParams {
  repo: string;
  product: string;
  target_coverage?: {
    unit?: number;
    integration?: number;
    e2e?: number;
  };
}

export interface CoverageResult {
  summary: string;
  pyramid: {
    unit: {
      files_found: number;
      test_cases: number;
      coverage_percent?: number;
      test_files: string[];
      missing_tests: string[];
    };
    integration: {
      files_found: number;
      test_cases: number;
      coverage_percent?: number;
      test_files: string[];
      api_endpoints_tested: number;
    };
    e2e: {
      files_found: number;
      test_cases: number;
      scenarios: number;
      test_files: string[];
    };
  };
  health: 'healthy' | 'inverted' | 'needs_attention';
  recommendations: string[];
  analysis_path: string;
}

export async function analyzeTestCoverage(input: CoverageParams): Promise<CoverageResult> {
  // Carregar configuração centralizada
  const fileSettings = await loadMCPSettings(input.repo, input.product);
  const settings = mergeSettings(fileSettings, input);
  
  console.log(`📊 Analisando cobertura de testes completa para ${settings.product}...`);
  
  if (fileSettings) {
    console.log(`✅ Using settings from mcp-settings.json`);
  }

  // Detecta a linguagem do projeto
  const languageDetection = await detectLanguage(settings.repo);
  const language = languageDetection.primary;
  console.log(`🔍 Linguagem detectada: ${language}`);

  const analysesDir = join(settings.repo, 'tests', 'analyses');
  await writeFileSafe(join(analysesDir, '.gitkeep'), '');

  // Tenta obter contagem precisa do test runner
  const actualTestCount = await getActualTestCount(settings.repo, language);
  console.log(`🧪 Contagem real de testes: ${actualTestCount || 'não detectada'}`);

  // Detecta testes unitários
  const unitTests = await detectUnitTests(settings.repo, language);
  console.log(`📝 Testes unitários detectados: ${unitTests.test_cases} em ${unitTests.files_found} arquivos`);
  
  // Detecta testes de integração
  const integrationTests = await detectIntegrationTests(settings.repo, language);
  console.log(`🔗 Testes de integração detectados: ${integrationTests.test_cases} em ${integrationTests.files_found} arquivos`);
  
  // Detecta testes E2E
  const e2eTests = await detectE2ETests(settings.repo, language);
  console.log(`🎯 Testes E2E detectados: ${e2eTests.test_cases} em ${e2eTests.files_found} arquivos`);

  // Usa a contagem real se disponível, senão usa a soma manual
  let totalTestCases = actualTestCount || (unitTests.test_cases + integrationTests.test_cases + e2eTests.test_cases);
  
  // Se temos a contagem real, ajusta as proporções mantendo a distribuição
  if (actualTestCount && actualTestCount !== (unitTests.test_cases + integrationTests.test_cases + e2eTests.test_cases)) {
    const ratio = actualTestCount / (unitTests.test_cases + integrationTests.test_cases + e2eTests.test_cases);
    unitTests.test_cases = Math.round(unitTests.test_cases * ratio);
    integrationTests.test_cases = Math.round(integrationTests.test_cases * ratio);
    e2eTests.test_cases = Math.round(e2eTests.test_cases * ratio);
    totalTestCases = unitTests.test_cases + integrationTests.test_cases + e2eTests.test_cases;
  }

  // Detecta arquivos fonte que precisam de testes
  const sourceFiles = await detectSourceFiles(settings.repo, language);
  const missingTests = findMissingTests(sourceFiles, unitTests.test_files, language);

  // Calcula saúde da pirâmide usando test cases
  const totalFiles = unitTests.files_found + integrationTests.files_found + e2eTests.files_found;
  const unitPercent = totalTestCases > 0 ? (unitTests.test_cases / totalTestCases) * 100 : 0;
  const integrationPercent = totalTestCases > 0 ? (integrationTests.test_cases / totalTestCases) * 100 : 0;
  const e2ePercent = totalTestCases > 0 ? (e2eTests.test_cases / totalTestCases) * 100 : 0;

  let health: 'healthy' | 'inverted' | 'needs_attention';
  
  // Pirâmide ideal: 70% unit, 20% integration, 10% e2e
  if (unitPercent >= 60 && e2ePercent <= 20) {
    health = 'healthy';
  } else if (e2ePercent > unitPercent) {
    health = 'inverted';
  } else {
    health = 'needs_attention';
  }

  const recommendations = generateRecommendations({
    unitPercent,
    integrationPercent,
    e2ePercent,
    missingTests,
    targets: settings.target_coverage
  });

  const summary = `
Pirâmide de Testes - ${settings.product}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Unit:        ${unitTests.test_cases} testes (${unitPercent.toFixed(1)}%) [${unitTests.files_found} arquivos]
Integration: ${integrationTests.test_cases} testes (${integrationPercent.toFixed(1)}%) [${integrationTests.files_found} arquivos]
E2E:         ${e2eTests.test_cases} testes (${e2ePercent.toFixed(1)}%) [${e2eTests.files_found} arquivos]
Total:       ${totalTestCases} test cases em ${totalFiles} arquivos

Status: ${health === 'healthy' ? '✅ SAUDÁVEL' : health === 'inverted' ? '❌ INVERTIDA' : '⚠️ PRECISA ATENÇÃO'}

Arquivos sem testes: ${missingTests.length}
`;

  const result: CoverageResult = {
    summary,
    pyramid: {
      unit: {
        files_found: unitTests.files_found,
        test_cases: unitTests.test_cases,
        coverage_percent: unitTests.coverage,
        test_files: unitTests.test_files,
        missing_tests: missingTests
      },
      integration: {
        files_found: integrationTests.files_found,
        test_cases: integrationTests.test_cases,
        coverage_percent: integrationTests.coverage,
        test_files: integrationTests.test_files,
        api_endpoints_tested: integrationTests.endpoints_tested
      },
      e2e: {
        files_found: e2eTests.files_found,
        test_cases: e2eTests.test_cases,
        scenarios: e2eTests.scenarios,
        test_files: e2eTests.test_files
      }
    },
    health,
    recommendations,
    analysis_path: join('tests', 'analyses', 'coverage-analysis.json')
  };

  // Salva análise
  await writeFileSafe(
    join(settings.repo, 'tests', 'analyses', 'coverage-analysis.json'),
    JSON.stringify(result, null, 2)
  );

  // Salva relatório em markdown
  const markdown = generateCoverageMarkdown(result, settings.product);
  await writeFileSafe(
    join(settings.repo, 'tests', 'analyses', 'COVERAGE-REPORT.md'),
    markdown
  );

  console.log(`✅ Análise de cobertura completa!`);
  console.log(summary);

  return result;
}

function countTestCasesInFile(content: string, language: string): number {
  // Remove comentários e strings para evitar falsos positivos
  const cleanContent = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments  
    .replace(/\/\/.*/g, '') // Remove // comments
    .replace(/#.*/g, '') // Remove # comments (Python, Ruby)
    .replace(/'[^']*'/g, "''") // Remove single-quoted strings
    .replace(/"[^"]*"/g, '""') // Remove double-quoted strings
    .replace(/`[^`]*`/g, '``'); // Remove template literals

  let count = 0;
  const lines = cleanContent.split('\n');

  switch (language) {
    case 'javascript':
    case 'typescript':
      // Conta it( e test( no início de linhas
      for (const line of lines) {
        if (line.match(/^\s*(it|test)\s*\(/)) {
          count++;
        }
      }
      break;

    case 'go':
      // func TestXxx(t *testing.T)
      for (const line of lines) {
        if (line.match(/^\s*func\s+Test\w+\s*\(/)) {
          count++;
        }
      }
      break;

    case 'java':
    case 'kotlin':
      // @Test
      const javaMatches = content.match(/@Test\s/g);
      count = javaMatches ? javaMatches.length : 0;
      break;

    case 'python':
      // def test_xxx():
      for (const line of lines) {
        if (line.match(/^\s*def\s+test_\w+\s*\(/)) {
          count++;
        }
      }
      break;

    case 'ruby':
      // it "..." do
      for (const line of lines) {
        if (line.match(/^\s*(it|test)\s+["']/)) {
          count++;
        }
      }
      break;

    case 'csharp':
      // [Test] ou [Fact]
      const csharpMatches = content.match(/\[(Test|Fact)\]/g);
      count = csharpMatches ? csharpMatches.length : 0;
      break;

    case 'php':
      // public function testXxx()
      for (const line of lines) {
        if (line.match(/^\s*public\s+function\s+test\w+\s*\(/)) {
          count++;
        }
      }
      break;

    case 'rust':
      // #[test]
      const rustMatches = content.match(/#\[test\]/g);
      count = rustMatches ? rustMatches.length : 0;
      break;

    default:
      // Fallback para padrão JS/TS
      for (const line of lines) {
        if (line.match(/^\s*(it|test)\s*\(/)) {
          count++;
        }
      }
  }

  return count;
}

async function detectUnitTests(repoPath: string, language: string) {
  // Padrões de teste por linguagem
  const testPatterns: Record<string, string[]> = {
    'javascript': [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/__tests__/**/*.{ts,tsx,js,jsx}'
    ],
    'typescript': [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/__tests__/**/*.{ts,tsx,js,jsx}'
    ],
    'go': [
      '**/*_test.go'
    ],
    'java': [
      '**/*Test.java',
      '**/*Tests.java',
      '**/src/test/**/*.java'
    ],
    'kotlin': [
      '**/*Test.kt',
      '**/*Tests.kt',
      '**/src/test/**/*.kt'
    ],
    'python': [
      '**/test_*.py',
      '**/*_test.py',
      '**/tests/**/*.py'
    ],
    'ruby': [
      '**/*_spec.rb',
      '**/spec/**/*.rb'
    ],
    'csharp': [
      '**/*Test.cs',
      '**/*Tests.cs'
    ],
    'php': [
      '**/*Test.php',
      '**/tests/**/*.php'
    ],
    'rust': [
      '**/*_test.rs',
      '**/tests/**/*.rs'
    ]
  };

  const patterns = testPatterns[language] || testPatterns['javascript'];
  
  let allTests: string[] = [];
  
  for (const pattern of patterns) {
    const tests = await glob(pattern, {
      cwd: repoPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/target/**', '**/e2e/**', '**/integration/**', '**/.venv/**', '**/vendor/**']
    });
    allTests.push(...tests);
  }

  allTests = [...new Set(allTests)];
  console.log(`🔍 [${language}] Arquivos de teste encontrados: ${allTests.length}`);
  if (allTests.length > 0) {
    console.log(`📁 Primeiros 5 arquivos: ${allTests.slice(0, 5).join(', ')}`);
  }

  // Conta test cases individuais nos arquivos
  let totalTestCases = 0;
  for (const testFile of allTests) {
    const content = await readFile(join(repoPath, testFile)).catch(() => '');
    totalTestCases += countTestCasesInFile(content, language);
  }

  // Tenta detectar cobertura existente
  let coverage: number | undefined;
  const coveragePath = join(repoPath, 'coverage', 'coverage-summary.json');
  if (await fileExists(coveragePath)) {
    try {
      const coverageData = JSON.parse(await readFile(coveragePath));
      coverage = coverageData.total?.lines?.pct;
    } catch (e) {
      // Ignora erros
    }
  }

  return {
    files_found: allTests.length,
    test_cases: totalTestCases,
    test_files: allTests,
    coverage
  };
}

async function detectIntegrationTests(repoPath: string, language: string) {
  let integrationTests: string[] = [];

  // Padrões específicos por linguagem
  switch (language) {
    case 'javascript':
    case 'typescript':
      integrationTests = await glob('**/{integration,api}/**/*.{test,spec}.{ts,tsx,js,jsx}', {
        cwd: repoPath,
        ignore: ['**/node_modules/**', '**/dist/**']
      });
      break;

    case 'go':
      // Go normalmente coloca testes de integração junto com _test.go
      // mas podemos procurar por arquivos que chamam testing.Short()
      integrationTests = await glob('**/*_integration_test.go', {
        cwd: repoPath,
        ignore: ['**/vendor/**']
      });
      break;

    case 'java':
    case 'kotlin':
      integrationTests = await glob('**/src/test/**/integration/**/*.{java,kt}', {
        cwd: repoPath,
        ignore: ['**/target/**', '**/build/**']
      });
      break;

    case 'python':
      integrationTests = await glob('**/tests/integration/**/*.py', {
        cwd: repoPath,
        ignore: ['**/.venv/**', '**/venv/**', '**/__pycache__/**']
      });
      break;

    case 'ruby':
      integrationTests = await glob('**/spec/integration/**/*_spec.rb', {
        cwd: repoPath,
        ignore: ['**/vendor/**']
      });
      break;

    case 'csharp':
      integrationTests = await glob('**/{Integration,IntegrationTests}/**/*Tests.cs', {
        cwd: repoPath,
        ignore: ['**/bin/**', '**/obj/**']
      });
      break;

    case 'php':
      integrationTests = await glob('**/tests/Integration/**/*Test.php', {
        cwd: repoPath,
        ignore: ['**/vendor/**']
      });
      break;

    case 'rust':
      integrationTests = await glob('**/tests/**/*.rs', {
        cwd: repoPath,
        ignore: ['**/target/**']
      });
      break;

    default:
      integrationTests = await glob('**/{integration,api}/**/*.{test,spec}.{ts,tsx,js,jsx}', {
        cwd: repoPath,
        ignore: ['**/node_modules/**', '**/dist/**']
      });
  }

  // Conta test cases individuais e endpoints testados
  let totalTestCases = 0;
  let endpointsTested = 0;
  for (const testFile of integrationTests) {
    const content = await readFile(join(repoPath, testFile)).catch(() => '');
    totalTestCases += countTestCasesInFile(content, language);
    
    // Conta quantas chamadas de API/HTTP existem
    const apiCalls = (content.match(/\.(get|post|put|patch|delete)\(/gi) || []).length;
    const httpCalls = (content.match(/(GET|POST|PUT|PATCH|DELETE|http\.NewRequest)/gi) || []).length;
    endpointsTested += Math.max(apiCalls, httpCalls);
  }

  return {
    files_found: integrationTests.length,
    test_cases: totalTestCases,
    test_files: integrationTests,
    endpoints_tested: endpointsTested,
    coverage: undefined
  };
}

async function detectE2ETests(repoPath: string, language: string) {
  let e2eTests: string[] = [];

  // Padrões específicos por linguagem
  switch (language) {
    case 'javascript':
    case 'typescript':
      e2eTests = await glob('**/{e2e,playwright,cypress}/**/*.{test,spec}.{ts,tsx,js,jsx}', {
        cwd: repoPath,
        ignore: ['**/node_modules/**', '**/dist/**']
      });
      break;

    case 'go':
      // Go pode ter testes E2E com tags
      e2eTests = await glob('**/*_e2e_test.go', {
        cwd: repoPath,
        ignore: ['**/vendor/**']
      });
      break;

    case 'java':
    case 'kotlin':
      e2eTests = await glob('**/src/test/**/e2e/**/*.{java,kt}', {
        cwd: repoPath,
        ignore: ['**/target/**', '**/build/**']
      });
      break;

    case 'python':
      e2eTests = await glob('**/tests/{e2e,end_to_end}/**/*.py', {
        cwd: repoPath,
        ignore: ['**/.venv/**', '**/venv/**', '**/__pycache__/**']
      });
      break;

    case 'ruby':
      e2eTests = await glob('**/spec/{e2e,features}/**/*_spec.rb', {
        cwd: repoPath,
        ignore: ['**/vendor/**']
      });
      break;

    case 'csharp':
      e2eTests = await glob('**/{E2E,EndToEnd}/**/*Tests.cs', {
        cwd: repoPath,
        ignore: ['**/bin/**', '**/obj/**']
      });
      break;

    case 'php':
      e2eTests = await glob('**/tests/{E2E,Feature}/**/*Test.php', {
        cwd: repoPath,
        ignore: ['**/vendor/**']
      });
      break;

    case 'rust':
      // Rust geralmente coloca todos os testes em tests/
      // E2E podem ser identificados por nome
      e2eTests = await glob('**/tests/**/*e2e*.rs', {
        cwd: repoPath,
        ignore: ['**/target/**']
      });
      break;

    default:
      e2eTests = await glob('**/{e2e,playwright,cypress}/**/*.{test,spec}.{ts,tsx,js,jsx}', {
        cwd: repoPath,
        ignore: ['**/node_modules/**', '**/dist/**']
      });
  }

  // Conta cenários (test cases individuais)
  let totalTestCases = 0;
  for (const testFile of e2eTests) {
    const content = await readFile(join(repoPath, testFile)).catch(() => '');
    totalTestCases += countTestCasesInFile(content, language);
  }

  return {
    files_found: e2eTests.length,
    test_cases: totalTestCases,
    test_files: e2eTests,
    scenarios: totalTestCases
  };
}

async function detectSourceFiles(repoPath: string, language: string) {
  const sourcePatterns: Record<string, string[]> = {
    'javascript': ['**/{src,lib,app}/**/*.{ts,tsx,js,jsx}'],
    'typescript': ['**/{src,lib,app}/**/*.{ts,tsx,js,jsx}'],
    'go': ['**/*.go'],
    'java': ['**/src/main/**/*.java'],
    'kotlin': ['**/src/main/**/*.kt'],
    'python': ['**/*.py'],
    'ruby': ['**/{lib,app}/**/*.rb'],
    'csharp': ['**/*.cs'],
    'php': ['**/{src,app}/**/*.php'],
    'rust': ['**/src/**/*.rs']
  };

  const ignorePatterns: Record<string, string[]> = {
    'javascript': ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/*.d.ts'],
    'typescript': ['**/node_modules/**', '**/dist/**', '**/*.test.*', '**/*.spec.*', '**/__tests__/**', '**/*.d.ts'],
    'go': ['**/vendor/**', '**/*_test.go'],
    'java': ['**/target/**', '**/build/**', '**/*Test.java', '**/*Tests.java'],
    'kotlin': ['**/target/**', '**/build/**', '**/*Test.kt', '**/*Tests.kt'],
    'python': ['**/.venv/**', '**/venv/**', '**/__pycache__/**', '**/test_*.py', '**/*_test.py'],
    'ruby': ['**/vendor/**', '**/*_spec.rb'],
    'csharp': ['**/bin/**', '**/obj/**', '**/*Test.cs', '**/*Tests.cs'],
    'php': ['**/vendor/**', '**/*Test.php'],
    'rust': ['**/target/**', '**/*_test.rs', '**/tests/**']
  };

  const patterns = sourcePatterns[language] || sourcePatterns['javascript'];
  const ignore = ignorePatterns[language] || ignorePatterns['javascript'];

  let sourceFiles: string[] = [];
  
  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: repoPath,
      ignore
    });
    sourceFiles.push(...files);
  }

  return [...new Set(sourceFiles)];
}

function findMissingTests(sourceFiles: string[], testFiles: string[], language: string): string[] {
  // Mapeia como os arquivos de teste são nomeados por linguagem
  const testSuffixMap: Record<string, (file: string) => string[]> = {
    'javascript': (file) => [
      file.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1'),
      file.replace(/\.(ts|tsx|js|jsx)$/, '.spec.$1'),
      file.replace(/^src\//, '__tests__/')
    ],
    'typescript': (file) => [
      file.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1'),
      file.replace(/\.(ts|tsx|js|jsx)$/, '.spec.$1'),
      file.replace(/^src\//, '__tests__/')
    ],
    'go': (file) => [
      file.replace(/\.go$/, '_test.go')
    ],
    'java': (file) => [
      file.replace(/\.java$/, 'Test.java'),
      file.replace(/\.java$/, 'Tests.java'),
      file.replace(/src\/main\//, 'src/test/')
    ],
    'kotlin': (file) => [
      file.replace(/\.kt$/, 'Test.kt'),
      file.replace(/\.kt$/, 'Tests.kt'),
      file.replace(/src\/main\//, 'src/test/')
    ],
    'python': (file) => [
      file.replace(/\.py$/, '_test.py'),
      file.replace(/([^\/]+)\.py$/, 'test_$1.py')
    ],
    'ruby': (file) => [
      file.replace(/\.rb$/, '_spec.rb'),
      file.replace(/^lib\//, 'spec/')
    ],
    'csharp': (file) => [
      file.replace(/\.cs$/, 'Test.cs'),
      file.replace(/\.cs$/, 'Tests.cs')
    ],
    'php': (file) => [
      file.replace(/\.php$/, 'Test.php'),
      file.replace(/^src\//, 'tests/')
    ],
    'rust': (file) => [
      file.replace(/\.rs$/, '_test.rs'),
      'tests/' + file
    ]
  };

  const getSuffixes = testSuffixMap[language] || testSuffixMap['javascript'];
  
  const testedFiles = new Set<string>();
  for (const testFile of testFiles) {
    // Adiciona o arquivo de teste normalizado
    testedFiles.add(testFile);
    
    // Tenta inferir o arquivo fonte do teste
    let sourceFile = testFile;
    if (language === 'javascript' || language === 'typescript') {
      sourceFile = testFile
        .replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, '.$2')
        .replace(/__tests__\//, '');
    } else if (language === 'go') {
      sourceFile = testFile.replace(/_test\.go$/, '.go');
    } else if (language === 'java' || language === 'kotlin') {
      sourceFile = testFile
        .replace(/Test\.(java|kt)$/, '.$1')
        .replace(/Tests\.(java|kt)$/, '.$1')
        .replace(/src\/test\//, 'src/main/');
    } else if (language === 'python') {
      sourceFile = testFile
        .replace(/_test\.py$/, '.py')
        .replace(/test_(.+)\.py$/, '$1.py');
    } else if (language === 'ruby') {
      sourceFile = testFile
        .replace(/_spec\.rb$/, '.rb')
        .replace(/^spec\//, 'lib/');
    } else if (language === 'csharp') {
      sourceFile = testFile.replace(/Tests?\.cs$/, '.cs');
    } else if (language === 'php') {
      sourceFile = testFile
        .replace(/Test\.php$/, '.php')
        .replace(/^tests\//, 'src/');
    } else if (language === 'rust') {
      sourceFile = testFile
        .replace(/_test\.rs$/, '.rs')
        .replace(/^tests\//, 'src/');
    }
    testedFiles.add(sourceFile);
  }

  return sourceFiles.filter(source => {
    // Verifica se o arquivo está testado
    if (testedFiles.has(source)) return false;
    
    // Verifica se alguma variante do teste existe
    const possibleTests = getSuffixes(source);
    return !possibleTests.some(test => testedFiles.has(test));
  });
}

async function getActualTestCount(repoPath: string, language: string): Promise<number | null> {
  return new Promise((resolve) => {
    let command: string;
    let args: string[];
    let outputPattern: RegExp;

    // Comandos específicos por linguagem
    switch (language) {
      case 'javascript':
      case 'typescript':
        // Tenta vitest primeiro, depois jest
        command = 'npx';
        args = ['vitest', 'run'];
        outputPattern = /Tests\s+(\d+)\s+passed/;
        break;

      case 'go':
        command = 'go';
        args = ['test', '-v', './...'];
        outputPattern = /^(=== RUN|--- PASS:|--- FAIL:)/gm; // Conta início e fim de testes
        break;

      case 'java':
        // Maven ou Gradle
        command = 'mvn';
        args = ['test', '-q'];
        outputPattern = /Tests run: (\d+)/;
        break;

      case 'kotlin':
        command = './gradlew';
        args = ['test', '--quiet'];
        outputPattern = /(\d+) tests completed/;
        break;

      case 'python':
        command = 'pytest';
        args = ['--collect-only', '-q'];
        outputPattern = /(\d+) tests? collected/;
        break;

      case 'ruby':
        command = 'rspec';
        args = ['--format', 'documentation'];
        outputPattern = /(\d+) examples?/;
        break;

      case 'csharp':
        command = 'dotnet';
        args = ['test', '--verbosity', 'quiet'];
        outputPattern = /Passed!\s+-\s+Failed:\s+0,\s+Passed:\s+(\d+)/;
        break;

      case 'php':
        command = './vendor/bin/phpunit';
        args = ['--testdox'];
        outputPattern = /Tests:\s+(\d+)/;
        break;

      case 'rust':
        command = 'cargo';
        args = ['test', '--', '--nocapture'];
        outputPattern = /test result:.+?(\d+)\s+passed/;
        break;

      default:
        // Fallback para vitest
        command = 'npx';
        args = ['vitest', 'run'];
        outputPattern = /Tests\s+(\d+)\s+passed/;
    }

    const testProcess = spawn(command, args, {
      cwd: repoPath,
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    
    testProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    testProcess.stderr?.on('data', (data) => {
      output += data.toString();
    });

    testProcess.on('close', () => {
      const match = output.match(outputPattern);
      if (match) {
        if (language === 'go') {
          // Para Go, usa o resultado já capturado e conta apenas "--- PASS:" e "--- FAIL:"
          const testResults = output.match(/^--- (PASS|FAIL):/gm);
          resolve(testResults ? testResults.length : null);
        } else {
          // Para outras linguagens, extrai o número
          resolve(parseInt(match[1], 10));
        }
      } else {
        resolve(null);
      }
    });

    testProcess.on('error', () => {
      resolve(null);
    });

    // Timeout de 60 segundos (testes multi-linguagem podem demorar mais)
    setTimeout(() => {
      testProcess.kill();
      resolve(null);
    }, 60000);
  });
}

function generateRecommendations(data: {
  unitPercent: number;
  integrationPercent: number;
  e2ePercent: number;
  missingTests: string[];
  targets?: { unit?: number; integration?: number; e2e?: number };
}): string[] {
  const recs: string[] = [];

  // Recomendações baseadas na proporção
  if (data.e2ePercent > data.unitPercent) {
    recs.push('🚨 PIRÂMIDE INVERTIDA: Você tem mais testes E2E do que unitários. Priorize criar testes unitários.');
  }

  if (data.unitPercent < 60) {
    recs.push(`📈 Aumente a cobertura de testes unitários. Atual: ${data.unitPercent.toFixed(1)}%, Ideal: 70%`);
  }

  if (data.e2ePercent > 20) {
    recs.push(`⚠️ Muitos testes E2E (${data.e2ePercent.toFixed(1)}%). Considere converter alguns em testes de integração.`);
  }

  if (data.missingTests.length > 0) {
    recs.push(`📝 ${data.missingTests.length} arquivos sem testes. Execute 'quality scaffold-unit' para gerar.`);
  }

  if (data.integrationPercent < 15) {
    recs.push('🔗 Considere adicionar mais testes de integração/API para o meio da pirâmide.');
  }

  // Recomendações baseadas em targets
  if (data.targets?.unit && data.unitPercent < data.targets.unit) {
    recs.push(`🎯 Meta de cobertura unit: ${data.targets.unit}% (atual: ${data.unitPercent.toFixed(1)}%)`);
  }

  if (recs.length === 0) {
    recs.push('✅ Pirâmide de testes está saudável! Continue mantendo as boas práticas.');
  }

  return recs;
}

function generateCoverageMarkdown(result: CoverageResult, product: string): string {
  const { pyramid, health, recommendations } = result;
  
  const totalTestCases = pyramid.unit.test_cases + pyramid.integration.test_cases + pyramid.e2e.test_cases;
  const totalFiles = pyramid.unit.files_found + pyramid.integration.files_found + pyramid.e2e.files_found;
  const unitPct = totalTestCases > 0 ? ((pyramid.unit.test_cases / totalTestCases) * 100).toFixed(1) : '0';
  const intPct = totalTestCases > 0 ? ((pyramid.integration.test_cases / totalTestCases) * 100).toFixed(1) : '0';
  const e2ePct = totalTestCases > 0 ? ((pyramid.e2e.test_cases / totalTestCases) * 100).toFixed(1) : '0';

  return `# Análise da Pirâmide de Testes - ${product}

**Data:** ${new Date().toISOString().split('T')[0]}

## 📊 Visão Geral

| Camada | Test Cases | Arquivos | Proporção | Status |
|--------|-----------|----------|-----------|--------|
| **Unit** | ${pyramid.unit.test_cases} | ${pyramid.unit.files_found} | ${unitPct}% | ${pyramid.unit.test_cases >= 10 ? '✅' : '⚠️'} |
| **Integration** | ${pyramid.integration.test_cases} | ${pyramid.integration.files_found} | ${intPct}% | ${pyramid.integration.test_cases >= 3 ? '✅' : '⚠️'} |
| **E2E** | ${pyramid.e2e.test_cases} | ${pyramid.e2e.files_found} | ${e2ePct}% | ${pyramid.e2e.test_cases >= 1 ? '✅' : '⚠️'} |
| **TOTAL** | **${totalTestCases}** | **${totalFiles}** | **100%** | **${health === 'healthy' ? '✅' : '⚠️'}** |

## 🏥 Saúde da Pirâmide

**Status:** ${
  health === 'healthy' ? '✅ SAUDÁVEL' :
  health === 'inverted' ? '❌ INVERTIDA (precisa correção urgente)' :
  '⚠️ PRECISA ATENÇÃO'
}

### Pirâmide Ideal vs Atual

\`\`\`
IDEAL                  ATUAL
  ▲                      ${parseFloat(e2ePct) >= 30 ? '▼' : '▲'}
 / \\                    ${parseFloat(e2ePct) >= 30 ? '/ \\' : '/ \\'}
/E2E\\  10%            /E2E\\  ${e2ePct}%
────────              ────────
 /INT\\  20%           /INT\\  ${intPct}%
────────              ────────
/UNIT\\  70%          /UNIT\\  ${unitPct}%
────────              ────────
\`\`\`

## 📈 Detalhamento por Camada

### Base: Testes Unitários

- **Test Cases:** ${pyramid.unit.test_cases}
- **Arquivos:** ${pyramid.unit.files_found}
- **Cobertura:** ${pyramid.unit.coverage_percent ? pyramid.unit.coverage_percent.toFixed(1) + '%' : 'N/A'}
- **Arquivos sem testes:** ${pyramid.unit.missing_tests.length}

${pyramid.unit.missing_tests.length > 0 ? `
**Top 5 arquivos prioritários para testar:**
${pyramid.unit.missing_tests.slice(0, 5).map(f => `- \`${f}\``).join('\n')}

Execute: \`quality scaffold-unit --files "${pyramid.unit.missing_tests.slice(0, 5).join(',').replace(/,/g, ' ')}"\`
` : ''}

### Meio: Testes de Integração

- **Test Cases:** ${pyramid.integration.test_cases}
- **Arquivos:** ${pyramid.integration.files_found}
- **Endpoints testados:** ${pyramid.integration.api_endpoints_tested}
- **Cobertura de API:** ${pyramid.integration.api_endpoints_tested > 0 ? '✅' : '⚠️ Nenhum endpoint testado'}

${pyramid.integration.files_found === 0 ? `
**Ação recomendada:**
\`\`\`bash
quality scaffold-integration --repo . --product "${product}"
\`\`\`
` : ''}

### Topo: Testes E2E

- **Test Cases:** ${pyramid.e2e.test_cases}
- **Arquivos:** ${pyramid.e2e.files_found}
- **Cenários:** ${pyramid.e2e.scenarios}
- **Média por arquivo:** ${pyramid.e2e.files_found > 0 ? (pyramid.e2e.test_cases / pyramid.e2e.files_found).toFixed(1) : '0'}

## 💡 Recomendações

${recommendations.map(r => `- ${r}`).join('\n')}

## 🎯 Plano de Ação

### Curto Prazo (1 semana)

1. [ ] Criar testes unitários para os 5 arquivos prioritários
2. [ ] ${pyramid.integration.files_found === 0 ? 'Adicionar pelo menos 3 testes de integração' : 'Aumentar cobertura de integração em 20%'}
3. [ ] ${pyramid.e2e.files_found === 0 ? 'Criar cenários E2E principais' : 'Revisar testes E2E existentes'}

### Médio Prazo (1 mês)

1. [ ] Atingir 70% de testes unitários
2. [ ] Atingir 20% de testes de integração
3. [ ] Manter 10% de testes E2E
4. [ ] Configurar CI para validar proporções

### Longo Prazo (3 meses)

1. [ ] Cobertura unitária > 80%
2. [ ] Contract testing entre serviços
3. [ ] Automação completa do pipeline
4. [ ] Dashboard de métricas em tempo real

## 📚 Recursos

- [Guia de Testes Unitários](../docs/unit-testing-guide.md)
- [Guia de Testes de Integração](../docs/integration-testing-guide.md)
- [Guia de Testes E2E](../docs/e2e-testing-guide.md)
- [Pirâmide de Testes - Martin Fowler](https://martinfowler.com/articles/practical-test-pyramid.html)

---

**Gerado por:** Quality MCP v0.2.0  
**Timestamp:** ${new Date().toISOString()}
`;
}
