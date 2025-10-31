import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';

export async function findEvents(repoPath: string): Promise<string[]> {
  const events: string[] = [];

  try {
    const files = await glob('**/*.{ts,js}', {
      cwd: repoPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/test/**', '**/tests/**']
    });

    for (const file of files) {
      const content = await fs.readFile(join(repoPath, file), 'utf8');
      
      // Detecta eventos de pub/sub
      // Kafka
      const kafkaRegex = /(?:producer\.send|consumer\.subscribe)\s*\(\s*[{]?\s*topic:\s*['"`]([^'"`]+)['"`]/gi;
      let match;

      while ((match = kafkaRegex.exec(content)) !== null) {
        events.push(`kafka:${match[1]}`);
      }

      // AWS SQS/SNS
      const sqsRegex = /(?:sendMessage|subscribe)\s*\(\s*[{]?\s*(?:QueueUrl|TopicArn):\s*['"`]([^'"`]+)['"`]/gi;
      while ((match = sqsRegex.exec(content)) !== null) {
        const eventName = match[1].split('/').pop() || match[1];
        events.push(`aws:${eventName}`);
      }

      // Event emitters genéricos
      const emitterRegex = /\.emit\s*\(\s*['"`]([^'"`]+)['"`]/gi;
      while ((match = emitterRegex.exec(content)) !== null) {
        events.push(`event:${match[1]}`);
      }
    }
  } catch (error) {
    console.warn('Erro ao detectar eventos:', error);
  }

  return [...new Set(events)].sort();
}

