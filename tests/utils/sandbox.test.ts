import { describe, it, expect } from 'vitest';
import { executeCode, transpileTS } from '../../src/utils/sandbox';
import { ValidationError } from '../../src/utils/errors';

describe('sandbox', () => {
  describe('executeCode', () => {
    it('executeCode simple console.log returns output string', async () => {
      const result = await executeCode('console.log("hello world")', 'javascript');
      expect(result).toBe('hello world');
    });

    it('executeCode TypeScript code transpiles and returns output', async () => {
      const result = await executeCode('const x: number = 1 + 2; console.log(x)', 'typescript');
      expect(result).toBe('3');
    });

    it('executeCode infinite loop throws ValidationError (timeout)', async () => {
      await expect(
        executeCode('while(true) {}', 'javascript', 1000)
      ).rejects.toThrow(ValidationError);
    });

    it('executeCode runtime error throws ValidationError with message', async () => {
      await expect(
        executeCode('throw new Error("test error")', 'javascript')
      ).rejects.toThrow(ValidationError);
    });

    it('executeCode unsupported language throws ValidationError', async () => {
      await expect(
        executeCode('console.log("test")', 'python' as 'javascript')
      ).rejects.toThrow(ValidationError);
    });

    it('executeCode does not have access to require', async () => {
      await expect(
        executeCode('require("fs")', 'javascript')
      ).rejects.toThrow(ValidationError);
    });

    it('executeCode does not have access to process', async () => {
      await expect(
        executeCode('process.exit(1)', 'javascript')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('transpileTS', () => {
    it('transpileTS converts TypeScript to JavaScript', () => {
      const js = transpileTS('const x: number = 5;');
      expect(js).toContain('x = 5');
    });

    it('transpileTS throws ValidationError on syntax error', () => {
      expect(() => transpileTS('const x: = 5')).toThrow(ValidationError);
    });
  });
});
