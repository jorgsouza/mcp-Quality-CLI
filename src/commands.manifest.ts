/**
 * 📋 Manifesto de Comandos do MCP Quality CLI
 * 
 * Este arquivo centraliza a definição de todos os comandos disponíveis.
 * A CLI é auto-gerada a partir deste manifesto, garantindo:
 * - Paridade entre --help, package.json scripts e comandos registrados
 * - Validação automática de flags obrigatórias
 * - Impossível esquecer de registrar um comando
 */

export interface CommandFlag {
  name: string;
  description: string;
  required: boolean;
  defaultValue?: string | boolean;
}

export interface CommandDefinition {
  /** Nome do comando (ex: 'analyze', 'validate') */
  name: string;
  
  /** Caminho do módulo relativo a src/ (ex: './tools/auto.js') */
  module: string;
  
  /** Descrição breve para --help */
  description: string;
  
  /** Flags aceitas pelo comando */
  flags: CommandFlag[];
  
  /** Aliases (ex: ['full'] para 'analyze --full') */
  aliases?: string[];
  
  /** Exemplos de uso */
  examples?: string[];
}

/**
 * 🎯 Comandos Consolidados do MCP Quality CLI
 * 
 * Anteriormente: 16+ comandos fragmentados
 * Agora: 5 comandos inteligentes
 */
export const COMMANDS: readonly CommandDefinition[] = [
  {
    name: 'analyze',
    module: './tools/auto.js',
    description: '🔍 Analisa qualidade de testes (orquestrador inteligente)',
    flags: [
      { name: 'repo', description: 'Caminho do repositório', required: true },
      { name: 'product', description: 'Nome do produto', required: true },
      { name: 'mode', description: 'Modo: full|analyze|plan|scaffold|run', required: false, defaultValue: 'full' },
      { name: 'skip-run', description: 'Pular execução de testes', required: false, defaultValue: false },
      { name: 'skip-scaffold', description: 'Pular geração de scaffolds', required: false, defaultValue: false },
    ],
    aliases: ['full', 'smart'],
    examples: [
      'quality analyze --repo . --product my-app',
      'quality analyze --repo . --product my-app --mode analyze',
      'quality analyze --repo . --product my-app --skip-run',
    ],
  },
  
  {
    name: 'validate',
    module: './tools/validate.js',
    description: '✅ Valida gates de qualidade (coverage, mutation, scenarios)',
    flags: [
      { name: 'repo', description: 'Caminho do repositório', required: true },
      { name: 'product', description: 'Nome do produto', required: false },
      { name: 'min-branch', description: 'Cobertura mínima de branches (%)', required: false },
      { name: 'min-mutation', description: 'Mutation score mínimo (%)', required: false },
      { name: 'min-scenarios', description: 'Percentual mínimo de cenários (%)', required: false },
      { name: 'min-diff-coverage', description: 'Cobertura mínima do diff (%)', required: false },
      { name: 'require-critical', description: 'Exige 100% de funções críticas testadas', required: false, defaultValue: false },
      { name: 'require-contracts', description: 'Exige contratos CDC/Pact passando', required: false, defaultValue: false }, // 🆕 3)
      { name: 'fail-fast', description: 'Para na primeira falha', required: false, defaultValue: false },
      { name: 'base-branch', description: 'Branch base para diff', required: false, defaultValue: 'main' },
    ],
    examples: [
      'quality validate --repo . --min-mutation 70',
      'quality validate --repo . --min-mutation 75 --min-branch 85',
      'quality validate --repo . --min-mutation 70 --fail-fast',
    ],
  },
  
  {
    name: 'report',
    module: './tools/report.js',
    description: '📊 Gera relatórios consolidados (MD/JSON/HTML)',
    flags: [
      { name: 'in-dir', description: 'Diretório de entrada com análises', required: true },
      { name: 'out-file', description: 'Arquivo de saída', required: false, defaultValue: 'SUMMARY.md' },
      { name: 'format', description: 'Formato: markdown|json|html', required: false, defaultValue: 'markdown' },
      { name: 'diff-coverage-min', description: 'Threshold de diff coverage', required: false },
      { name: 'flaky-pct-max', description: 'Percentual máximo de testes flaky', required: false },
    ],
    examples: [
      'quality report --in-dir tests/analyses',
      'quality report --in-dir tests/analyses --format json',
    ],
  },
  
  {
    name: 'scaffold',
    module: './tools/scaffold.js',
    description: '🏗️ Gera estrutura de testes (unit/integration/e2e)',
    flags: [
      { name: 'repo', description: 'Caminho do repositório', required: true },
      { name: 'product', description: 'Nome do produto', required: true },
      { name: 'type', description: 'Tipo: unit|integration|e2e', required: false, defaultValue: 'unit' },
      { name: 'function', description: 'Nome da função específica', required: false },
      { name: 'scenario', description: 'Cenário: happy|error|edge|side', required: false },
      { name: 'auto-detect', description: 'Auto-detectar arquivos', required: false, defaultValue: true },
      { name: 'framework', description: 'Framework: jest|vitest|mocha', required: false, defaultValue: 'vitest' },
    ],
    examples: [
      'quality scaffold --repo . --product my-app',
      'quality scaffold --repo . --product my-app --type integration',
      'quality scaffold --repo . --product my-app --function parseData --scenario error',
    ],
  },
  
  {
    name: 'self-check',
    module: './tools/self-check.js',
    description: '🔍 Verifica ambiente e dependências (Node, vitest, stryker)',
    flags: [
      { name: 'repo', description: 'Caminho do repositório', required: false, defaultValue: '.' },
      { name: 'fix', description: 'Tentar corrigir problemas automaticamente', required: false, defaultValue: false },
    ],
    examples: [
      'quality self-check',
      'quality self-check --repo . --fix',
    ],
  },
] as const;

/**
 * 🔍 Busca comando por nome
 */
export function findCommand(name: string): CommandDefinition | undefined {
  return COMMANDS.find(cmd => cmd.name === name || cmd.aliases?.includes(name));
}

/**
 * ✅ Valida se todas as flags obrigatórias foram fornecidas
 */
export function validateRequiredFlags(
  command: CommandDefinition,
  providedFlags: Record<string, unknown>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  for (const flag of command.flags) {
    if (flag.required && !(flag.name in providedFlags)) {
      missing.push(flag.name);
    }
  }
  
  return { valid: missing.length === 0, missing };
}

/**
 * 📝 Gera help text para um comando
 */
export function generateCommandHelp(command: CommandDefinition): string {
  const lines: string[] = [
    `\n${command.description}\n`,
    'Flags:',
  ];
  
  for (const flag of command.flags) {
    const req = flag.required ? '(obrigatório)' : '(opcional)';
    const def = flag.defaultValue !== undefined ? ` [padrão: ${flag.defaultValue}]` : '';
    lines.push(`  --${flag.name}  ${flag.description} ${req}${def}`);
  }
  
  if (command.examples && command.examples.length > 0) {
    lines.push('\nExemplos:');
    for (const example of command.examples) {
      lines.push(`  ${example}`);
    }
  }
  
  return lines.join('\n');
}
