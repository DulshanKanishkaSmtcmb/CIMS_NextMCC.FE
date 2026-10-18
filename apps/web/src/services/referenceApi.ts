import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';

/** GET /api/v1/reference/field-captions */
export interface FieldCaptions {
  sysCaption: string;
  contractNoCaption: string;
  itemNoCaption: string;
  poNoCaption: string;
  deliveryNoCaption: string;
}

export const FIELD_CAPTIONS_URL = '/api/v1/reference/field-captions';

export const referenceApi = createApi({
  reducerPath: 'referenceApi',
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getFieldCaptions: builder.query<FieldCaptions, void>({
      query: () => ({ url: FIELD_CAPTIONS_URL }),
    }),
  }),
});

export const { useGetFieldCaptionsQuery } = referenceApi;
