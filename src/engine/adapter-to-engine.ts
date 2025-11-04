/**
 * Adapter-to-Engine Wrapper
 * 
 * Converte os novos LanguageAdapter (src/adapters/) 
 * para o formato esperado pelo Engine (src/engine/capabilities.ts)
 * 
 * Permite usar os adapters modernos (TypeScript, Python, Go, Java)
 * no engine antigo sem refatoração completa.
 */

import type { LanguageAdapter as EngineAdapter } from './capabilities.js';
import type { LanguageAdapter as ModernAdapter } from '../adapters/base/LanguageAdapter.js';
import { typescriptAdapter } from '../adapters/typescript.js';
import { pythonAdapter } from '../adapters/python.js';
import { goAdapter } from '../adapters/go.js';
import { javaAdapter } from '../adapters/java.js';

/**
 * Converte ModernAdapter para EngineAdapter
 */
export function wrapAdapterForEngine(modern: ModernAdapter): EngineAdapter {
  return {
    language: modern.language,
    frameworks: [modern.language], // Simplificação temporária
    
    // Capabilities implementadas pelos adapters modernos
    capabilities: {
      // Funções básicas suportadas pelos novos adapters
      functions: async (repo: string) => {
        // Implementação básica - pode ser expandida
        return [];
      },
      tests: async (repo: string) => {
        const testFiles = await modern.discoverTests(repo);
        return testFiles.map(f => ({
          name: f.path.split('/').pop() || 'unknown',
          filePath: f.path,
          targetFunction: undefined,
          assertions: [],
          hasSpies: false,
          hasMocks: false,
        }));
      },
      coverage: async (repo: string) => {
        // Implementação via runTests com coverage
        const result = await modern.runTests(repo, { coverage: true });
        return {
          lines: result.coverage?.lines.pct || 0,
          branches: result.coverage?.branches.pct || 0,
          functions: result.coverage?.functions.pct || 0,
          statements: result.coverage?.statements.pct || 0,
          uncoveredLines: [],
        };
      },
    },
    
    detect: async (repo: string) => {
      try {
        const framework = await modern.detectFramework(repo);
        return framework !== null;
      } catch {
        return false;
      }
    },
    
    detectFramework: async (repo: string) => {
      try {
        const framework = await modern.detectFramework(repo);
        return framework?.name || null;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Lista de todos os adapters modernos convertidos para o engine
 */
export function getAllEngineAdapters(): EngineAdapter[] {
  return [
    wrapAdapterForEngine(typescriptAdapter),
    wrapAdapterForEngine(pythonAdapter),
    wrapAdapterForEngine(goAdapter),
    wrapAdapterForEngine(javaAdapter),
  ];
}

/**
 * Obtém adapter específico por linguagem
 */
export function getEngineAdapter(language: string): EngineAdapter | null {
  const adapters: Record<string, ModernAdapter> = {
    typescript: typescriptAdapter,
    javascript: typescriptAdapter,
    python: pythonAdapter,
    go: goAdapter,
    java: javaAdapter,
  };
  
  const modern = adapters[language.toLowerCase()];
  return modern ? wrapAdapterForEngine(modern) : null;
}

