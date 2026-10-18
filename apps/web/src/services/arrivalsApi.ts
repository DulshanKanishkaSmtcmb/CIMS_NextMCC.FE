import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';

/** GET /api/v1/arrivals/confirm/dcs (legacy DataApi/getDCList). */
export interface ArrivalDc {
  whDes: string;
}

/** GET /api/v1/arrivals/confirm/countries (legacy DataApi/getCountryList). */
export interface ArrivalCountry {
  countryCode: string;
  countryName: string;
}

/** One contract pending arrival confirmation. Dates are local ISO strings without offset; numbers are numbers. */
export interface PendingContract {
  rcvNo: string;
  arrivalDate: string | null;
  contractNo: string;
  itemNo: string;
  shipperCode: string;
  shipperName: string | null;
  cargoType: string;
  warehouse: string;
  ctns: number;
  pcs: number;
  grossWgt: number;
  cbm: number;
  inboundVesselOrderNo: number;
  inboundBookingDate: string | null;
  confirmArriveStatus: string;
  inboundEtd: string | null;
  inboundContainerOrderNo: number;
  country: string;
}

export interface PendingSupplier {
  shipperCode: string;
  shipperName: string | null;
}

export interface PendingContainer {
  inboundEtd: string | null;
  inboundVesselOrderNo: number;
  inboundContainerOrderNo: number;
  vesselName: string;
  loadReference: string;
  containerNo: string;
  containerType: string;
}

/** GET /api/v1/arrivals/confirm/pending (legacy DataApi/getPendingPO4ConfirmArrival dtMain, dtDtl1, dtDtl2). */
export interface PendingArrivals {
  contracts: PendingContract[];
  suppliers: PendingSupplier[];
  containers: PendingContainer[];
}

export interface PendingArrivalsArgs {
  cargoFrom: string;
  dc: string;
  country: string;
}

/** POST /api/v1/arrivals/confirm (legacy SaveApi/SaveContractConfirmArrival). */
export interface ConfirmArrivalRequest {
  /** Local yyyy-MM-ddTHH:mm:ss, never UTC. */
  arrivalDate: string;
  rcvNos: string[];
  container: {
    inboundEtd: string | null;
    vesselOrderNo: number;
    vesselName: string;
    containerOrderNo: number;
    loadReference: string;
    containerNo: string;
    containerType: string;
  } | null;
}

export interface ConfirmArrivalResult {
  contractsConfirmed: number;
  importVesselUpdated: boolean;
  importContainerUpdated: boolean;
  message: string;
}

export const ARRIVALS_URL = '/api/v1/arrivals';

export const arrivalsApi = createApi({
  reducerPath: 'arrivalsApi',
  baseQuery: axiosBaseQuery(),
  endpoints: (builder) => ({
    getConfirmArrivalDcs: builder.query<ArrivalDc[], void>({
      query: () => ({ url: `${ARRIVALS_URL}/confirm/dcs` }),
    }),
    getConfirmArrivalCountries: builder.query<ArrivalCountry[], void>({
      query: () => ({ url: `${ARRIVALS_URL}/confirm/countries` }),
    }),
    // Loaded on "Load Contracts" only, always fresh (the legacy page re-queried on every click).
    getPendingArrivals: builder.query<PendingArrivals, PendingArrivalsArgs>({
      query: (args) => ({ url: `${ARRIVALS_URL}/confirm/pending`, params: { ...args } }),
      keepUnusedDataFor: 0,
    }),
    confirmArrivals: builder.mutation<ConfirmArrivalResult, ConfirmArrivalRequest>({
      query: (body) => ({ url: `${ARRIVALS_URL}/confirm`, method: 'post', data: body }),
    }),
  }),
});

export const {
  useGetConfirmArrivalDcsQuery,
  useGetConfirmArrivalCountriesQuery,
  useLazyGetPendingArrivalsQuery,
  useConfirmArrivalsMutation,
} = arrivalsApi;
