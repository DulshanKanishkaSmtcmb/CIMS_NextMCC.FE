import axios from 'axios';

/** Shape of an ASP.NET Core ProblemDetails body (all fields optional). */
export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
}

/** HTTP status of a failed request, or undefined for network errors and non-HTTP failures. */
export function getErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

/** A readable message for any thrown value. Never leaks raw response bodies. */
export function getErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ProblemDetails | undefined;
    if (data && typeof data === 'object') {
      if (typeof data.detail === 'string' && data.detail) return data.detail;
      if (typeof data.title === 'string' && data.title) return data.title;
    }
    if (error.response) return `${fallback} (HTTP ${error.response.status})`;
    return 'Cannot reach the server';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
