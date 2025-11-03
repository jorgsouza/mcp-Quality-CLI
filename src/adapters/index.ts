import type { LanguageAdapter } from './base-adapter.js';
import { TypeScriptAdapter } from './typescript-adapter.js';
import { PythonAdapter } from './python-adapter.js';
import { detectLanguage } from '../detectors/language.js';

/**
 * Factory para criar adapter correto baseado na linguagem detectada
 */
export async function getLanguageAdapter(repoPath: string): Promise<LanguageAdapter> {
  const detection = await detectLanguage(repoPath);
  
  switch (detection.primary) {
    case 'python':
      return new PythonAdapter();
    
    case 'typescript':
    case 'javascript':
      return new TypeScriptAdapter();
    
    // TODO: Adicionar mais adapters conforme necessário
    // case 'java':
    //   return new JavaAdapter();
    // case 'go':
    //   return new GoAdapter();
    // case 'ruby':
    //   return new RubyAdapter();
    
    default:
      console.warn(`⚠️  Adapter para '${detection.primary}' não implementado. Usando TypeScript como fallback.`);
      return new TypeScriptAdapter();
  }
}

/**
 * Cria adapter específico por nome de linguagem
 */
export function createAdapter(language: string): LanguageAdapter {
  switch (language.toLowerCase()) {
    case 'python':
      return new PythonAdapter();
    
    case 'typescript':
    case 'javascript':
      return new TypeScriptAdapter();
    
    default:
      throw new Error(`Adapter para linguagem '${language}' não implementado`);
  }
}

// Re-export types e classes
export type { LanguageAdapter, TestGenerationOptions, TestScenario } from './base-adapter.js';
export { TypeScriptAdapter } from './typescript-adapter.js';
export { PythonAdapter } from './python-adapter.js';
