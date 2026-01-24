/**
 * Logger type that matches Convex's Logger interface.
 */
export type Logger = {
  logVerbose(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
};

/**
 * Custom logger that filters out UserFacingError messages from the console.
 * These are validation/business logic errors that should only be shown via toast notifications.
 * All other errors (unexpected failures, bugs, etc.) are logged normally.
 */
export class ConvexCustomLogger implements Logger {
  private _onLogLineFuncs: Array<(level: string, ...args: any[]) => void> = [];

  private shouldFilterError(args: any[]): boolean {
    // Filter out UserFacingError messages from console logs
    for (const arg of args) {
      if (arg && typeof arg === 'string') {
        if (arg.includes('UserFacingError')) {
          return true;
        }
      } else if (arg && arg.name === 'UserFacingError') {
        return true;
      }
    }
    return false;
  }

  logVerbose(...args: any[]): void {
    // Verbose logs are not filtered
    console.log(...args);
    this._onLogLineFuncs.forEach((func) => func('debug', ...args));
  }

  log(...args: any[]): void {
    // Info logs are not filtered
    console.log(...args);
    this._onLogLineFuncs.forEach((func) => func('info', ...args));
  }

  warn(...args: any[]): void {
    // Warning logs are not filtered
    console.warn(...args);
    this._onLogLineFuncs.forEach((func) => func('warn', ...args));
  }

  error(...args: any[]): void {
    // Filter out UserFacingError messages from console logs
    if (!this.shouldFilterError(args)) {
      console.error(...args);
    }
    this._onLogLineFuncs.forEach((func) => func('error', ...args));
  }

  addLogLineListener(func: (level: string, ...args: any[]) => void): () => void {
    this._onLogLineFuncs.push(func);
    return () => {
      this._onLogLineFuncs = this._onLogLineFuncs.filter((f) => f !== func);
    };
  }
}
