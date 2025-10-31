import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ensureDir, writeFileSafe, readFile } from '../fs.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ensureDir', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `fs-test-${Date.now()}`);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 1. Criar diretório novo
  it('deve criar diretório recursivamente', async () => {
    const nestedDir = join(testDir, 'a/b/c');
    
    await ensureDir(nestedDir);
    
    const stats = await fs.stat(nestedDir);
    expect(stats.isDirectory()).toBe(true);
  });

  // 2. Diretório já existe
  it('não deve falhar se diretório já existir', async () => {
    await fs.mkdir(testDir, { recursive: true });
    
    // Não deve lançar erro
    await expect(ensureDir(testDir)).resolves.not.toThrow();
    
    const stats = await fs.stat(testDir);
    expect(stats.isDirectory()).toBe(true);
  });
});

describe('writeFileSafe', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `fs-test-${Date.now()}`);
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 3. Escrever arquivo novo
  it('deve criar diretório pai e escrever arquivo', async () => {
    const filePath = join(testDir, 'nested/dir/file.txt');
    const content = 'Hello World';
    
    await writeFileSafe(filePath, content);
    
    const readContent = await fs.readFile(filePath, 'utf8');
    expect(readContent).toBe(content);
  });

  // 4. Sobrescrever arquivo
  it('deve sobrescrever arquivo existente', async () => {
    const filePath = join(testDir, 'file.txt');
    
    // Criar diretório e arquivo inicial
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(filePath, 'Old content');
    
    // Sobrescrever
    await writeFileSafe(filePath, 'New content');
    
    const readContent = await fs.readFile(filePath, 'utf8');
    expect(readContent).toBe('New content');
  });
});

describe('readFile', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `fs-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 5. Arquivo não existe
  it('deve lançar erro se arquivo não existir', async () => {
    const nonExistentFile = join(testDir, 'does-not-exist.txt');
    
    await expect(readFile(nonExistentFile)).rejects.toThrow();
  });

  // Teste adicional: ler arquivo existente
  it('deve ler conteúdo de arquivo existente', async () => {
    const filePath = join(testDir, 'test.txt');
    const content = 'Test content';
    
    await fs.writeFile(filePath, content);
    
    const readContent = await readFile(filePath);
    expect(readContent).toBe(content);
  });
});

