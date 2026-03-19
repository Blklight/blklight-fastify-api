import vm from 'node:vm';
import { ValidationError } from './errors';

const LOG_SEPARATOR = '\x00';

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
 * Execute JavaScript code in a sandboxed VM context.
 * Only pure JavaScript is allowed - Node.js APIs (require, process, Buffer, etc.) are blocked.
 * @param code - The JavaScript code to execute
 * @param timeout - Execution timeout in milliseconds (default: 3000)
 * @returns The captured console.log output as a string
 * @throws ValidationError if execution times out or encounters a runtime error
 */
export async function executeCode(code: string, timeout: number = 3000): Promise<string> {
  const sandbox = createSandbox();

  try {
    const script = new vm.Script(code, { filename: 'exercise.js' });

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
