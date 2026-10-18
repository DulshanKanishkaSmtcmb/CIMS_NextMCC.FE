import { masterDataApi, MASTER_DATA_URL, type SaveResult } from './masterDataApi';

/** GET api/v1/master-data/pallet-racks (legacy DataApi/getPalletRacksList, getPalletRacksData dtMain: select t1.* from PalletRacks). */
export interface PalletRack {
  rackNo: string;
  nofRows: number;
  nofLayers: number;
  nofPositions: number;
}

/** A row of dbo.PalletRacksUtilization (legacy getPalletRacksData dtDtl1): a pallet position and what it holds. */
export interface PalletPosition {
  rackNo: string;
  positionNo: string;
  grnNo: string;
  palletNo: string;
}

/** GET api/v1/master-data/pallet-racks/{rackNo}: the rack (null when it does not exist) and its positions. */
export interface PalletRackData {
  rack: PalletRack | null;
  positions: PalletPosition[];
}

export interface PalletRackArgs {
  rackNo: string;
  /** Also read the rack's positions. */
  positions: boolean;
}

/** POST api/v1/master-data/pallet-racks (legacy SaveApi/SaveCargoPalletBuild). */
export interface CreatePalletRackArgs {
  rackNo: string;
  nofRows: number;
  nofLayers: number;
  nofPositions: number;
  /** The positions that are in use (the ones the page has not disabled), in layout order. */
  positions: string[];
}

// Injected into the shared master-data slice, so the store keeps its single reducer and middleware.
export const palletRackApi = masterDataApi.injectEndpoints({
  endpoints: (builder) => ({
    getPalletRacks: builder.query<PalletRack[], void>({
      query: () => ({ url: `${MASTER_DATA_URL}/pallet-racks` }),
    }),
    getPalletRack: builder.query<PalletRackData, PalletRackArgs>({
      query: ({ rackNo, positions }) => ({
        url: `${MASTER_DATA_URL}/pallet-racks/${encodeURIComponent(rackNo)}`,
        params: { positions },
      }),
    }),
    createPalletRack: builder.mutation<SaveResult, CreatePalletRackArgs>({
      query: (data) => ({ url: `${MASTER_DATA_URL}/pallet-racks`, method: 'post', data }),
    }),
  }),
});

export const {
  useLazyGetPalletRacksQuery,
  useLazyGetPalletRackQuery,
  useCreatePalletRackMutation,
} = palletRackApi;
