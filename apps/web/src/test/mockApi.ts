import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { configure } from '@cims/api-client';

export interface MockCall {
  method: string;
  /** Path and query as sent, e.g. /api/v1/master-data/countries/search?name=I */
  url: string;
  params?: Record<string, unknown>;
  body?: unknown;
}

export interface MockReply {
  status: number;
  data?: unknown;
}

/** Answers one request; return undefined for "not mocked" (the test then gets a 404). */
export type MockHandler = (call: MockCall) => MockReply | undefined;

function respond(config: InternalAxiosRequestConfig, reply: MockReply) {
  const response = {
    data: reply.data ?? {},
    status: reply.status,
    statusText: String(reply.status),
    headers: new AxiosHeaders(),
    config,
  };
  if (reply.status >= 400) {
    return Promise.reject(new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response));
  }
  return Promise.resolve(response);
}

/**
 * Points the shared @cims/api-client at an in-memory adapter. Returns the list of calls made, in order, so a test can
 * assert what a page sent. Call `resetClient()` in afterEach.
 */
export function installMockApi(handler: MockHandler): MockCall[] {
  const calls: MockCall[] = [];
  configure({
    baseURL: 'http://api.test',
    axiosConfig: {
      adapter: async (config) => {
        const call: MockCall = {
          method: (config.method ?? 'get').toUpperCase(),
          url: config.url ?? '',
          params: config.params as Record<string, unknown> | undefined,
          body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
        };
        calls.push(call);
        return respond(config, handler(call) ?? { status: 404, data: {} });
      },
    },
  });
  return calls;
}
