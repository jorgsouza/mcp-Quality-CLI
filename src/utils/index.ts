/**
 * Utils barrel export
 * Centraliza exports de módulos utilitários
 */

// Configuration management
export {
  MCPSettingsSchema,
  loadMCPSettings,
  mergeSettings,
  createMCPSettingsTemplate,
  inferProductFromPackageJson,
  type MCPSettings
} from './config.js';

// Filesystem utilities
export {
  fileExists,
  readFile,
  writeFileSafe
} from './fs.js';

// Risk calculation
export {
  calculateRiskScore,
  type RiskFactors
} from './risk-calculator.js';

// Path management (NOVO - FASE 1)
export {
  getPaths,
  ensurePaths,
  isWithinQARoot,
  getOutputPath,
  getRelativePath,
  type QAPaths
} from './paths.js';
