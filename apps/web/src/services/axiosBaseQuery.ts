import type { BaseQueryFn } from '@reduxjs/toolkit/query';
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
}

/** RTK Query base query that sends requests through the shared @cims/api-client instance. */
export const axiosBaseQuery =
  (): BaseQueryFn<ApiRequest, unknown, ApiQueryError> =>
  async ({ url, method = 'get', data, params }) => {
    try {
      const response = await getHttp().request({ url, method, data, params });
      return { data: response.data as unknown };
    } catch (error) {
      return { error: { status: getErrorStatus(error), message: getErrorMessage(error) } };
    }
  };
