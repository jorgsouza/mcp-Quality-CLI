/**
 * Interface base para adapters de linguagem
 * Cada linguagem implementa essa interface com suas especificidades
 */
export interface LanguageAdapter {
  /** Nome da linguagem (python, typescript, java, etc.) */
  language: string;
  
  /** Framework de teste padrão (pytest, vitest, junit, etc.) */
  defaultFramework: string;
  
  /**
   * Gera template de teste unitário
   * @param functionName - Nome da função a ser testada
   * @param filePath - Caminho do arquivo fonte
   * @param options - Opções adicionais
   */
  generateUnitTest(functionName: string, filePath: string, options?: TestGenerationOptions): string;
  
  /**
   * Gera template de teste de integração
   * @param componentName - Nome do componente/módulo
   * @param options - Opções adicionais
   */
  generateIntegrationTest(componentName: string, options?: TestGenerationOptions): string;
  
  /**
   * Gera template de teste E2E
   * @param scenarioName - Nome do cenário
   * @param options - Opções adicionais
   */
  generateE2ETest(scenarioName: string, options?: TestGenerationOptions): string;
  
  /**
   * Retorna extensão do arquivo de teste
   * Ex: .test.ts, _test.py, Test.java
   */
  getTestFileExtension(): string;
  
  /**
   * Retorna padrões de arquivos de teste
   * Ex: **\/*.test.ts, test_*.py, *Test.java
   */
  getTestPatterns(): string[];
  
  /**
   * Retorna comando para rodar testes
   * Ex: npm test, pytest, mvn test
   */
  getTestCommand(): string;
  
  /**
   * Retorna comando para rodar coverage
   * Ex: npm run test:coverage, pytest --cov, mvn jacoco:report
   */
  getCoverageCommand(): string;
  
  /**
   * Retorna path do arquivo de coverage
   * Ex: coverage/coverage-summary.json, coverage.xml
   */
  getCoverageFile(): string;
}

export interface TestGenerationOptions {
  /** Framework específico (opcional, usa default se não informado) */
  framework?: string;
  
  /** Incluir imports/requires necessários */
  includeImports?: boolean;
  
  /** Incluir comentários explicativos */
  includeComments?: boolean;
  
  /** Cenários a gerar (happy, error, edge) */
  scenarios?: ('happy' | 'error' | 'edge' | 'side')[];
  
  /** Metadados adicionais */
  metadata?: Record<string, any>;
}

export interface TestScenario {
  name: string;
  description: string;
  code: string;
}
