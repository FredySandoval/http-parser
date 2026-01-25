import { test, expect, describe } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseHttp } from '../../src/index';

describe('Integration Tests - HTTP Request Parsing', () => {
  test('req_00', () => {
    const fixturePath = join(__dirname, '../fixtures/http/req_00.http');
    const resultPath = fixturePath.replace(/\.http$/, '.json');

    const input = readFileSync(fixturePath, 'utf-8');
    const expected = JSON.parse(readFileSync(resultPath, 'utf-8'));

    const result = parseHttp(input);

    expect(result).toEqual(expected);
  });

  test('req_01', () => {
    const fixturePath = join(__dirname, '../fixtures/http/req_01.http');
    const resultPath = fixturePath.replace(/\.http$/, '.json');

    const input = readFileSync(fixturePath, 'utf-8');
    const expected = JSON.parse(readFileSync(resultPath, 'utf-8'));

    const result = parseHttp(input);

    expect(result).toEqual(expected);
  });

  test('req_02', () => {
    const fixturePath = join(__dirname, '../fixtures/http/req_02.http');
    const resultPath = fixturePath.replace(/\.http$/, '.json');

    const input = readFileSync(fixturePath, 'utf-8');
    const expected = JSON.parse(readFileSync(resultPath, 'utf-8'));

    const result = parseHttp(input);

    expect(result).toEqual(expected);
  });

  test('req_03', () => {
    const fixturePath = join(__dirname, '../fixtures/http/req_03.http');
    const resultPath = fixturePath.replace(/\.http$/, '.json');

    const input = readFileSync(fixturePath, 'utf-8');
    const expected = JSON.parse(readFileSync(resultPath, 'utf-8'));

    const result = parseHttp(input);

    expect(result).toEqual(expected);
  });

  test('req_04', () => {
    const fixturePath = join(__dirname, '../fixtures/http/req_04.http');
    const resultPath = fixturePath.replace(/\.http$/, '.json');

    const input = readFileSync(fixturePath, 'utf-8');
    const expected = JSON.parse(readFileSync(resultPath, 'utf-8'));

    const result = parseHttp(input);

    expect(result).toEqual(expected);
  });

  test('req_05', () => {
    const fixturePath = join(__dirname, '../fixtures/http/req_05.http');
    const resultPath = fixturePath.replace(/\.http$/, '.json');

    const input = readFileSync(fixturePath, 'utf-8');
    const expected = JSON.parse(readFileSync(resultPath, 'utf-8'));

    const result = parseHttp(input);

    expect(result).toEqual(expected);
  });

  test('req_06', () => {
    const fixturePath = join(__dirname, '../fixtures/http/req_06.http');
    const resultPath = fixturePath.replace(/\.http$/, '.json');

    const input = readFileSync(fixturePath, 'utf-8');
    const expected = JSON.parse(readFileSync(resultPath, 'utf-8'));

    const result = parseHttp(input);

    expect(result).toEqual(expected);
  });

  test('req_delimeter_00', () => {
    const fixturePath = join(
      __dirname,
      '../fixtures/http/req_delimeter_00.http'
    );
    const resultPath = fixturePath.replace(/\.http$/, '.json');

    const input = readFileSync(fixturePath, 'utf-8');
    const expected = JSON.parse(readFileSync(resultPath, 'utf-8'));

    const result = parseHttp(input);

    expect(result).toEqual(expected);
  });

  test('req_delimeter_01', () => {
    const fixturePath = join(
      __dirname,
      '../fixtures/http/req_delimeter_01.http'
    );
    const resultPath = fixturePath.replace(/\.http$/, '.json');

    const input = readFileSync(fixturePath, 'utf-8');
    const expected = JSON.parse(readFileSync(resultPath, 'utf-8'));

    const result = parseHttp(input);

    expect(result).toEqual(expected);
  });

  test('req_delimeter_02', () => {
    const fixturePath = join(
      __dirname,
      '../fixtures/http/req_delimeter_02.http'
    );
    const resultPath = fixturePath.replace(/\.http$/, '.json');

    const input = readFileSync(fixturePath, 'utf-8');
    const expected = JSON.parse(readFileSync(resultPath, 'utf-8'));

    const result = parseHttp(input);

    expect(result).toEqual(expected);
  });
});
