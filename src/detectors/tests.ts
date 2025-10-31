import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';

export interface TestFile {
  path: string;
  type: 'unit' | 'integration' | 'e2e' | 'component';
  framework: string;
  testCount: number;
}

export interface TestCoverage {
  unit: TestFile[];
  integration: TestFile[];
  e2e: TestFile[];
  component: TestFile[];
  summary: {
    totalTests: number;
    unitCount: number;
    integrationCount: number;
    e2eCount: number;
    componentCount: number;
    ratio: string; // Ex: "70:20:10" (unit:integration:e2e)
  };
}

/**
 * Detecta todos os testes existentes no repositório
 */
export async function findExistingTests(repoPath: string): Promise<TestCoverage> {
  const unit: TestFile[] = [];
  const integration: TestFile[] = [];
  const e2e: TestFile[] = [];
  const component: TestFile[] = [];

  try {
    // Padrões de arquivos de teste
    const testPatterns = [
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}',
      '**/__tests__/**/*.{ts,tsx,js,jsx}'
    ];

    for (const pattern of testPatterns) {
      const files = await glob(pattern, {
        cwd: repoPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**']
      });

      for (const file of files) {
        const fullPath = join(repoPath, file);
        const content = await fs.readFile(fullPath, 'utf8');
        
        // Detecta framework
        const framework = detectFramework(content);
        
        // Conta testes
        const testCount = countTests(content);
        
        // Classifica tipo de teste
        const type = classifyTestType(file, content);
        
        const testFile: TestFile = {
          path: file,
          type,
          framework,
          testCount
        };

        // Adiciona na lista apropriada
        switch (type) {
          case 'unit':
            unit.push(testFile);
            break;
          case 'integration':
            integration.push(testFile);
            break;
          case 'e2e':
            e2e.push(testFile);
            break;
          case 'component':
            component.push(testFile);
            break;
        }
      }
    }
  } catch (error) {
    console.warn('Erro ao detectar testes existentes:', error);
  }

  // Calcula totais
  const unitCount = unit.reduce((sum, f) => sum + f.testCount, 0);
  const integrationCount = integration.reduce((sum, f) => sum + f.testCount, 0);
  const e2eCount = e2e.reduce((sum, f) => sum + f.testCount, 0);
  const componentCount = component.reduce((sum, f) => sum + f.testCount, 0);
  const totalTests = unitCount + integrationCount + e2eCount + componentCount;

  // Calcula ratio da pirâmide
  const ratio = calculatePyramidRatio(unitCount, integrationCount, e2eCount);

  return {
    unit,
    integration,
    e2e,
    component,
    summary: {
      totalTests,
      unitCount,
      integrationCount,
      e2eCount,
      componentCount,
      ratio
    }
  };
}

/**
 * Detecta o framework de teste usado
 */
function detectFramework(content: string): string {
  if (content.includes('@playwright/test')) return 'playwright';
  if (content.includes('vitest')) return 'vitest';
  if (content.includes('@testing-library/react')) return 'react-testing-library';
  if (content.includes('jest')) return 'jest';
  if (content.includes('mocha')) return 'mocha';
  if (content.includes('cypress')) return 'cypress';
  if (content.includes('supertest')) return 'supertest';
  return 'unknown';
}

/**
 * Conta número de testes no arquivo
 */
