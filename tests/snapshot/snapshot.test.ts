import { test, expect, describe } from 'bun:test';
import { parseHttp } from '../../src/index';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';


describe('HTTP Parser Fixtures', () => {
  const fixturesDir = join(__dirname, '..','fixtures', 'http');
  const files = readdirSync(fixturesDir);

  const baseNames = [...new Set(
    files
      .filter(f => f.endsWith('.http'))
      .map(f => f.replace('.http', ''))
  )];

  baseNames.forEach(baseName => {
    test(`should parse ${baseName}.http correctly`, () => {
      const httpPath = join(fixturesDir, `${baseName}.http`);
      const jsonPath = join(fixturesDir, `${baseName}.json`);
      
      const input = readFileSync(httpPath, 'utf-8');
      const expected = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      
      const result = parseHttp(input);
      
      expect(result).toEqual(expected);
    });
  });

});