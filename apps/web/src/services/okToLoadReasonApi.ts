import { masterDataApi, MASTER_DATA_URL, type SaveResult } from './masterDataApi';

/** GET api/v1/master-data/ok-to-load-reasons (legacy DataApi/getOkToLoadResonListUpdate; isAttched is now isAllocated). */
export interface OkToLoadReason {
  reason: string;
  dtlReson: string;
  dc: string;
  /** Contracts of the DC already carry this reason: the page does not let it be removed. */
  isAllocated: boolean;
}

export interface OkToLoadReasonsArgs {
  dc: string;
  checkAllocation: boolean;
}

export interface ReplaceOkToLoadReasonsArgs {
  dc: string;
  reasons: { reason: string; dtlReson: string }[];
}

// Injected into the shared master-data slice, so the store keeps its single reducer and middleware.
export const okToLoadReasonApi = masterDataApi.injectEndpoints({
  endpoints: (builder) => ({
    getOkToLoadReasons: builder.query<OkToLoadReason[], OkToLoadReasonsArgs>({
      query: ({ dc, checkAllocation }) => ({
        url: `${MASTER_DATA_URL}/ok-to-load-reasons`,
        params: { dc, checkAllocation },
      }),
    }),
    replaceOkToLoadReasons: builder.mutation<SaveResult, ReplaceOkToLoadReasonsArgs>({
      query: (data) => ({ url: `${MASTER_DATA_URL}/ok-to-load-reasons`, method: 'put', data }),
    }),
  }),
});

export const { useGetOkToLoadReasonsQuery, useReplaceOkToLoadReasonsMutation } = okToLoadReasonApi;
