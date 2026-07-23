type LogValue = string | number | boolean | null | undefined;
type LogContext = Record<string, LogValue>;
const SENSITIVE_KEY = /password|passphrase|token|secret|authorization|cookie|file|content|health|restriction/i;

export function redactLogContext(context: LogContext) {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, SENSITIVE_KEY.test(key) ? '[REDACTED]' : value]));
}

export function logEvent(level: 'info' | 'warn' | 'error', event: string, context: LogContext = {}) {
  const redacted = redactLogContext(context);
  const correlation_id = redacted.correlation_id ?? redacted.correlationId;
  delete redacted.correlationId;
  const record = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...(correlation_id ? { correlation_id } : {}), ...redacted });
  if (level === 'error') console.error(record);
  else if (level === 'warn') console.warn(record);
  else console.info(record);
}
