import { masterDataApi, MASTER_DATA_URL } from './masterDataApi';

/** A row of "Rate Structure - Export Clearance Charges" (legacy getRateInformation4Add dtMain). */
export interface ClearanceRate {
  cntrType: string;
  rateInUsd: number;
}

/** A row of "Rate Structure - Export Freight Charges" (legacy dtDtl1). */
export interface FreightRate {
  portCode: string;
  portName: string;
  cntrType: string;
  rateInUsd: number;
}

/** A row of "Rate Structure - CFS Charges" (legacy dtDtl2: dbo.RateCFSExport plus the material's description). */
export interface CfsRate {
  chgCode: string;
  chgDescription: string;
  unitType: string;
  range1: number;
  range2: number;
  unitCalType: string | null;
  rateInUsd: number;
  isActive: boolean;
  fileCaption: string;
  materialCode: string;
  rateInUsdCost: number;
  rateUpdateBy: string;
  rateUpdateDate: string | null;
  pmDescription: string;
}

/** GET api/v1/master-data/rate-cards (legacy DataApi/getRateInformation4Add). */
export interface RateCard {
  clearance: ClearanceRate[];
  freight: FreightRate[];
  cfs: CfsRate[];
}

// Injected into the shared master-data slice, so the store keeps its single reducer and middleware.
export const rateCardApi = masterDataApi.injectEndpoints({
  endpoints: (builder) => ({
    getRateCard: builder.query<RateCard, void>({
      query: () => ({ url: `${MASTER_DATA_URL}/rate-cards` }),
    }),
  }),
});

export const { useLazyGetRateCardQuery } = rateCardApi;
