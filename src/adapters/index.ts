/**
 * Adapters Module - Exportações Públicas
 * 
 * Este módulo exporta todos os adapters e utilitários para detecção
 * e uso de linguagens suportadas.
 * 
 * @module adapters
 */

// Base types
export type {
  LanguageAdapter,
  Framework,
  TestFile,
  RunOptions,
  TestResult,
  TestFailure,
  Coverage,
  CoverageMetric,
  FileCoverage,
  MutationResult,
  Mutation,
  TestTarget,
  AdapterFactory,
  LanguageDetection,
} from './base/LanguageAdapter.js';

// Adapters concretos
export { TypeScriptAdapter, typescriptAdapter } from './typescript.js';
export { PythonAdapter, pythonAdapter } from './python.js';
export { GoAdapter, goAdapter } from './go.js';
export { JavaAdapter, javaAdapter } from './java.js';

// Factory e utilities
export {
  detectLanguage,
  createAdapter,
  getAdapter,
  getAllAdapters,
  registerAdapter,
  isRepositorySupported,
  getSupportedLanguages,
} from './adapter-factory.js';

// Alias para compatibilidade com código legado
export { getAdapter as getLanguageAdapter } from './adapter-factory.js';

// Bridge functions para compatibilidade
export {
  runTestsWithAdapter,
  parseCoverageWithAdapter,
  validateEnvironmentWithAdapter,
  discoverTestsWithAdapter,
  scaffoldTestWithAdapter,
  runMutationWithAdapter,
  detectFrameworkWithAdapter,
  detectLanguageCompatible,
} from './adapter-bridge.js';
