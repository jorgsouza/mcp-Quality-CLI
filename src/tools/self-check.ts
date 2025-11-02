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

interface CheckResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  fix?: string;
}

interface SelfCheckOptions {
  repo: string;
  fix?: boolean;
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
  
  // 2. Verificar permissões de escrita
  results.push(await checkWritePermissions(options.repo));
  
  // 3. Verificar test runner (vitest/jest)
  results.push(await checkTestRunner(options.repo));
  
  // 4. Verificar stryker
  results.push(await checkStryker(options.repo));
  
  // 5. Verificar git
  results.push(await checkGit(options.repo));
  
  // 6. Verificar estrutura de diretórios
  results.push(await checkDirectoryStructure(options.repo));
  
  // Aplicar fixes se solicitado
  if (options.fix) {
    if (isCLI) {
      console.log('\n🔧 Tentando corrigir problemas...\n');
    }
    await applyFixes(results, options.repo);
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
 * Verifica permissões de escrita no diretório de análises
 * TODO [FASE 4]: Receber product para verificar qa/<product>/tests/analyses
 */
async function checkWritePermissions(repo: string): Promise<CheckResult> {
  // [FASE 2] Por enquanto ainda usa tests/analyses (self-check não recebe product)
  const testDir = join(repo, 'tests', 'analyses');
  
  try {
    // Tentar criar diretório se não existir
    if (!existsSync(testDir)) {
      await mkdir(testDir, { recursive: true });
    }
    
    // Tentar escrever arquivo de teste
    await access(testDir, constants.W_OK);
    
    return {
      name: 'Permissões de Escrita',
      status: 'ok',
      message: `Pode escrever em ${testDir}`,
    };
  } catch (error) {
    return {
      name: 'Permissões de Escrita',
      status: 'error',
      message: `Sem permissão para escrever em ${testDir}`,
      fix: `chmod u+w ${testDir} ou execute com sudo (não recomendado)`,
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
 */
async function checkDirectoryStructure(repo: string): Promise<CheckResult> {
  const requiredDirs = [
    'src',
    'tests',
    'tests/analyses',
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
 * Aplica fixes automaticamente
 */
async function applyFixes(results: CheckResult[], repo: string): Promise<void> {
  for (const result of results) {
    if (result.status === 'warning' && result.name === 'Estrutura de Diretórios') {
      // Criar diretórios faltantes
      const dirs = ['src', 'tests', 'tests/analyses'];
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

export default selfCheck;
