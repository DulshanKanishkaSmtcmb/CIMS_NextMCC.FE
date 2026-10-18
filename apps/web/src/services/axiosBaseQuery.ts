import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import axios from 'axios';
import { getErrorMessage, getErrorStatus, getHttp } from '@cims/api-client';

export interface ApiRequest {
  url: string;
  method?: 'get' | 'post' | 'put' | 'patch' | 'delete';
  data?: unknown;
  params?: Record<string, unknown>;
}

export interface ApiQueryError {
  status?: number;
  message: string;
  /** The API's ProblemDetails "code" extension (e.g. VALIDATION_FAILED, LEGACY_USER_NOT_FOUND), if any. */
  code?: string;
  /** Validation messages from the ProblemDetails "errors" extension, flattened in order. */
  details?: string[];
}

function problemExtras(error: unknown): Pick<ApiQueryError, 'code' | 'details'> {
  if (!axios.isAxiosError(error)) return {};
  const data = error.response?.data as { code?: unknown; errors?: unknown } | undefined;
  if (!data || typeof data !== 'object') return {};
  const code = typeof data.code === 'string' ? data.code : undefined;
  const details =
    data.errors && typeof data.errors === 'object'
      ? Object.values(data.errors as Record<string, unknown>)
          .flatMap((v) => (Array.isArray(v) ? v : [v]))
          .filter((v): v is string => typeof v === 'string')
      : undefined;
  return { code, details: details && details.length > 0 ? details : undefined };
}

/** RTK Query base query that sends requests through the shared @cims/api-client instance. */
export const axiosBaseQuery =
  (): BaseQueryFn<ApiRequest, unknown, ApiQueryError> =>
  async ({ url, method = 'get', data, params }) => {
    try {
      const response = await getHttp().request({ url, method, data, params });
      return { data: response.data as unknown };
    } catch (error) {
      return {
        error: {
          status: getErrorStatus(error),
          message: getErrorMessage(error),
          ...problemExtras(error),
        },
      };
    }
  };
