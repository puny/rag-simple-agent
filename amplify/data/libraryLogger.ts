type LogDetails = Record<string, unknown>;

export type LibraryLogger = {
  info: (event: string, details?: LogDetails) => void;
  error: (stage: string, error: unknown, details?: LogDetails) => void;
};

export const createLibraryLogger = (component: string, context: LogDetails = {}): LibraryLogger => ({
  info: (event, details = {}) => {
    console.info(JSON.stringify({ component, ...context, event, ...details }));
  },
  error: (stage, error, details = {}) => {
    console.error(JSON.stringify({
      component,
      ...context,
      event: 'failed',
      stage,
      ...details,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }));
  },
});