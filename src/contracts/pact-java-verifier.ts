/**
 * 🤝 Pact Java Verifier
 * 
 * Verificador de contratos CDC/Pact para projetos Java.
 * Suporta Maven e Gradle com Pact JVM.
 * 
 * SPRINT 1 - Java MVP - Contracts CDC/Pact
 * 
 * @see PLANO-MULTI-LINGUAGEM.md (Sprint 1.3)
 */

import { join } from 'node:path';
import { getPaths } from '../utils/paths.js';
import { writeFileSafe } from '../utils/fs.js';
import { javaAdapter } from '../adapters/java.js';

export interface PactVerifyOptions {
  repo: string;
  product: string;
  broker?: string; // Pact Broker URL (opcional)
  token?: string; // Pact Broker token (opcional)
  provider?: string; // Nome do provider (opcional)
}

export interface PactVerifyResult {
  ok: boolean;
  total: number;
  verified: number;
  failed: number;
  contracts: Array<{
    file: string;
    consumer: string;
    provider: string;
    type: 'consumer' | 'provider';
  }>;
  providerResults: Array<{
    contract: string;
    status: 'passed' | 'failed';
    message?: string;
  }>;
  reportPath?: string;
}

/**
 * Descobre e verifica contratos Pact em projeto Java
 */
export async function verifyJavaPactContracts(
  options: PactVerifyOptions
): Promise<PactVerifyResult> {
  const { repo, product, broker, token, provider } = options;

  console.log('🤝 Verificando contratos Pact (Java)...');

  // 1. Descobrir contratos
  const contracts = await javaAdapter.discoverContracts(repo);

  if (contracts.length === 0) {
    console.log('⚠️  Nenhum contrato Pact encontrado');
    return {
      ok: true,
      total: 0,
      verified: 0,
      failed: 0,
      contracts: [],
      providerResults: [],
    };
  }

  console.log(`📋 ${contracts.length} contrato(s) encontrado(s)`);

  // 2. Verificar contratos (executar Pact verify)
  const verifyResult = await javaAdapter.verifyContracts(repo, {
    broker,
    token,
    provider,
  });

  // 3. Gerar relatório normalizado
  const paths = getPaths(repo, product);
  const reportPath = join(paths.reports, 'contracts-verify.json');

  const normalizedResult: PactVerifyResult = {
    ok: verifyResult.ok,
    total: contracts.length,
    verified: verifyResult.verified,
    failed: verifyResult.failed,
    contracts,
    providerResults: verifyResult.results,
    reportPath,
  };

  // 4. Salvar contracts-verify.json
  await writeFileSafe(reportPath, JSON.stringify(normalizedResult, null, 2));

  console.log(`✅ Contratos verificados: ${verifyResult.verified}/${contracts.length}`);
  if (verifyResult.failed > 0) {
    console.log(`❌ Contratos falharam: ${verifyResult.failed}`);
  }
  console.log(`📄 Relatório salvo: ${reportPath}`);

  return normalizedResult;
}

/**
 * Gera relatório Markdown de contratos Pact
 */
export async function generatePactReport(
  result: PactVerifyResult,
  outputPath: string
): Promise<void> {
  const lines: string[] = [];

  lines.push('# 🤝 Relatório de Contratos CDC/Pact (Java)');
  lines.push('');
  lines.push(`**Data**: ${new Date().toISOString()}`);
  lines.push('');

  // Summary
  lines.push('## 📊 Resumo');
  lines.push('');
  lines.push(`- **Total de contratos**: ${result.total}`);
  lines.push(`- **Verificados**: ${result.verified}`);
  lines.push(`- **Falharam**: ${result.failed}`);
  lines.push(`- **Status**: ${result.ok ? '✅ PASSOU' : '❌ FALHOU'}`);
  lines.push('');

  // Contratos descobertos
  lines.push('## 📋 Contratos Descobertos');
  lines.push('');
  lines.push('| Arquivo | Consumer | Provider | Tipo |');
  lines.push('|---------|----------|----------|------|');

  for (const contract of result.contracts) {
    lines.push(
      `| \`${contract.file}\` | ${contract.consumer} | ${contract.provider} | ${contract.type} |`
    );
  }
  lines.push('');

  // Resultados da verificação
  if (result.providerResults.length > 0) {
    lines.push('## ✅ Resultados da Verificação');
    lines.push('');
    lines.push('| Contrato | Status | Mensagem |');
    lines.push('|----------|--------|----------|');

    for (const providerResult of result.providerResults) {
      const status = providerResult.status === 'passed' ? '✅' : '❌';
      const message = providerResult.message || '-';
      lines.push(`| \`${providerResult.contract}\` | ${status} | ${message} |`);
    }
    lines.push('');
  }

  // Recomendações
  lines.push('## 💡 Recomendações');
  lines.push('');

  if (result.failed > 0) {
    lines.push('### ❌ Ação Necessária');
    lines.push('');
    lines.push('Contratos falharam! Verifique:');
    lines.push('');
    lines.push('1. Se o provider implementou as mudanças esperadas pelo consumer');
    lines.push('2. Se os pacts estão atualizados (rodar testes consumer novamente)');
    lines.push('3. Se a URL do provider está correta');
    lines.push('4. Se o Pact Broker está sincronizado');
    lines.push('');
  } else if (result.total === 0) {
    lines.push('### ⚠️ Nenhum Contrato');
    lines.push('');
    lines.push('Considere adicionar Pact para:');
    lines.push('');
    lines.push('- Testes de integração entre serviços');
    lines.push('- Comunicação assíncrona (eventos)');
    lines.push('- APIs REST entre microserviços');
    lines.push('');
  } else {
    lines.push('### ✅ Tudo Certo!');
    lines.push('');
    lines.push('Todos os contratos foram verificados com sucesso.');
    lines.push('');
  }

  // Pact Broker
  lines.push('## 🌐 Pact Broker (Opcional)');
  lines.push('');
  lines.push('Para compartilhar contratos entre equipes:');
  lines.push('');
  lines.push('```bash');
  lines.push('# Configurar variáveis de ambiente');
  lines.push('export PACT_BROKER_URL=https://your-broker.pactflow.io');
  lines.push('export PACT_BROKER_TOKEN=your-token');
  lines.push('');
  lines.push('# Verificar contratos do broker');
  lines.push('quality analyze --repo . --product MyApp --mode full');
  lines.push('```');
  lines.push('');

  await writeFileSafe(outputPath, lines.join('\n'));
  console.log(`📄 Relatório Markdown salvo: ${outputPath}`);
}

export default verifyJavaPactContracts;

