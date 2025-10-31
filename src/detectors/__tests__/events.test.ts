import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findEvents } from '../events.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('findEvents', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `events-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 1. Kafka producers
  it('deve detectar producer.send() com tópicos Kafka', async () => {
    const kafkaFile = join(testDir, 'kafka-producer.ts');
    await fs.writeFile(kafkaFile, `
      import { Kafka } from 'kafkajs';
      
      const kafka = new Kafka({ clientId: 'my-app' });
      const producer = kafka.producer();
      
      await producer.send({
        topic: 'user-created',
        messages: [{ value: 'Hello' }]
      });
      
      await producer.send({
        topic: 'order-placed',
        messages: [{ value: 'Order data' }]
      });
    `);

    const events = await findEvents(testDir);

    expect(events).toContain('kafka:user-created');
    expect(events).toContain('kafka:order-placed');
  });

  // 2. Kafka consumers
  it('deve detectar consumer.subscribe() e consumer.run()', async () => {
    const kafkaFile = join(testDir, 'kafka-consumer.ts');
    await fs.writeFile(kafkaFile, `
      import { Kafka } from 'kafkajs';
      
      const kafka = new Kafka({ clientId: 'my-app' });
      const consumer = kafka.consumer({ groupId: 'test-group' });
      
      await consumer.subscribe({ topic: 'payment-processed' });
      
      await consumer.run({
        eachMessage: async ({ topic, message }) => {
          console.log(message);
        }
      });
    `);

    const events = await findEvents(testDir);

    expect(events).toContain('kafka:payment-processed');
  });

  // 3. SQS queues
  it('deve detectar sqs.sendMessage() com queue URL', async () => {
    const sqsFile = join(testDir, 'sqs-producer.ts');
    await fs.writeFile(sqsFile, `
      import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
      
      const sqs = new SQSClient({ region: 'us-east-1' });
      
      await sqs.sendMessage({
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/my-queue',
        MessageBody: JSON.stringify({ event: 'test' })
      });
      
      await sqs.sendMessage({
        QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789/notifications',
        MessageBody: 'Notification'
      });
    `);

    const events = await findEvents(testDir);

    expect(events).toContain('aws:my-queue');
    expect(events).toContain('aws:notifications');
  });

  // 4. EventEmitter
  it('deve detectar emit() com event names', async () => {
    const emitterFile = join(testDir, 'event-emitter.ts');
    await fs.writeFile(emitterFile, `
      import { EventEmitter } from 'events';
      
      const emitter = new EventEmitter();
      
      emitter.emit('user:login', { userId: 123 });
      emitter.emit('user:logout', { userId: 123 });
      emitter.emit('data:updated', { data: 'new' });
    `);

    const events = await findEvents(testDir);

    expect(events).toContain('event:user:login');
    expect(events).toContain('event:user:logout');
    expect(events).toContain('event:data:updated');
  });

  // 5. Diretório vazio
  it('deve retornar array vazio se não houver eventos', async () => {
    // Criar arquivo sem eventos
    const emptyFile = join(testDir, 'no-events.ts');
    await fs.writeFile(emptyFile, `
      export function hello() {
        return 'world';
      }
    `);

    const events = await findEvents(testDir);

    expect(events).toEqual([]);
  });

  // 6. Múltiplos eventos
  it('deve consolidar todos os eventos encontrados', async () => {
    // Criar múltiplos arquivos com diferentes tipos de eventos
    await fs.writeFile(join(testDir, 'kafka.ts'), `
      producer.send({ topic: 'topic-1' });
    `);
    
    await fs.writeFile(join(testDir, 'sqs.ts'), `
      sqs.sendMessage({ QueueUrl: 'https://sqs/queue-1' });
    `);
    
    await fs.writeFile(join(testDir, 'emitter.ts'), `
      emitter.emit('event-1');
    `);

    const events = await findEvents(testDir);

    expect(events).toHaveLength(3);
    expect(events).toContain('kafka:topic-1');
    expect(events).toContain('aws:queue-1');
    expect(events).toContain('event:event-1');
    // Deve estar ordenado
    expect(events).toEqual(events.slice().sort());
  });

  // Teste adicional: remover duplicatas
  it('deve remover eventos duplicados', async () => {
    const file = join(testDir, 'duplicates.ts');
    await fs.writeFile(file, `
      producer.send({ topic: 'same-topic' });
      producer.send({ topic: 'same-topic' });
      producer.send({ topic: 'same-topic' });
    `);

    const events = await findEvents(testDir);

    // Deve ter apenas uma entrada
    expect(events.filter(e => e === 'kafka:same-topic')).toHaveLength(1);
  });

  // Teste adicional: SNS topics
  it('deve detectar SNS subscribe com TopicArn', async () => {
    const snsFile = join(testDir, 'sns.ts');
    await fs.writeFile(snsFile, `
      sns.subscribe({
        TopicArn: 'arn:aws:sns:us-east-1:123456789:my-topic'
      });
    `);

    const events = await findEvents(testDir);

    expect(events).toContain('aws:my-topic');
  });

  // Teste adicional: diferentes estilos de quotes
  it('deve detectar eventos com aspas simples, duplas e template literals', async () => {
    const file = join(testDir, 'quotes.ts');
    await fs.writeFile(file, `
      emitter.emit('single-quote');
      emitter.emit("double-quote");
      emitter.emit(\`template-literal\`);
    `);

    const events = await findEvents(testDir);

    expect(events).toContain('event:single-quote');
    expect(events).toContain('event:double-quote');
    expect(events).toContain('event:template-literal');
  });
});

