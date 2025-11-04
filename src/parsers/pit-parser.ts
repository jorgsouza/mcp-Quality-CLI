/**
 * 🧬 PIT (PITest) Mutation Testing Parser
 * 
 * Parser para relatórios de mutation testing do PIT (Pitest).
 * Suporta XML e HTML output.
 * 
 * Formato PIT XML:
 * ```xml
 * <mutations>
 *   <mutation detected='true' status='KILLED'>
 *     <sourceFile>UserService.java</sourceFile>
 *     <mutatedClass>com.example.UserService</mutatedClass>
 *     <mutatedMethod>findById</mutatedMethod>
 *     <lineNumber>42</lineNumber>
 *     <mutator>org.pitest.mutationtest.engine.gregor.mutators.ReturnValsMutator</mutator>
 *     <killingTest>com.example.UserServiceTest.testFindById()</killingTest>
 *   </mutation>
 * </mutations>
 * ```
 */

import { promises as fs } from 'node:fs';
import { parseStringPromise } from 'xml2js';
import type { MutationResult } from '../adapters/base/LanguageAdapter.js';

export interface PITMutation {
  detected: boolean;
  status: 'KILLED' | 'SURVIVED' | 'NO_COVERAGE' | 'TIMED_OUT' | 'MEMORY_ERROR';
  sourceFile: string;
  mutatedClass: string;
  mutatedMethod: string;
  lineNumber: number;
  mutator: string;
  killingTest?: string;
  description?: string;
}

export interface PITReport {
  mutations: PITMutation[];
  summary: {
    totalMutants: number;
    killed: number;
    survived: number;
    noCoverage: number;
    timeout: number;
    memoryError: number;
    score: number;
  };
}

/**
 * Parseia relatório PIT XML
 */
export async function parsePITXml(filePath: string): Promise<PITReport> {
  const content = await fs.readFile(filePath, 'utf-8');
  const parsed = await parseStringPromise(content);

  const mutations: PITMutation[] = [];
  const mutationNodes = parsed.mutations?.mutation || [];

  for (const node of mutationNodes) {
    mutations.push({
      detected: node.$.detected === 'true',
      status: node.$.status || 'SURVIVED',
      sourceFile: node.sourceFile?.[0] || 'unknown',
      mutatedClass: node.mutatedClass?.[0] || 'unknown',
      mutatedMethod: node.mutatedMethod?.[0] || 'unknown',
      lineNumber: parseInt(node.lineNumber?.[0] || '0'),
      mutator: node.mutator?.[0] || 'unknown',
      killingTest: node.killingTest?.[0],
      description: node.description?.[0],
    });
  }

  const summary = calculatePITSummary(mutations);

  return { mutations, summary };
}

/**
 * Parseia saída stdout/stderr do PIT (formato texto)
 */
export function parsePITStdout(output: string): PITReport {
  const mutations: PITMutation[] = [];

  // PIT stdout format:
  // "Generated 150 mutations Killed 120 (80%)"
  // ">> Line 42: ReturnValsMutator KILLED by UserServiceTest.testFindById"

  const lines = output.split('\n');

  for (const line of lines) {
    // Parse mutation line
    const match = line.match(/>> Line (\d+): (\w+) (\w+)(?: by (.+))?/);
    if (match) {
      const lineNumber = parseInt(match[1]);
      const mutator = match[2];
      const status = match[3] as PITMutation['status'];
      const killingTest = match[4];

      mutations.push({
        detected: status === 'KILLED',
        status,
        sourceFile: 'unknown',
        mutatedClass: 'unknown',
        mutatedMethod: 'unknown',
        lineNumber,
        mutator,
        killingTest,
      });
    }
  }

  const summary = calculatePITSummary(mutations);

  return { mutations, summary };
}

/**
 * Calcula sumário de um relatório PIT
 */
function calculatePITSummary(mutations: PITMutation[]): PITReport['summary'] {
  const totalMutants = mutations.length;
  const killed = mutations.filter(m => m.status === 'KILLED').length;
  const survived = mutations.filter(m => m.status === 'SURVIVED').length;
  const noCoverage = mutations.filter(m => m.status === 'NO_COVERAGE').length;
  const timeout = mutations.filter(m => m.status === 'TIMED_OUT').length;
  const memoryError = mutations.filter(m => m.status === 'MEMORY_ERROR').length;

  const score = totalMutants > 0 ? (killed / totalMutants) * 100 : 0;

  return {
    totalMutants,
    killed,
    survived,
    noCoverage,
    timeout,
    memoryError,
    score,
  };
}

/**
 * Converte relatório PIT para formato MutationResult
 */
export function pitToMutationResult(report: PITReport): MutationResult {
  return {
    ok: report.summary.score >= 70, // 70% threshold padrão
    framework: 'pitest',
    totalMutants: report.summary.totalMutants,
    killed: report.summary.killed,
    survived: report.summary.survived,
    timeout: report.summary.timeout,
    noCoverage: report.summary.noCoverage,
    score: report.summary.score / 100, // Normalizar para 0-1
    mutations: report.mutations.map(m => {
      // Normalizar status
      let status: 'killed' | 'survived' | 'timeout' | 'no-coverage' = 'survived';
      if (m.status === 'KILLED') status = 'killed';
      else if (m.status === 'TIMED_OUT') status = 'timeout';
      else if (m.status === 'NO_COVERAGE') status = 'no-coverage';

      // Derivar original/mutated do mutator (PIT nem sempre fornece isso)
      const mutatorName = m.mutator.split('.').pop() || m.mutator;
      const original = m.description || 'original code';
      const mutated = `${mutatorName} mutation`;

      return {
        id: `${m.mutatedClass}:${m.lineNumber}`,
        file: m.sourceFile,
        line: m.lineNumber,
        mutator: mutatorName,
        original,
        mutated,
        status,
        killedBy: m.killingTest ? [m.killingTest] : undefined,
      };
    }),
  };
}

/**
 * Parseia relatório PIT automaticamente (XML ou stdout)
 */
export async function parsePITReport(
  filePathOrOutput: string,
  isFile: boolean = true
): Promise<MutationResult> {
  let report: PITReport;

  if (isFile) {
    // Tentar XML primeiro
    try {
      report = await parsePITXml(filePathOrOutput);
    } catch {
      // Fallback: ler como texto
      const content = await fs.readFile(filePathOrOutput, 'utf-8');
      report = parsePITStdout(content);
    }
  } else {
    // Parsear stdout diretamente
    report = parsePITStdout(filePathOrOutput);
  }

  return pitToMutationResult(report);
}

export default parsePITReport;

