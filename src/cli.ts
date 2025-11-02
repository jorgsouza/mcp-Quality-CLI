#!/usr/bin/env node

/**
 * 🎯 MCP Quality CLI - Entry Point (v2 - Manifesto-based)
 * 
 * CLI auto-gerada a partir do manifesto (src/commands.manifest.ts)
 * Comandos são registrados programaticamente, garantindo:
 * - Paridade entre --help, package.json e comandos disponíveis
 * - Validação automática de flags obrigatórias
 * - Impossível esquecer de registrar um comando
 */

import { Command } from 'commander';
import { COMMANDS, validateRequiredFlags } from './commands.manifest.js';

const program = new Command();

program
  .name('quality')
  .description('🎯 MCP Quality CLI - Teste o que importa')
  .version('0.3.1');

/**
 * 🔄 Registro dinâmico de comandos a partir do manifesto
 */
for (const cmdDef of COMMANDS) {
  const cmd = program
    .command(cmdDef.name)
    .description(cmdDef.description);

  // Adicionar flags dinamicamente
  for (const flag of cmdDef.flags) {
    // Detectar se é boolean pela defaultValue
    const isBoolean = typeof flag.defaultValue === 'boolean';
    const flagName = isBoolean ? `--${flag.name}` : `--${flag.name} <value>`;
    const flagDesc = flag.required 
      ? `${flag.description} (obrigatório)`
      : `${flag.description} ${flag.defaultValue !== undefined ? `(padrão: ${flag.defaultValue})` : ''}`;

    if (flag.required) {
      cmd.requiredOption(flagName, flagDesc);
    } else {
      cmd.option(flagName, flagDesc, flag.defaultValue as any);
    }
  }

  // Adicionar help customizado
  cmd.on('--help', () => {
    if (cmdDef.examples && cmdDef.examples.length > 0) {
      console.log('\nExemplos:');
      for (const example of cmdDef.examples) {
        console.log(`  ${example}`);
      }
    }
  });

  // Action handler dinâmico
  cmd.action(async (options) => {
    try {
      // Sinalizar que estamos rodando via CLI (para process.exit funcionar)
      process.env.CLI_MODE = 'true';
      
      // Validar flags obrigatórias
      const validation = validateRequiredFlags(cmdDef, options);
      if (!validation.valid) {
        console.error(`❌ Flags obrigatórias faltando: ${validation.missing.join(', ')}`);
        process.exit(1);
      }

      // Importar e executar módulo dinamicamente
      const modulePath = cmdDef.module;
      const module = await import(modulePath);

      // Detectar função a executar
      const fnName = cmdDef.name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const fn = module.default || module[fnName] || module[Object.keys(module)[0]];

      if (!fn || typeof fn !== 'function') {
        throw new Error(`Módulo ${modulePath} não exporta função válida`);
      }

      // Normalizar opções para snake_case (compatibilidade com código existente)
      const params: Record<string, any> = {};
      for (const [key, value] of Object.entries(options)) {
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        params[snakeKey] = value;
      }

      // Executar função
      console.log(`🚀 Executando ${cmdDef.name}...\n`);
      const result = await fn(params);

      // Exibir resultado
      if (result && typeof result === 'object') {
        if (result.ok === false) {
          console.error(`\n⚠️  ${result.message || 'Comando executado com avisos'}`);
          if (result.error) {
            console.error(`   Erro: ${result.error}`);
          }
        } else {
          console.log('\n✅ Comando executado com sucesso!');
        }

        // Detalhes específicos por comando
        if (cmdDef.name === 'validate') {
          if (result.passed === false) {
            console.error(`\n❌ Validação falhou!`);
            if (result.failures) {
              console.error(`   Falhas: ${result.failures.join(', ')}`);
            }
            process.exit(1);
          }
        }

        if (cmdDef.name === 'analyze') {
          console.log(`\n📊 Análise completa!`);
          if (result.reportPath) {
            console.log(`   Relatório: ${result.reportPath}`);
          }
        }

        if (cmdDef.name === 'report') {
          console.log(`\n📄 Relatório gerado!`);
          if (result.out || result.out_file) {
            console.log(`   Arquivo: ${result.out || result.out_file}`);
          }
        }

        if (cmdDef.name === 'scaffold') {
          console.log(`\n🏗️  Estrutura criada!`);
          if (result.generated) {
            console.log(`   Arquivos: ${result.generated.length} gerados`);
          }
        }

        if (cmdDef.name === 'self-check') {
          // Resultado já exibido pela função
        }
      }

    } catch (error: any) {
      console.error(`\n❌ Erro ao executar ${cmdDef.name}:`, error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });
}

// Comando de ajuda global aprimorado
program.on('--help', () => {
  console.log('\n📚 Comandos Disponíveis:');
  console.log('\n  Comandos principais (consolidados):');
  console.log('    analyze    - Análise inteligente de qualidade');
  console.log('    validate   - Gates de qualidade (coverage, mutation)');
  console.log('    report     - Relatórios consolidados');
  console.log('    scaffold   - Geração de estrutura de testes');
  console.log('    self-check - Verificação de ambiente');
  console.log('\n  Use "quality <comando> --help" para detalhes de cada comando.');
  console.log('\n📖 Documentação: https://github.com/jorgsouza/mcp-Quality-CLI');
});

// Parse argumentos
program.parse();
