import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { ValidationError } from './errors';

const LOG_SEPARATOR = '\x00';

export type SupportedLanguage = 'javascript' | 'typescript';

function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

function createSandbox(): { console: { log: (...args: unknown[]) => void }; __logs: string[] } {
  const logs: string[] = [];
  return {
    console: {
      log: (...args: unknown[]) => {
        logs.push(
          args
            .map((a) => {
              if (a === null) return 'null';
              if (a === undefined) return 'undefined';
              if (typeof a === 'object') {
                try {
                  return JSON.stringify(a);
                } catch {
                  return String(a);
                }
              }
              return String(a);
            })
            .join(' ')
        );
      },
    },
    __logs: logs,
  };
}

/**
 * Transpile TypeScript code to JavaScript using esbuild.
 * @param code - The TypeScript code to transpile
 * @returns Transpiled JavaScript string
 * @throws ValidationError if TypeScript syntax error
 */
export function transpileTS(code: string): string {
  try {
    const result = transformSync(code, { loader: 'ts', target: 'es2020' });
    return result.code;
  } catch (error) {
    throw new ValidationError(sanitizeError(error));
  }
}

/**
 * Execute JavaScript or TypeScript code in a sandboxed VM context.
 * Only pure JavaScript is allowed - Node.js APIs (require, process, Buffer, etc.) are blocked.
 * @param code - The code to execute
 * @param language - The language of the code ('javascript' or 'typescript')
 * @param timeout - Execution timeout in milliseconds (default: 3000)
 * @returns The captured console.log output as a string
 * @throws ValidationError if language is unsupported, execution times out, or encounters a runtime error
 */
export async function executeCode(
  code: string,
  language: SupportedLanguage,
  timeout: number = 3000
): Promise<string> {
  if (!['javascript', 'typescript'].includes(language)) {
    throw new ValidationError('Unsupported language. Supported: javascript, typescript');
  }

  const sandbox = createSandbox();
  const codeToExecute = language === 'typescript' ? transpileTS(code) : code;

  try {
    const script = new vm.Script(codeToExecute, { filename: 'exercise.js' });

    const context = vm.createContext(sandbox, {
      name: 'sandbox',
      codeGeneration: {
        strings: false,
        wasm: false,
      },
    });

    script.runInContext(context, {
      timeout,
      breakOnSigint: true,
    });

    return sandbox.__logs.join(LOG_SEPARATOR);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Script execution timed out')) {
      throw new ValidationError('Code execution timed out');
    }
    throw new ValidationError(sanitizeError(error));
  }
}
