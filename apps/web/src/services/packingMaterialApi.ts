import { masterDataApi, MASTER_DATA_URL, type SaveMode, type SaveResult } from './masterDataApi';

/** GET api/v1/master-data/pm-masters (legacy DataApi/getPMList, getPMData: select t1.* from PMMaster). */
export interface PmMaster {
  pmCode: string;
  pmDescription: string;
  pmCategory: string;
  pmIssueType: string;
  qtyInHand: number;
  qtyReOrderLevel: number;
  pmWgt: number;
  pmCbm: number;
  getJokerCount: boolean;
  getPartCount: boolean;
  getCtnCount: boolean;
  stockCbm: number;
  isActive: boolean;
}

/** GET api/v1/master-data/pm-masters/categories (legacy DataApi/getPmCategoryData). */
export interface PmCategory {
  pmCategory: string;
}

export interface SavePmMasterArgs {
  mode: SaveMode;
  pmCode: string;
  pmDescription: string;
  pmCategory: string;
  reorderLevel: number;
  pmWeight: number;
  cbm: number;
  getJokersCount: boolean;
  getPartsCount: boolean;
  isActive: boolean;
}

/** GET api/v1/master-data/product-categories (legacy DataApi/getChainCategoryData: ContractsChainCodes). */
export interface ChainCode {
  chainCode: string;
  chainName: string;
  tpPartnerName: string;
  range: string;
  rangeBoxEan: string;
}

/** GET api/v1/master-data/product-categories/ranges (legacy DataApi/getProductCategoryData). */
export interface ChainRange {
  category: string;
}

export interface SaveChainCodeArgs {
  chainCode: string;
  chainName: string;
  range: string;
  tpPartnerName: string;
  rangeBoxEan: string;
}

const segment = (value: string) => encodeURIComponent(value);

// Injected into the shared master-data slice, so the store keeps its single reducer and middleware.
export const packingMaterialApi = masterDataApi.injectEndpoints({
  endpoints: (builder) => ({
    getPmMasters: builder.query<PmMaster[], void>({
      query: () => ({ url: `${MASTER_DATA_URL}/pm-masters` }),
    }),
    getPmMaster: builder.query<PmMaster, string>({
      query: (code) => ({ url: `${MASTER_DATA_URL}/pm-masters/${segment(code)}` }),
    }),
    getPmCategories: builder.query<PmCategory[], void>({
      query: () => ({ url: `${MASTER_DATA_URL}/pm-masters/categories` }),
    }),
    savePmMaster: builder.mutation<SaveResult, SavePmMasterArgs>({
      query: ({
        mode,
        pmCode,
        pmDescription,
        pmCategory,
        reorderLevel,
        pmWeight,
        cbm,
        getJokersCount,
        getPartsCount,
        isActive,
      }) =>
        mode === 'New'
          ? {
              url: `${MASTER_DATA_URL}/pm-masters`,
              method: 'post',
              data: {
                pmCode,
                pmDescription,
                pmCategory,
                reorderLevel,
                pmWeight,
                cbm,
                getJokersCount,
                getPartsCount,
                isActive,
              },
            }
          : {
              url: `${MASTER_DATA_URL}/pm-masters/${segment(pmCode)}`,
              method: 'put',
              data: {
                pmDescription,
                pmCategory,
                reorderLevel,
                pmWeight,
                cbm,
                getJokersCount,
                getPartsCount,
                isActive,
              },
            },
    }),

    getChainCodes: builder.query<ChainCode[], void>({
      query: () => ({ url: `${MASTER_DATA_URL}/product-categories` }),
    }),
    getChainRanges: builder.query<ChainRange[], void>({
      query: () => ({ url: `${MASTER_DATA_URL}/product-categories/ranges` }),
    }),
    saveChainCode: builder.mutation<SaveResult, SaveChainCodeArgs>({
      query: (data) => ({ url: `${MASTER_DATA_URL}/product-categories`, method: 'post', data }),
    }),
  }),
});

export const {
  useLazyGetPmMastersQuery,
  useLazyGetPmMasterQuery,
  useGetPmCategoriesQuery,
  useSavePmMasterMutation,
  useGetChainCodesQuery,
  useGetChainRangesQuery,
  useSaveChainCodeMutation,
} = packingMaterialApi;
