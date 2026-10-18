import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';

export const MASTER_DATA_URL = '/api/v1/master-data';

/** GET api/v1/master-data/countries (legacy DataApi/getCountryList, getCountryData: select t1.* from Country). */
export interface Country {
  countryCode: string;
  countryName: string;
  cargoMovement: string;
  /** Local ISO date-time without offset, or null. */
  dateEnter: string | null;
  enterBy: string;
  dateUpdate: string | null;
  updateBy: string;
  contractBlock: boolean;
}

/** GET api/v1/master-data/countries/search (legacy DataApi/findCountryName). */
export interface CountryNameHit {
  countryCode: string;
  countryName: string;
  cargoMovement: string;
}

/** GET api/v1/master-data/ports (legacy DataApi/getPortList, getPortData: select t1.* from Ports). */
export interface Port {
  portCode: string;
  portName: string;
  countryCode: string;
  dateCreate: string | null;
  createBy: string;
  dateUpdate: string | null;
  updateBy: string;
  seaOrAirPort: string;
  isDivertable: boolean;
}

/** GET api/v1/master-data/ports/search (legacy DataApi/findPortName). */
export interface PortNameHit {
  portCode: string;
  portName: string;
  countryCode: string;
}

/** GET api/v1/master-data/dcs (legacy DataApi/getDCList, getDCData: select t1.* from DestWarehouse). */
export interface Dc {
  whCode: string;
  whDes: string;
  whDesMain: string;
  countryCode: string;
  loadingOrder: number;
  outerLabel: boolean;
  eanLabelScan: boolean;
  reworkApply: boolean;
  rfidPriceTag: boolean;
  rfidPriceTagValidate: string;
  removeOriginalTag: boolean;
  jokerTagsForSets: boolean;
  careWarningLabel: boolean;
  preValidationRun: boolean;
  eanLabelOuterBox: boolean;
  eanDesCol: string;
  packAdditionalBox: boolean;
  boxPmCode: string;
  hangerUse: boolean;
  eanLabelPiece: boolean;
  postValidation: boolean;
  stockUpdate: boolean;
  authorizedToPoPlan: boolean;
  itemOptionFixedLength: boolean;
  itemOptionManual: boolean;
  priceSymble: string;
  printPriceTag: boolean;
  boxPackSeperate: boolean;
  storePick: boolean;
  isRfidOrder: boolean;
  brandText: string | null;
  barcodeType: string;
  productCategory: boolean;
  vasCheck: boolean;
  enaVerification: boolean;
  eanLblType: string;
  address: string;
  lpnLblType: string;
}

/** The legacy "Option" select: only New and Change save (View never does). */
export type SaveMode = 'New' | 'Change';

export interface SaveCountryArgs {
  mode: SaveMode;
  countryCode: string;
  countryName: string;
  cargoMovement: string;
}
export interface SavePortArgs {
  mode: SaveMode;
  portCode: string;
  portName: string;
  countryCode: string;
  isDivertable: boolean;
}
export interface SaveDcArgs {
  mode: SaveMode;
  whDes: string;
  countryCode: string;
}

/** Result of a save (legacy SaveResult: DocNo = the key, msg). */
export interface SaveResult {
  message: string;
}

const segment = (value: string) => encodeURIComponent(value);

export const masterDataApi = createApi({
  reducerPath: 'masterDataApi',
  baseQuery: axiosBaseQuery(),
  // Every lookup is read fresh when asked (the legacy pages queried on every click); nothing is kept.
  keepUnusedDataFor: 0,
  endpoints: (builder) => ({
    getCountries: builder.query<Country[], void>({
      query: () => ({ url: `${MASTER_DATA_URL}/countries` }),
    }),
    getCountry: builder.query<Country, string>({
      query: (code) => ({ url: `${MASTER_DATA_URL}/countries/${segment(code)}` }),
    }),
    searchCountries: builder.query<CountryNameHit[], string>({
      query: (name) => ({
        url: `${MASTER_DATA_URL}/countries/search`,
        params: { name, startsWith: true },
      }),
    }),
    saveCountry: builder.mutation<SaveResult, SaveCountryArgs>({
      query: ({ mode, countryCode, countryName, cargoMovement }) =>
        mode === 'New'
          ? {
              url: `${MASTER_DATA_URL}/countries`,
              method: 'post',
              data: { countryCode, countryName, cargoMovement },
            }
          : {
              url: `${MASTER_DATA_URL}/countries/${segment(countryCode)}`,
              method: 'put',
              data: { countryName, cargoMovement },
            },
    }),

    getPorts: builder.query<Port[], void>({
      query: () => ({ url: `${MASTER_DATA_URL}/ports` }),
    }),
    getPort: builder.query<Port, string>({
      query: (code) => ({ url: `${MASTER_DATA_URL}/ports/${segment(code)}` }),
    }),
    searchPorts: builder.query<PortNameHit[], string>({
      query: (name) => ({
        url: `${MASTER_DATA_URL}/ports/search`,
        params: { name, startsWith: true },
      }),
    }),
    savePort: builder.mutation<SaveResult, SavePortArgs>({
      query: ({ mode, portCode, portName, countryCode, isDivertable }) =>
        mode === 'New'
          ? {
              url: `${MASTER_DATA_URL}/ports`,
              method: 'post',
              data: { portCode, portName, countryCode, isDivertable },
            }
          : {
              url: `${MASTER_DATA_URL}/ports/${segment(portCode)}`,
              method: 'put',
              data: { portName, countryCode, isDivertable },
            },
    }),

    getDcs: builder.query<Dc[], void>({
      query: () => ({ url: `${MASTER_DATA_URL}/dcs` }),
    }),
    getDc: builder.query<Dc, string>({
      query: (whDes) => ({ url: `${MASTER_DATA_URL}/dcs/${segment(whDes)}` }),
    }),
    saveDc: builder.mutation<SaveResult, SaveDcArgs>({
      query: ({ mode, whDes, countryCode }) =>
        mode === 'New'
          ? { url: `${MASTER_DATA_URL}/dcs`, method: 'post', data: { whDes, countryCode } }
          : {
              url: `${MASTER_DATA_URL}/dcs/${segment(whDes)}`,
              method: 'put',
              data: { countryCode },
            },
    }),
  }),
});

export const {
  useLazyGetCountriesQuery,
  useLazyGetCountryQuery,
  useLazySearchCountriesQuery,
  useSaveCountryMutation,
  useLazyGetPortsQuery,
  useLazyGetPortQuery,
  useLazySearchPortsQuery,
  useSavePortMutation,
  useLazyGetDcsQuery,
  useLazyGetDcQuery,
  useSaveDcMutation,
} = masterDataApi;
