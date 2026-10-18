import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { configure, get, getHttp, post, resetClient } from './client';
import { getErrorMessage } from './errors';
import { legacySession } from './legacySession';

function respond(status: number, data: unknown = {}): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => {
    const response: AxiosResponse = { data, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      throw new AxiosError('failed', String(status), config, null, response);
    }
    return response;
  };
}

afterEach(() => resetClient());

describe('configure', () => {
  it('throws a clear error when used before configure()', () => {
    expect(() => getHttp()).toThrow(/not configured/);
  });

  it('uses the configured base URL', () => {
    const http = configure({ baseURL: 'http://api.test' });
    expect(http.defaults.baseURL).toBe('http://api.test');
  });

  it('injects the bearer token and tenant header', async () => {
    let seen: InternalAxiosRequestConfig | undefined;
    configure({
      baseURL: 'http://api.test',
      getToken: async () => 'tok-123',
      getTenant: () => 'MCC',
      axiosConfig: {
        adapter: async (config) => {
          seen = config;
          return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
        },
      },
    });

    const data = await get<{ ok: boolean }>('/api/v1/ping');

    expect(data).toEqual({ ok: true });
    expect(seen?.headers.get('Authorization')).toBe('Bearer tok-123');
    expect(seen?.headers.get('X-Tenant')).toBe('MCC');
  });

  it('omits Authorization and X-Tenant when there is no token or tenant', async () => {
    let seen: InternalAxiosRequestConfig | undefined;
    configure({
      baseURL: 'http://api.test',
      getToken: () => null,
      getTenant: () => null,
      axiosConfig: {
        adapter: async (config) => {
          seen = config;
          return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
        },
      },
    });

    await get('/api/v1/ping');

    expect(seen?.headers.has('Authorization')).toBe(false);
    expect(seen?.headers.has('X-Tenant')).toBe(false);
  });

  it('calls onUnauthorized on 401 and still rejects', async () => {
    const onUnauthorized = vi.fn();
    configure({
      baseURL: 'http://api.test',
      onUnauthorized,
      axiosConfig: { adapter: respond(401) },
    });

    await expect(get('/api/v1/secure')).rejects.toBeInstanceOf(AxiosError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not call onUnauthorized for other errors', async () => {
    const onUnauthorized = vi.fn();
    configure({
      baseURL: 'http://api.test',
      onUnauthorized,
      axiosConfig: { adapter: respond(500) },
    });

    await expect(post('/api/v1/x', {})).rejects.toBeInstanceOf(AxiosError);
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('legacySession.create', () => {
  it('posts to /api/v1/legacy-session with credentials', async () => {
    let seen: InternalAxiosRequestConfig | undefined;
    configure({
      baseURL: 'http://api.test',
      axiosConfig: {
        adapter: async (config) => {
          seen = config;
          return { data: {}, status: 204, statusText: '', headers: {}, config };
        },
      },
    });

    const result = await legacySession.create();

    expect(result).toEqual({ available: true, status: 200 });
    expect(seen?.method).toBe('post');
    expect(seen?.url).toBe('/api/v1/legacy-session');
    expect(seen?.withCredentials).toBe(true);
  });

  it('treats 501 as "not available yet" without throwing', async () => {
    configure({ baseURL: 'http://api.test', axiosConfig: { adapter: respond(501) } });

    await expect(legacySession.create()).resolves.toEqual({ available: false, status: 501 });
  });

  it('rethrows other failures', async () => {
    configure({ baseURL: 'http://api.test', axiosConfig: { adapter: respond(500) } });

    await expect(legacySession.create()).rejects.toBeInstanceOf(AxiosError);
  });
});

describe('getErrorMessage', () => {
  const problem = (data: unknown) =>
    new AxiosError('x', '400', undefined, null, {
      data,
      status: 400,
      statusText: '',
      headers: {},
      config: {} as InternalAxiosRequestConfig,
    });

  it('prefers ProblemDetails detail, then title', () => {
    expect(getErrorMessage(problem({ detail: 'Bad item', title: 'Bad request' }))).toBe('Bad item');
    expect(getErrorMessage(problem({ title: 'Bad request' }))).toBe('Bad request');
    expect(getErrorMessage(problem('<html/>'))).toBe('Something went wrong (HTTP 400)');
  });

  it('handles network errors and plain errors', () => {
    expect(getErrorMessage(new AxiosError('Network Error'))).toBe('Cannot reach the server');
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage(42)).toBe('Something went wrong');
  });
});