function countTests(content: string): number {
  const testRegex = /\b(test|it)\s*\(/g;
  const matches = content.match(testRegex);
  return matches ? matches.length : 0;
}

/**
 * Classifica o tipo de teste baseado no caminho e conteúdo
 */
function classifyTestType(filePath: string, content: string): 'unit' | 'integration' | 'e2e' | 'component' {
  const lowerPath = filePath.toLowerCase();
  
  // E2E
  if (lowerPath.includes('e2e') || 
      lowerPath.includes('playwright') || 
      lowerPath.includes('cypress') ||
      content.includes('@playwright/test') ||
      content.includes('cy.visit')) {
    return 'e2e';
  }
  
  // Integration
  if (lowerPath.includes('integration') ||
      lowerPath.includes('api') ||
      content.includes('supertest') ||
      content.includes('request(app)') ||
      content.includes('testcontainers')) {
    return 'integration';
  }
  
  // Component
  if ((lowerPath.includes('component') || lowerPath.includes('components/')) &&
      (content.includes('render(') || content.includes('mount('))) {
    return 'component';
  }
  
  // Unit (padrão)
  return 'unit';
}

/**
 * Calcula o ratio da pirâmide de testes
 */
function calculatePyramidRatio(unit: number, integration: number, e2e: number): string {
  const total = unit + integration + e2e;
  
  if (total === 0) return '0:0:0';
  
  const unitPct = Math.round((unit / total) * 100);
  const integrationPct = Math.round((integration / total) * 100);
  const e2ePct = Math.round((e2e / total) * 100);
  
  return `${unitPct}:${integrationPct}:${e2ePct}`;
}

/**
 * Verifica se a pirâmide está saudável
 */
export function isPyramidHealthy(coverage: TestCoverage): {
  healthy: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  const { unitCount, integrationCount, e2eCount } = coverage.summary;
  const total = unitCount + integrationCount + e2eCount;
  
  if (total === 0) {
    issues.push('Nenhum teste detectado no repositório');
    recommendations.push('Comece criando testes unitários para funções críticas');
    return { healthy: false, issues, recommendations };
  }
  
  // Verifica proporções (ideal: 70% unit, 20% integration, 10% e2e)
  const unitPct = (unitCount / total) * 100;
  const integrationPct = (integrationCount / total) * 100;
  const e2ePct = (e2eCount / total) * 100;
  
  // Pirâmide invertida (anti-pattern)
  if (e2ePct > unitPct) {
    issues.push('⚠️ Pirâmide INVERTIDA: mais testes E2E que unitários');
    recommendations.push('Priorize criação de testes unitários para balancear a pirâmide');
  }
  
  // Poucos testes unitários
  if (unitPct < 50 && total > 10) {
    issues.push(`Poucos testes unitários: ${unitPct.toFixed(1)}% (ideal: >70%)`);
    recommendations.push('Adicione mais testes unitários para funções puras e lógica de negócio');
  }
  
  // Muitos testes E2E
  if (e2ePct > 20 && total > 10) {
    issues.push(`Muitos testes E2E: ${e2ePct.toFixed(1)}% (ideal: <10%)`);
    recommendations.push('Considere mover alguns cenários E2E para testes de integração');
  }
  
  // Falta de testes de integração
  if (integrationCount === 0 && e2eCount > 5) {
    issues.push('Nenhum teste de integração detectado');
    recommendations.push('Adicione testes de integração para APIs e bancos de dados');
  }
  
  const healthy = issues.length === 0;
  
  if (healthy) {
    recommendations.push('Pirâmide saudável! Continue mantendo o equilíbrio.');
  }
  
  return { healthy, issues, recommendations };
}

/**
 * Detecta cobertura de código (se existir)
 */
export async function findCoverageReports(repoPath: string): Promise<{
  hasCoverage: boolean;
  coverageFiles: string[];
  avgCoverage?: number;
}> {
  try {
    const coveragePatterns = [
      '**/coverage/coverage-summary.json',
      '**/coverage/lcov-report/index.html',
      '**/.nyc_output/*.json'
    ];
    
    const coverageFiles: string[] = [];
    
    for (const pattern of coveragePatterns) {
      const files = await glob(pattern, {
        cwd: repoPath,
        ignore: ['**/node_modules/**']
      });
      coverageFiles.push(...files);
    }
    
    // Tenta ler cobertura do coverage-summary.json
    let avgCoverage: number | undefined;
    
    const summaryFile = coverageFiles.find(f => f.includes('coverage-summary.json'));
    if (summaryFile) {
      try {
        const content = await fs.readFile(join(repoPath, summaryFile), 'utf8');
        const data = JSON.parse(content);
        if (data.total?.lines?.pct !== undefined) {
          avgCoverage = data.total.lines.pct;
        }
      } catch {
        // Ignora erros de parsing
      }
    }
    
    return {
      hasCoverage: coverageFiles.length > 0,
      coverageFiles,
      avgCoverage
    };
  } catch {
    return { hasCoverage: false, coverageFiles: [] };
  }
}

