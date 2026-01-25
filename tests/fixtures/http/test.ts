import { readFileSync, writeFileSync } from 'fs';
import { parseHttp } from '../../../src';
import { join } from 'path';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: bun run ./test.ts <filepath>');
  process.exit(1);
}

const fixturePath = join(process.cwd(), filePath);
const input = readFileSync(fixturePath, 'utf-8');

const result = parseHttp(input);
console.dir(result, { depth: null });

const outputPath = fixturePath.replace(/\.http$/, '.json');
writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
