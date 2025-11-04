/**
 * 🔍 Self-Check: Verifica ambiente e dependências
 * 
 * Valida:
 * - Node version
 * - Permissões de escrita
 * - Presença de vitest/jest
 * - Presença de stryker
 * - Outros pré-requisitos
 */

import { existsSync } from 'node:fs';
import { access, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { writeFileSafe } from '../utils/fs.js';

interface CheckResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  fix?: string;
}

interface SelfCheckOptions {
  repo: string;
  product?: string;  // [FASE 4] Para verificar permissões em qa/<product>/
  fix?: boolean;
  bootstrapDeps?: boolean;  // [FASE D.2] Gerar scripts de instalação
}

export interface SelfCheckResult {
  ok: boolean;
  results: CheckResult[];
  summary: {
    ok: number;
    warnings: number;
    errors: number;
  };
}

/**
 * 🔍 Executa self-check do ambiente
 */
export async function selfCheck(options: SelfCheckOptions): Promise<SelfCheckResult> {
  const isCLI = process.env.CLI_MODE === 'true';
  
  if (isCLI) {
    console.log('🔍 MCP Quality CLI - Self-Check\n');
  }
  
  const results: CheckResult[] = [];
  
  // 1. Verificar Node version
  results.push(await checkNodeVersion());
  
  // 2. Verificar npm version
  results.push(await checkNpmVersion());
  
  // 3. Verificar permissões de escrita
  results.push(await checkWritePermissions(options.repo, options.product));
  
  // 4. Verificar test runner (vitest/jest)
  results.push(await checkTestRunner(options.repo));
  
  // 5. Verificar stryker
  results.push(await checkStryker(options.repo));
  
  // 6. Verificar git
  results.push(await checkGit(options.repo));
  
  // 7. Verificar estrutura de diretórios
  results.push(await checkDirectoryStructure(options.repo));
  
  // 8. [FASE 4] Verificar Playwright
  results.push(await checkPlaywright(options.repo));
  
  // 9. [FASE 4] Verificar Playwright Browsers
  results.push(await checkPlaywrightBrowsers());
  
  // 10. [FASE D.1] Verificar Python (pytest, coverage.py, mutmut)
  results.push(await checkPython());
  results.push(await checkPytest());
  results.push(await checkPythonCoverage());
  results.push(await checkMutmut());
  
  // 11. [FASE D.1] Verificar Go (go test, gotestsum, go-mutesting)
  results.push(await checkGo());
  results.push(await checkGoTest());
  results.push(await checkGotestsum());
  results.push(await checkGoMutesting());
  
  // Aplicar fixes se solicitado
  if (options.fix) {
    if (isCLI) {
      console.log('\n🔧 Tentando corrigir problemas...\n');
    }
    await applyFixes(results, options.repo);
  }
  
  // [FASE D.2] Gerar scripts de bootstrap se solicitado
  if (options.bootstrapDeps) {
    if (isCLI) {
      console.log('\n📦 Gerando scripts de instalação de dependências...\n');
    }
    await generateBootstrapScripts(results, options.repo);
  }
  
  // Exibir resultados APENAS no modo CLI
  if (isCLI) {
    console.log('\n📊 Resultados:\n');
  }
  
  let hasErrors = false;
  let hasWarnings = false;
  
  for (const result of results) {
    if (isCLI) {
      const icon = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} ${result.name}`);
      console.log(`   ${result.message}`);
    
      if (result.fix && result.status !== 'ok') {
        console.log(`   💡 Como corrigir: ${result.fix}`);
      }
      
      console.log('');
    }
    
    if (result.status === 'error') hasErrors = true;
    if (result.status === 'warning') hasWarnings = true;
  }
  
  // Resumo
  const okCount = results.filter(r => r.status === 'ok').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  
  if (isCLI) {
    console.log(`\n📈 Resumo: ${okCount} OK, ${warningCount} avisos, ${errorCount} erros\n`);
  }
  
  // [FASE 4] Gerar relatório SELF-CHECK.md se houver problemas
  if ((hasErrors || hasWarnings) && options.product) {
    await generateSelfCheckReport(options.repo, options.product, results);
  }
  
  if (hasErrors) {
    if (isCLI) {
      console.error('❌ Ambiente não está pronto. Corrija os erros acima.\n');
    }
    // Não fazer process.exit() quando usado via MCP Server
    // O caller (CLI ou MCP) decide o que fazer
    if (process.env.CLI_MODE === 'true') {
      process.exit(1);
    }
  } else if (hasWarnings) {
    if (isCLI) {
      console.warn('⚠️ Ambiente funcional, mas com avisos. Considere corrigir.\n');
    }
  } else {
    if (isCLI) {
      console.log('✅ Ambiente está perfeito! 🎉\n');
    }
  }
  
  // Retornar resultado para o MCP Server
  return {
    ok: !hasErrors,
    results,
    summary: {
      ok: okCount,
      warnings: warningCount,
      errors: errorCount,
    },
  };
}

/**
 * Verifica versão do Node.js
 */
async function checkNodeVersion(): Promise<CheckResult> {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  
  if (major >= 18) {
    return {
      name: 'Node.js Version',
      status: 'ok',
      message: `${version} (requerido: >=18)`,
    };
  } else {
    return {
      name: 'Node.js Version',
      status: 'error',
      message: `${version} (requerido: >=18)`,
      fix: 'Atualize Node.js: https://nodejs.org/ ou use nvm: nvm install 18',
    };
  }
}

/**
 * Verifica permissões de escrita
 * 
 * [FASE 4] Valida permissão de escrita em qa/<product>/ se product fornecido
 */
async function checkWritePermissions(repo: string, product?: string): Promise<CheckResult> {
  try {
    // Verificar permissão de escrita na raiz do repo
    await access(repo, constants.W_OK);
    
    // Se product fornecido, verificar qa/<product>/
    if (product) {
      const { getPaths } = await import('../utils/paths.js');
      const paths = getPaths(repo, product);
      
      try {
        await access(paths.root, constants.F_OK);
        await access(paths.root, constants.W_OK);
        
        return {
          name: 'Permissões de Escrita',
          status: 'ok',
          message: `Pode escrever em ${repo} e ${paths.root}`,
        };
      } catch {
        // qa/<product>/ não existe ainda, mas raiz tem permissão OK
        return {
          name: 'Permissões de Escrita',
          status: 'ok',
          message: `Pode escrever em ${repo} (qa/${product}/ será criado automaticamente)`,
        };
      }
    }
    
    return {
      name: 'Permissões de Escrita',
      status: 'ok',
      message: `Pode escrever em ${repo}`,
    };
  } catch (error) {
    return {
      name: 'Permissões de Escrita',
      status: 'error',
      message: `Sem permissão para escrever em ${repo}`,
      fix: `chmod u+w ${repo} ou execute com sudo (não recomendado)`,
    };
  }
}

/**
 * Verifica presença de test runner (vitest ou jest)
 */
async function checkTestRunner(repo: string): Promise<CheckResult> {
  const packageJson = join(repo, 'package.json');
  
  if (!existsSync(packageJson)) {
    return {
      name: 'Test Runner',
      status: 'error',
      message: 'package.json não encontrado',
      fix: 'Inicialize projeto com: npm init',
    };
  }
  
  try {
    const pkg = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(packageJson, 'utf8')));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    const hasVitest = 'vitest' in deps;
    const hasJest = 'jest' in deps || '@jest/core' in deps;
    
    if (hasVitest || hasJest) {
      const runner = hasVitest ? 'vitest' : 'jest';
      return {
        name: 'Test Runner',
        status: 'ok',
        message: `${runner} instalado`,
      };
    } else {
      return {
        name: 'Test Runner',
        status: 'error',
        message: 'Nenhum test runner encontrado (vitest ou jest)',
        fix: 'Instale vitest: npm i -D vitest @vitest/coverage-v8',
      };
    }
  } catch (error) {
    return {
      name: 'Test Runner',
      status: 'error',
      message: `Erro ao ler package.json: ${error}`,
      fix: 'Verifique se package.json é um JSON válido',
    };
  }
}

/**
 * Verifica presença do Stryker (mutation testing)
 */
async function checkStryker(repo: string): Promise<CheckResult> {
  const packageJson = join(repo, 'package.json');
  
  try {
    const pkg = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(packageJson, 'utf8')));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    const hasStryker = '@stryker-mutator/core' in deps;
    
    if (hasStryker) {
      return {
        name: 'Mutation Testing (Stryker)',
        status: 'ok',
        message: 'Stryker instalado',
      };
    } else {
      return {
        name: 'Mutation Testing (Stryker)',
        status: 'warning',
        message: 'Stryker não instalado (opcional para mutation testing)',
        fix: 'Instale stryker: npm i -D @stryker-mutator/core @stryker-mutator/vitest-runner',
      };
    }
  } catch (error) {
    return {
      name: 'Mutation Testing (Stryker)',
      status: 'warning',
      message: 'Não foi possível verificar (opcional)',
    };
  }
}

/**
 * Verifica presença do Git
 */
async function checkGit(repo: string): Promise<CheckResult> {
  try {
    execSync('git --version', { stdio: 'ignore' });
    
    const gitDir = join(repo, '.git');
    if (existsSync(gitDir)) {
      return {
        name: 'Git',
        status: 'ok',
        message: 'Git instalado e repositório inicializado',
      };
    } else {
      return {
        name: 'Git',
        status: 'warning',
        message: 'Git instalado mas repositório não inicializado',
        fix: 'Inicialize repositório: git init',
      };
    }
  } catch (error) {
    return {
      name: 'Git',
      status: 'error',
      message: 'Git não está instalado',
      fix: 'Instale Git: https://git-scm.com/downloads',
    };
  }
}

/**
 * Verifica estrutura de diretórios esperada
 * 
 * [FASE 3 FIX] NÃO cria tests/analyses na raiz!
 * Self-check valida APENAS o básico (src/, package.json)
 * A estrutura qa/<product>/ é criada automaticamente por auto.ts (init-product)
 */
async function checkDirectoryStructure(repo: string): Promise<CheckResult> {
  // [FASE 3] Verificar APENAS diretórios essenciais do projeto
  // NÃO verificar tests/analyses (estrutura antiga)
  const requiredDirs = [
    'src',  // Código-fonte
  ];
  
  const missing: string[] = [];
  
  for (const dir of requiredDirs) {
    const fullPath = join(repo, dir);
    if (!existsSync(fullPath)) {
      missing.push(dir);
    }
  }
  
  if (missing.length === 0) {
    return {
      name: 'Estrutura de Diretórios',
      status: 'ok',
      message: 'Todos os diretórios necessários existem',
    };
  } else {
    return {
      name: 'Estrutura de Diretórios',
      status: 'warning',
      message: `Diretórios faltando: ${missing.join(', ')}`,
      fix: `Crie com: mkdir -p ${missing.join(' ')}`,
    };
  }
}

/**
 * [FASE 4] Verifica versão do npm
 */
async function checkNpmVersion(): Promise<CheckResult> {
  try {
    const version = execSync('npm --version', { encoding: 'utf8' }).trim();
    const major = parseInt(version.split('.')[0], 10);
    
    if (major >= 8) {
      return {
        name: 'npm Version',
        status: 'ok',
        message: `${version} (requerido: >=8)`,
      };
    } else {
      return {
        name: 'npm Version',
        status: 'warning',
        message: `${version} (recomendado: >=8)`,
        fix: 'Atualize npm: npm install -g npm@latest',
      };
    }
  } catch (error) {
    return {
      name: 'npm Version',
      status: 'error',
      message: 'npm não está instalado',
      fix: 'Instale Node.js que inclui npm: https://nodejs.org/',
    };
  }
}

/**
 * [FASE 4] Verifica se Playwright está instalado
 */
async function checkPlaywright(repo: string): Promise<CheckResult> {
  const packageJson = join(repo, 'package.json');
  
  if (!existsSync(packageJson)) {
    return {
      name: 'Playwright',
      status: 'warning',
      message: 'package.json não encontrado (opcional para E2E)',
    };
  }
  
  try {
    const pkg = JSON.parse(await import('node:fs/promises').then(fs => fs.readFile(packageJson, 'utf8')));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    
    const hasPlaywright = '@playwright/test' in deps;
    
    if (hasPlaywright) {
      const version = deps['@playwright/test'];
      return {
        name: 'Playwright',
        status: 'ok',
        message: `Playwright instalado (${version})`,
      };
    } else {
      return {
        name: 'Playwright',
        status: 'warning',
        message: 'Playwright não instalado (opcional para E2E)',
        fix: 'Instale Playwright: npm i -D @playwright/test && npx playwright install',
      };
    }
  } catch (error) {
    return {
      name: 'Playwright',
      status: 'warning',
      message: 'Não foi possível verificar (opcional para E2E)',
    };
  }
}

/**
 * [FASE 4] Verifica se os browsers do Playwright estão instalados
 */
async function checkPlaywrightBrowsers(): Promise<CheckResult> {
  try {
    // Tentar executar playwright list-files para verificar browsers
    execSync('npx playwright --version', { stdio: 'ignore' });
    
    // Se chegou aqui, playwright está no PATH e browsers devem estar OK
    return {
      name: 'Playwright Browsers',
      status: 'ok',
      message: 'Browsers do Playwright parecem estar instalados',
    };
  } catch (error) {
    return {
      name: 'Playwright Browsers',
      status: 'warning',
      message: 'Browsers do Playwright podem não estar instalados',
      fix: 'Instale browsers: npx playwright install',
    };
  }
}

/**
 * [FASE 4] Gera relatório SELF-CHECK.md quando há problemas
 */
async function generateSelfCheckReport(
  repo: string,
  product: string,
  results: CheckResult[]
): Promise<void> {
  const { getPaths } = await import('../utils/paths.js');
  const { writeFileSafe } = await import('../utils/fs.js');
  
  const paths = getPaths(repo, product);
  const reportPath = join(paths.reports, 'SELF-CHECK.md');
  
  const timestamp = new Date().toISOString();
  const errors = results.filter(r => r.status === 'error');
  const warnings = results.filter(r => r.status === 'warning');
  const oks = results.filter(r => r.status === 'ok');
  
  let content = `# Self-Check Report 🔍\n\n`;
  content += `**Gerado em**: ${timestamp}\n`;
  content += `**Produto**: ${product}\n`;
  content += `**Repositório**: ${repo}\n\n`;
  
  content += `## 📊 Resumo\n\n`;
  content += `- ✅ **OK**: ${oks.length}\n`;
  content += `- ⚠️ **Avisos**: ${warnings.length}\n`;
  content += `- ❌ **Erros**: ${errors.length}\n\n`;
  
  if (errors.length > 0) {
    content += `## ❌ Erros (${errors.length})\n\n`;
    content += `**Ação requerida**: Corrija os erros abaixo antes de executar análise completa.\n\n`;
    
    for (const error of errors) {
      content += `### ${error.name}\n\n`;
      content += `**Problema**: ${error.message}\n\n`;
      if (error.fix) {
        content += `**Solução**:\n\`\`\`bash\n${error.fix}\n\`\`\`\n\n`;
      }
    }
  }
  
  if (warnings.length > 0) {
    content += `## ⚠️ Avisos (${warnings.length})\n\n`;
    content += `**Ação recomendada**: Considere corrigir os avisos para melhor experiência.\n\n`;
    
    for (const warning of warnings) {
      content += `### ${warning.name}\n\n`;
      content += `**Problema**: ${warning.message}\n\n`;
      if (warning.fix) {
        content += `**Solução**:\n\`\`\`bash\n${warning.fix}\n\`\`\`\n\n`;
      }
    }
  }
  
  if (oks.length > 0) {
    content += `## ✅ Verificações OK (${oks.length})\n\n`;
    
    for (const ok of oks) {
      content += `- **${ok.name}**: ${ok.message}\n`;
    }
    content += `\n`;
  }
  
  content += `---\n\n`;
  content += `**Próximos passos**:\n\n`;
  
  if (errors.length > 0) {
    content += `1. Corrija os ${errors.length} erro(s) listado(s) acima\n`;
    content += `2. Rode novamente: \`quality self-check --repo ${repo} --product ${product}\`\n`;
  } else if (warnings.length > 0) {
    content += `1. (Opcional) Corrija os ${warnings.length} aviso(s) listado(s) acima\n`;
    content += `2. Rode análise completa: \`quality auto --repo ${repo} --product ${product} --mode full\`\n`;
  } else {
    content += `1. ✅ Ambiente perfeito! Rode análise: \`quality auto --repo ${repo} --product ${product} --mode full\`\n`;
  }
  
  // Garantir que o diretório existe
  await mkdir(paths.reports, { recursive: true });
  
  // Escrever arquivo
  await writeFileSafe(reportPath, content);
  
  console.log(`\n📋 Relatório de self-check salvo em: ${reportPath}\n`);
}

/**
 * [FASE D.1] Verifica Python
 */
async function checkPython(): Promise<CheckResult> {
  try {
    const output = execSync('python --version || python3 --version', { encoding: 'utf-8', stdio: 'pipe' });
    const version = output.trim();
    return {
      name: 'Python',
      status: 'ok',
      message: version,
    };
  } catch {
    return {
      name: 'Python',
      status: 'warning',
      message: 'Python não encontrado (opcional para projetos Python)',
      fix: 'Instale Python: https://www.python.org/downloads/',
    };
  }
}

/**
 * [FASE D.1] Verifica pytest
 */
async function checkPytest(): Promise<CheckResult> {
  try {
    execSync('python -m pytest --version || python3 -m pytest --version', { stdio: 'pipe' });
    return {
      name: 'pytest',
      status: 'ok',
      message: 'pytest instalado',
    };
  } catch {
    return {
      name: 'pytest',
      status: 'warning',
      message: 'pytest não encontrado (necessário para projetos Python)',
      fix: 'pip install pytest pytest-cov',
    };
  }
}

/**
 * [FASE D.1] Verifica coverage.py
 */
async function checkPythonCoverage(): Promise<CheckResult> {
  try {
    execSync('python -m coverage --version || python3 -m coverage --version', { stdio: 'pipe' });
    return {
      name: 'coverage.py',
      status: 'ok',
      message: 'coverage.py instalado',
    };
  } catch {
    return {
      name: 'coverage.py',
      status: 'warning',
      message: 'coverage.py não encontrado (necessário para coverage Python)',
      fix: 'pip install coverage pytest-cov',
    };
  }
}

/**
 * [FASE D.1] Verifica mutmut
 */
async function checkMutmut(): Promise<CheckResult> {
  try {
    execSync('mutmut --version', { stdio: 'pipe' });
    return {
      name: 'mutmut',
      status: 'ok',
      message: 'mutmut instalado',
    };
  } catch {
    return {
      name: 'mutmut',
      status: 'warning',
      message: 'mutmut não encontrado (necessário para mutation testing Python)',
      fix: 'pip install mutmut',
    };
  }
}

/**
 * [FASE D.1] Verifica Go
 */
async function checkGo(): Promise<CheckResult> {
  try {
    const output = execSync('go version', { encoding: 'utf-8', stdio: 'pipe' });
    const version = output.trim();
    return {
      name: 'Go',
      status: 'ok',
      message: version,
    };
  } catch {
    return {
      name: 'Go',
      status: 'warning',
      message: 'Go não encontrado (opcional para projetos Go)',
      fix: 'Instale Go: https://golang.org/dl/',
    };
  }
}

/**
 * [FASE D.1] Verifica go test (já vem com Go)
 */
async function checkGoTest(): Promise<CheckResult> {
  try {
    execSync('go version', { stdio: 'pipe' }); // go test vem com Go
    return {
      name: 'go test',
      status: 'ok',
      message: 'go test disponível (built-in)',
    };
  } catch {
    return {
      name: 'go test',
      status: 'warning',
      message: 'go test não disponível',
      fix: 'Instale Go: https://golang.org/dl/',
    };
  }
}

/**
 * [FASE D.1] Verifica gotestsum
 */
async function checkGotestsum(): Promise<CheckResult> {
  try {
    execSync('gotestsum --version', { stdio: 'pipe' });
    return {
      name: 'gotestsum',
      status: 'ok',
      message: 'gotestsum instalado (melhor output)',
    };
  } catch {
    return {
      name: 'gotestsum',
      status: 'warning',
      message: 'gotestsum não encontrado (opcional, melhora output)',
      fix: 'go install gotest.tools/gotestsum@latest',
    };
  }
}

/**
 * [FASE D.1] Verifica go-mutesting
 */
async function checkGoMutesting(): Promise<CheckResult> {
  try {
    execSync('go-mutesting --help', { stdio: 'pipe' });
    return {
      name: 'go-mutesting',
      status: 'ok',
      message: 'go-mutesting instalado',
    };
  } catch {
    return {
      name: 'go-mutesting',
      status: 'warning',
      message: 'go-mutesting não encontrado (necessário para mutation testing Go)',
      fix: 'go install github.com/zimmski/go-mutesting/cmd/go-mutesting@latest',
    };
  }
}

/**
 * Aplica fixes automaticamente
 * 
 * [FASE 3 FIX] NÃO cria tests/analyses na raiz!
 * Apenas cria diretórios básicos (src/)
 */
async function applyFixes(results: CheckResult[], repo: string): Promise<void> {
  for (const result of results) {
    if (result.status === 'warning' && result.name === 'Estrutura de Diretórios') {
      // [FASE 3] Criar APENAS diretórios básicos do projeto
      // NÃO criar tests/analyses (estrutura antiga)
      const dirs = ['src'];  // Apenas o essencial
      for (const dir of dirs) {
        const fullPath = join(repo, dir);
        if (!existsSync(fullPath)) {
          console.log(`📁 Criando diretório: ${dir}`);
          await mkdir(fullPath, { recursive: true });
        }
      }
    }
    
    if (result.status === 'warning' && result.name === 'Git') {
      // Inicializar git
      try {
        console.log('🔧 Inicializando repositório Git...');
        execSync('git init', { cwd: repo, stdio: 'ignore' });
        console.log('✅ Git inicializado');
      } catch (error) {
        console.error(`❌ Erro ao inicializar Git: ${error}`);
      }
    }
  }
}

/**
 * [FASE D.2] Gera scripts de instalação de dependências
 * 
 * Detecta linguagem e cria scripts .sh/.bat com comandos de instalação
 */
async function generateBootstrapScripts(results: CheckResult[], repo: string): Promise<void> {
  const warnings = results.filter(r => r.status === 'warning' && r.fix);
  
  if (warnings.length === 0) {
    console.log('✅ Todas as dependências estão instaladas!');
    return;
  }
  
  // Detectar linguagem principal
  const hasTypeScript = existsSync(join(repo, 'package.json')) || existsSync(join(repo, 'tsconfig.json'));
  const hasPython = existsSync(join(repo, 'requirements.txt')) || existsSync(join(repo, 'setup.py'));
  const hasGo = existsSync(join(repo, 'go.mod'));
  
  // Script Unix (sh)
  let shScript = '#!/bin/bash\n\n';
  shScript += '# 📦 Quality MCP - Bootstrap Dependencies\n';
  shScript += '# Gerado automaticamente\n\n';
  shScript += 'set -e  # Parar em caso de erro\n\n';
  shScript += 'echo "📦 Instalando dependências..."\n\n';
  
  // Script Windows (bat)
  let batScript = '@echo off\n';
  batScript += 'REM 📦 Quality MCP - Bootstrap Dependencies\n';
  batScript += 'REM Gerado automaticamente\n\n';
  batScript += 'echo 📦 Instalando dependências...\n\n';
  
  // Agrupar por categoria
  const tsCommands: string[] = [];
  const pyCommands: string[] = [];
  const goCommands: string[] = [];
  
  for (const warning of warnings) {
    if (!warning.fix) continue;
    
    if (warning.fix.startsWith('npm') || warning.fix.startsWith('npx')) {
      tsCommands.push(warning.fix);
    } else if (warning.fix.startsWith('pip')) {
      pyCommands.push(warning.fix);
    } else if (warning.fix.startsWith('go install')) {
      goCommands.push(warning.fix);
    }
  }
  
  // TypeScript/JavaScript
  if (hasTypeScript && tsCommands.length > 0) {
    shScript += '# TypeScript/JavaScript\n';
    shScript += `echo "🔷 Instalando dependências Node.js..."\n`;
    for (const cmd of tsCommands) {
      shScript += `${cmd}\n`;
      batScript += `${cmd}\n`;
    }
    shScript += '\n';
    batScript += '\n';
  }
  
  // Python
  if (hasPython && pyCommands.length > 0) {
    shScript += '# Python\n';
    shScript += `echo "🐍 Instalando dependências Python..."\n`;
    shScript += '# Criar virtual environment (recomendado)\n';
    shScript += 'if [ ! -d "venv" ]; then\n';
    shScript += '  python3 -m venv venv\n';
    shScript += '  echo "✅ Virtual environment criado"\n';
    shScript += 'fi\n';
    shScript += 'source venv/bin/activate\n\n';
    
    batScript += 'REM Python\n';
    batScript += 'echo 🐍 Instalando dependências Python...\n';
    batScript += 'REM Criar virtual environment (recomendado)\n';
    batScript += 'if not exist "venv" (\n';
    batScript += '  python -m venv venv\n';
    batScript += '  echo ✅ Virtual environment criado\n';
    batScript += ')\n';
    batScript += 'call venv\\Scripts\\activate.bat\n\n';
    
    for (const cmd of pyCommands) {
      shScript += `${cmd}\n`;
      batScript += `${cmd}\n`;
    }
    shScript += '\n';
    batScript += '\n';
  }
  
  // Go
  if (hasGo && goCommands.length > 0) {
    shScript += '# Go\n';
    shScript += `echo "🔷 Instalando ferramentas Go..."\n`;
    for (const cmd of goCommands) {
      shScript += `${cmd}\n`;
      batScript += `${cmd}\n`;
    }
    shScript += '\n';
    batScript += '\n';
  }
  
  shScript += 'echo "✅ Todas as dependências foram instaladas!"\n';
  shScript += 'echo ""\n';
  shScript += 'echo "🎯 Próximo passo: quality auto --repo . --product YourProduct"\n';
  
  batScript += 'echo ✅ Todas as dependências foram instaladas!\n';
  batScript += 'echo.\n';
  batScript += 'echo 🎯 Próximo passo: quality auto --repo . --product YourProduct\n';
  batScript += 'pause\n';
  
  // Escrever arquivos
  const shPath = join(repo, 'bootstrap-deps.sh');
  const batPath = join(repo, 'bootstrap-deps.bat');
  
  await writeFileSafe(shPath, shScript);
  await writeFileSafe(batPath, batScript);
  
  // Dar permissão de execução no Linux/Mac
  try {
    execSync(`chmod +x "${shPath}"`, { stdio: 'ignore' });
  } catch {
    // Windows não precisa
  }
  
  console.log(`✅ Script Unix criado: ${shPath}`);
  console.log(`✅ Script Windows criado: ${batPath}`);
  console.log('');
  console.log('📋 Para instalar as dependências:');
  console.log(`   Linux/Mac: ./bootstrap-deps.sh`);
  console.log(`   Windows:   bootstrap-deps.bat`);
  console.log('');
  console.log('⚠️  IMPORTANTE: Revise os scripts antes de executá-los!');
}

export default selfCheck;
