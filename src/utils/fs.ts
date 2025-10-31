import { promises as fs } from 'node:fs';
import { join as pathJoin } from 'node:path';

export const join = pathJoin;

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeFileSafe(file: string, data: string) {
  await ensureDir(pathJoin(file, '..'));
  await fs.writeFile(file, data, 'utf8');
}

export async function readFile(file: string, enc: BufferEncoding = 'utf8') {
  return fs.readFile(file, enc);
}

export async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function readDir(dir: string) {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

