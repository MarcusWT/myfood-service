import { describe, it, expect, vi, afterEach } from 'vitest';

describe('request-logger.middleware', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../../../../config.js');
    vi.doUnmock('morgan');
  });

  it('is a no-op passthrough when NODE_ENV is test', async () => {
    vi.doMock('../../../../config.js', () => ({
      config: { nodeEnv: 'test' },
    }));

    const { createRequestLogger } = await import('../request-logger.middleware.js');
    const middleware = createRequestLogger();

    const next = vi.fn();
    middleware({} as never, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses morgan("dev") outside the test environment', async () => {
    vi.doMock('../../../../config.js', () => ({
      config: { nodeEnv: 'development' },
    }));

    const morganMiddleware = vi.fn();
    const morganMock = vi.fn().mockReturnValue(morganMiddleware);
    vi.doMock('morgan', () => ({ default: morganMock }));

    const { createRequestLogger } = await import('../request-logger.middleware.js');
    const middleware = createRequestLogger();

    expect(morganMock).toHaveBeenCalledWith('dev', expect.objectContaining({ stream: expect.anything() }));
    expect(middleware).toBe(morganMiddleware);
  });

  it('skips logging for /health and /health/ready', async () => {
    vi.doMock('../../../../config.js', () => ({
      config: { nodeEnv: 'development' },
    }));

    const morganMock = vi.fn().mockReturnValue(vi.fn());
    vi.doMock('morgan', () => ({ default: morganMock }));

    const { createRequestLogger } = await import('../request-logger.middleware.js');
    createRequestLogger();

    const options = morganMock.mock.calls[0][1] as { skip: (req: { path: string }) => boolean };
    expect(options.skip({ path: '/health' })).toBe(true);
    expect(options.skip({ path: '/health/ready' })).toBe(true);
    expect(options.skip({ path: '/api/v1/food-items' })).toBe(false);
  });
});
