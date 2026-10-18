import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type CreateAxiosDefaults,
} from 'axios';

type MaybePromise<T> = T | Promise<T>;

export interface ApiClientConfig {
  /** Base URL of the API, or '' for same origin (behind the gateway). */
  baseURL: string;
  /** Returns the current access token. Tokens are owned by the caller (oidc-client-ts), never stored here. */
  getToken?: () => MaybePromise<string | null | undefined>;
  /** Returns the selected tenant id, sent as the X-Tenant header. */
  getTenant?: () => string | null | undefined;
  /** Called after any 401 response. The error is still rejected to the caller. */
  onUnauthorized?: (error: AxiosError) => void;
  /** Request timeout in milliseconds. Default 30000. */
  timeout?: number;
  /** Extra axios defaults, e.g. a custom adapter in tests. */
  axiosConfig?: CreateAxiosDefaults;
}

export const TENANT_HEADER = 'X-Tenant';

let instance: AxiosInstance | null = null;

/** Creates (or replaces) the shared axios instance. Call once at application start. */
export function configure(config: ApiClientConfig): AxiosInstance {
  const http = axios.create({
    timeout: 30_000,
    ...config.axiosConfig,
    baseURL: config.baseURL,
    ...(config.timeout !== undefined ? { timeout: config.timeout } : {}),
  });

  http.interceptors.request.use(async (request) => {
    const token = await config.getToken?.();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    const tenant = config.getTenant?.();
    if (tenant) {
      request.headers.set(TENANT_HEADER, tenant);
    }
    return request;
  });

  http.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        config.onUnauthorized?.(error);
      }
      return Promise.reject(error);
    },
  );

  instance = http;
  return http;
}

/** The configured instance. Throws if configure() has not been called. */
export function getHttp(): AxiosInstance {
  if (!instance) {
    throw new Error('@cims/api-client is not configured. Call configure() at application start.');
  }
  return instance;
}

/** Test helper: forget the configured instance. */
export function resetClient(): void {
  instance = null;
}

export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await getHttp().get<T>(url, config);
  return response.data;
}

export async function post<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig<B>,
): Promise<T> {
  const response = await getHttp().post<T>(url, body, config);
  return response.data;
}

export async function put<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig<B>,
): Promise<T> {
  const response = await getHttp().put<T>(url, body, config);
  return response.data;
}

export async function patch<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig<B>,
): Promise<T> {
  const response = await getHttp().patch<T>(url, body, config);
  return response.data;
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await getHttp().delete<T>(url, config);
  return response.data;
}
