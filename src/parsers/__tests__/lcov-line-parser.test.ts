import { describe, it, expect } from 'vitest';
import {
  parseLCOV,
  calculateLineCoverage,
  isLineCovered,
  normalizeFilePath,
  findFileInReport,
  type LCOVReport,
} from '../lcov-line-parser.js';

describe('LCOV Line Parser', () => {
  const sampleLCOV = `TN:
SF:src/utils/math.ts
FN:1,add
FN:5,subtract
FNDA:10,add
FNDA:2,subtract
FNF:2
FNH:2
DA:1,10
DA:2,10
DA:3,0
DA:5,2
DA:6,2
LF:5
LH:4
end_of_record
SF:src/utils/string.ts
FN:1,capitalize
FNDA:5,capitalize
FNF:1
FNH:1
DA:1,5
DA:2,5
DA:3,0
LF:3
LH:2
end_of_record`;

  describe('parseLCOV', () => {
    it('deve parsear relatório LCOV corretamente', () => {
      const result = parseLCOV(sampleLCOV);

      expect(result.files.size).toBe(2);
      expect(result.totalLines).toBe(8);
      expect(result.coveredLines).toBe(6);
      expect(result.coverage).toBeCloseTo(75, 1);
    });

    it('deve extrair linhas cobertas corretamente', () => {
      const result = parseLCOV(sampleLCOV);
      const mathFile = result.files.get('src/utils/math.ts');

      expect(mathFile).toBeDefined();
      expect(mathFile!.lines).toHaveLength(5);
      expect(mathFile!.totalLines).toBe(5);
      expect(mathFile!.coveredLines).toBe(4);
    });

    it('deve marcar linhas não cobertas', () => {
      const result = parseLCOV(sampleLCOV);
      const mathFile = result.files.get('src/utils/math.ts');

      const line3 = mathFile!.lines.find(l => l.line === 3);
      expect(line3?.covered).toBe(false);
      expect(line3?.hits).toBe(0);
    });

    it('deve marcar linhas cobertas', () => {
      const result = parseLCOV(sampleLCOV);
      const mathFile = result.files.get('src/utils/math.ts');

      const line1 = mathFile!.lines.find(l => l.line === 1);
      expect(line1?.covered).toBe(true);
      expect(line1?.hits).toBe(10);
    });

    it('deve lidar com LCOV vazio', () => {
      const result = parseLCOV('');
      expect(result.files.size).toBe(0);
      expect(result.totalLines).toBe(0);
      expect(result.coverage).toBe(0);
    });
  });

  describe('isLineCovered', () => {
    it('deve identificar linha coberta', () => {
      const report = parseLCOV(sampleLCOV);
      expect(isLineCovered(report, 'src/utils/math.ts', 1)).toBe(true);
    });

    it('deve identificar linha não coberta', () => {
      const report = parseLCOV(sampleLCOV);
      expect(isLineCovered(report, 'src/utils/math.ts', 3)).toBe(false);
    });

    it('deve retornar false para arquivo inexistente', () => {
      const report = parseLCOV(sampleLCOV);
      expect(isLineCovered(report, 'nonexistent.ts', 1)).toBe(false);
    });

    it('deve retornar false para linha inexistente', () => {
      const report = parseLCOV(sampleLCOV);
      expect(isLineCovered(report, 'src/utils/math.ts', 999)).toBe(false);
    });
  });

  describe('calculateLineCoverage', () => {
    it('deve calcular coverage exato para linhas específicas', () => {
      const report = parseLCOV(sampleLCOV);
      const result = calculateLineCoverage(report, 'src/utils/math.ts', [1, 2, 5, 6]);

      expect(result.total).toBe(4);
      expect(result.covered).toBe(4); // Todas cobertas
      expect(result.percentage).toBe(100);
    });

    it('deve calcular coverage com linhas não cobertas', () => {
      const report = parseLCOV(sampleLCOV);
      const result = calculateLineCoverage(report, 'src/utils/math.ts', [1, 2, 3]); // 3 não coberta

      expect(result.total).toBe(3);
      expect(result.covered).toBe(2);
      expect(result.percentage).toBeCloseTo(66.67, 1);
    });

    it('deve retornar 0 para arquivo inexistente', () => {
      const report = parseLCOV(sampleLCOV);
      const result = calculateLineCoverage(report, 'nonexistent.ts', [1, 2, 3]);

      expect(result.total).toBe(0);
      expect(result.covered).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it('deve retornar 0 para lista de linhas vazia', () => {
      const report = parseLCOV(sampleLCOV);
      const result = calculateLineCoverage(report, 'src/utils/math.ts', []);

      expect(result.total).toBe(0);
      expect(result.covered).toBe(0);
      expect(result.percentage).toBe(0);
    });
  });

  describe('normalizeFilePath', () => {
    it('deve remover prefixo src/', () => {
      expect(normalizeFilePath('src/utils/math.ts')).toBe('utils/math.ts');
    });

    it('deve remover prefixo ./', () => {
      expect(normalizeFilePath('./utils/math.ts')).toBe('utils/math.ts');
    });

    it('deve converter backslash para slash', () => {
      expect(normalizeFilePath('src\\utils\\math.ts')).toBe('utils/math.ts');
    });

    it('deve lidar com múltiplos prefixos', () => {
      expect(normalizeFilePath('./src/utils/math.ts')).toBe('utils/math.ts');
    });
  });

  describe('findFileInReport', () => {
    it('deve encontrar arquivo por match exato', () => {
      const report = parseLCOV(sampleLCOV);
      const found = findFileInReport(report, 'src/utils/math.ts');
      expect(found).toBe('src/utils/math.ts');
    });

    it('deve encontrar arquivo por match normalizado', () => {
      const report = parseLCOV(sampleLCOV);
      const found = findFileInReport(report, './src/utils/math.ts');
      expect(found).toBe('src/utils/math.ts');
    });

    it('deve encontrar arquivo por basename', () => {
      const report = parseLCOV(sampleLCOV);
      const found = findFileInReport(report, 'math.ts');
      expect(found).toBe('src/utils/math.ts');
    });

    it('deve retornar null para arquivo inexistente', () => {
      const report = parseLCOV(sampleLCOV);
      const found = findFileInReport(report, 'nonexistent.ts');
      expect(found).toBeNull();
    });
  });

  describe('Integração Diff Coverage', () => {
    it('deve calcular coverage preciso para diff simulado', () => {
      const report = parseLCOV(sampleLCOV);
      
      // Simula diff: linhas 1,2,3 foram adicionadas
      const diffLines = [1, 2, 3];
      const result = calculateLineCoverage(report, 'src/utils/math.ts', diffLines);

      expect(result.total).toBe(3);
      expect(result.covered).toBe(2); // Linhas 1 e 2 cobertas, 3 não
      expect(result.percentage).toBeCloseTo(66.67, 1);
    });

    it('deve calcular 0% para arquivo sem coverage', () => {
      const report = parseLCOV(sampleLCOV);
      
      const diffLines = [1, 2, 3];
      const result = calculateLineCoverage(report, 'uncovered-file.ts', diffLines);

      expect(result.total).toBe(0);
      expect(result.covered).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it('deve calcular 100% para linhas totalmente cobertas', () => {
      const report = parseLCOV(sampleLCOV);
      
      const diffLines = [1, 2]; // Ambas cobertas
      const result = calculateLineCoverage(report, 'src/utils/math.ts', diffLines);

      expect(result.total).toBe(2);
      expect(result.covered).toBe(2);
      expect(result.percentage).toBe(100);
    });
  });
});

