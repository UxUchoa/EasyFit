import { describe, expect, it, vi } from 'vitest';
import { logEvent, redactLogContext } from './logger';

describe('structured logger', () => {
  it('redacts credentials and sensitive content by key', () => {
    expect(redactLogContext({ correlationId: 'abc', password: 'plain', sessionToken: 'token', healthContent: 'private' })).toEqual({ correlationId: 'abc', password: '[REDACTED]', sessionToken: '[REDACTED]', healthContent: '[REDACTED]' });
  });

  it('writes one JSON record', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    logEvent('info', 'test.event', { correlationId: 'abc', durationMs: 12 });
    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toMatchObject({ level: 'info', event: 'test.event', correlation_id: 'abc', durationMs: 12 });
    info.mockRestore();
  });
});
