/**
 * test-framework.ts
 * Detecta o framework de testes usado no projeto
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export type TestFramework = 'vitest' | 'jest' | 'mocha' | 'playwright' | 'cypress' | 'ava' | 'jasmine' | null;

/**
 * Detecta o framework de testes do projeto
 */
export async function detectTestFramework(repoPath: string): Promise<TestFramework> {
  try {
    const packageJsonPath = join(repoPath, 'package.json');
    
    if (!existsSync(packageJsonPath)) {
      return null;
    }

    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Ordem de prioridade
    if (deps.vitest) return 'vitest';
    if (deps.jest || deps['@types/jest']) return 'jest';
    if (deps['@playwright/test']) return 'playwright';
    if (deps.cypress) return 'cypress';
    if (deps.mocha) return 'mocha';
    if (deps.ava) return 'ava';
    if (deps.jasmine || deps['jasmine-core']) return 'jasmine';

    // Fallback: procurar por arquivos de configuração
    if (existsSync(join(repoPath, 'vitest.config.ts')) || 
        existsSync(join(repoPath, 'vitest.config.js'))) {
      return 'vitest';
    }

    if (existsSync(join(repoPath, 'jest.config.js')) || 
        existsSync(join(repoPath, 'jest.config.ts'))) {
      return 'jest';
    }

    if (existsSync(join(repoPath, 'playwright.config.ts')) || 
        existsSync(join(repoPath, 'playwright.config.js'))) {
      return 'playwright';
    }

    if (existsSync(join(repoPath, 'cypress.config.ts')) || 
        existsSync(join(repoPath, 'cypress.config.js'))) {
      return 'cypress';
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Detecta múltiplos frameworks (para projetos que usam vários)
 */
export async function detectAllTestFrameworks(repoPath: string): Promise<TestFramework[]> {
  const frameworks: TestFramework[] = [];
  
  try {
    const packageJsonPath = join(repoPath, 'package.json');
    
    if (!existsSync(packageJsonPath)) {
      return frameworks;
    }

    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (deps.vitest) frameworks.push('vitest');
    if (deps.jest || deps['@types/jest']) frameworks.push('jest');
    if (deps['@playwright/test']) frameworks.push('playwright');
    if (deps.cypress) frameworks.push('cypress');
    if (deps.mocha) frameworks.push('mocha');
    if (deps.ava) frameworks.push('ava');
    if (deps.jasmine || deps['jasmine-core']) frameworks.push('jasmine');

    return frameworks;
  } catch (error) {
    return frameworks;
  }
}

