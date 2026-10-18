import { masterDataApi, MASTER_DATA_URL, type SaveMode } from './masterDataApi';

/** GET api/v1/master-data/suppliers (legacy DataApi/getSupplierList, getSupplierData: select t1.* from Shipper). */
export interface Supplier {
  shipperCode: string;
  shipperName: string;
  shipperAddress1: string;
  shipperAddress2: string;
  shipperAddress3: string;
  shipperAddress4: string;
  shipperContact1: string;
  shipperContact2: string;
  shipperContact3: string;
  /** Local ISO date-time without offset, or null. */
  dateCreate: string | null;
  createBy: string;
  dateUpdate: string | null;
  updateBy: string;
  shipperCodeAir: string;
  shipperCodeSea: string;
  shipperTel: string;
  shipperEmail: string;
  shipperFax: string;
  countryCode: string | null;
  limaSupplierCode: string;
  rexNo: string;
}

/** GET api/v1/master-data/suppliers/search (legacy DataApi/findSupplierName). */
export interface SupplierNameHit {
  shipperCode: string;
  shipperName: string;
  shipperAddress1: string;
  shipperAddress2: string;
  shipperAddress3: string;
  shipperAddress4: string;
}

/** GET api/v1/master-data/suppliers/air-shippers | sea-shippers (legacy DataApi/getAirShipperList, getSeaShipperList). */
export interface FreightShipper {
  shCode: string;
  shName: string;
  shAdd1: string;
  shAdd2: string;
  shAdd3: string;
  shAdd4: string;
}

/** GET .../air-shippers/{code} | sea-shippers/{code} (legacy DataApi/getAirShipperData, getSeaShipperData). */
export interface FreightShipperName {
  shCode: string;
  shName: string;
}

/** Body of POST suppliers (New) and PUT suppliers/{code} (Change); a New save returns the generated code. */
export interface SaveSupplierArgs {
  mode: SaveMode;
  /** Only used for Change (the route). */
  shipperCode: string;
  shipperName: string;
  shipperAddress1: string;
  shipperAddress2: string;
  shipperAddress3: string;
  shipperAddress4: string;
  shipperContact1: string;
  shipperContact2: string;
  shipperContact3: string;
  shipperTel: string;
  shipperEmail: string;
  shipperFax: string;
  countryCode: string;
  shipperCodeAir: string;
  shipperCodeSea: string;
  limaSupplierCode: string;
  rexNo: string;
}

export interface SaveSupplierResult {
  supplierCode: string;
  message: string;
}

/** GET api/v1/master-data/pm-suppliers (legacy DataApi/getPMSupplierList, getPMSupplierData: select t1.* from PMSupplier). */
export interface PmSupplier {
  pmSupplierCode: string;
  pmSupplierName: string;
  pmSupplierAddress1: string;
  pmSupplierAddress2: string;
  pmSupplierAddress3: string;
  pmSupplierAddress4: string;
  pmSupplierContact1: string;
  pmSupplierContact2: string;
  pmSupplierContact3: string;
  pmSupplierTel: string;
  pmSupplierEmail: string;
  pmSupplierFax: string;
  countryCode: string | null;
}

export interface SavePmSupplierArgs {
  mode: SaveMode;
  /** Only used for Change (the route). */
  pmSupplierCode: string;
  pmSupplierName: string;
  pmSupplierAddress1: string;
  pmSupplierAddress2: string;
  pmSupplierAddress3: string;
  pmSupplierAddress4: string;
  pmSupplierContact1: string;
  pmSupplierContact2: string;
  pmSupplierContact3: string;
  pmSupplierTel: string;
  pmSupplierEmail: string;
  pmSupplierFax: string;
  countryCode: string;
}

export interface SavePmSupplierResult {
  pmSupplierCode: string;
  message: string;
}

const SUPPLIERS = `${MASTER_DATA_URL}/suppliers`;
const PM_SUPPLIERS = `${MASTER_DATA_URL}/pm-suppliers`;
const segment = (value: string) => encodeURIComponent(value);

/** Supplier (File/Supplier) and PM Supplier (File/PmSupplier) endpoints, on the master-data API slice. */
export const supplierApi = masterDataApi.injectEndpoints({
  endpoints: (builder) => ({
    getSuppliers: builder.query<Supplier[], void>({
      query: () => ({ url: SUPPLIERS }),
    }),
    getSupplier: builder.query<Supplier, string>({
      query: (code) => ({ url: `${SUPPLIERS}/${segment(code)}` }),
    }),
    searchSuppliers: builder.query<SupplierNameHit[], string>({
      query: (name) => ({ url: `${SUPPLIERS}/search`, params: { name, startsWith: true } }),
    }),
    getAirShippers: builder.query<FreightShipper[], void>({
      query: () => ({ url: `${SUPPLIERS}/air-shippers` }),
    }),
    getAirShipper: builder.query<FreightShipperName, string>({
      query: (code) => ({ url: `${SUPPLIERS}/air-shippers/${segment(code)}` }),
    }),
    getSeaShippers: builder.query<FreightShipper[], void>({
      query: () => ({ url: `${SUPPLIERS}/sea-shippers` }),
    }),
    getSeaShipper: builder.query<FreightShipperName, string>({
      query: (code) => ({ url: `${SUPPLIERS}/sea-shippers/${segment(code)}` }),
    }),
    saveSupplier: builder.mutation<SaveSupplierResult, SaveSupplierArgs>({
      query: ({ mode, shipperCode, ...body }) =>
        mode === 'New'
          ? { url: SUPPLIERS, method: 'post', data: body }
          : { url: `${SUPPLIERS}/${segment(shipperCode)}`, method: 'put', data: body },
    }),

    getPmSuppliers: builder.query<PmSupplier[], void>({
      query: () => ({ url: PM_SUPPLIERS }),
    }),
    getPmSupplier: builder.query<PmSupplier, string>({
      query: (code) => ({ url: `${PM_SUPPLIERS}/${segment(code)}` }),
    }),
    savePmSupplier: builder.mutation<SavePmSupplierResult, SavePmSupplierArgs>({
      query: ({ mode, pmSupplierCode, ...body }) =>
        mode === 'New'
          ? { url: PM_SUPPLIERS, method: 'post', data: body }
          : { url: `${PM_SUPPLIERS}/${segment(pmSupplierCode)}`, method: 'put', data: body },
    }),
  }),
});

export const {
  useLazyGetSuppliersQuery,
  useLazyGetSupplierQuery,
  useLazySearchSuppliersQuery,
  useLazyGetAirShippersQuery,
  useLazyGetAirShipperQuery,
  useLazyGetSeaShippersQuery,
  useLazyGetSeaShipperQuery,
  useSaveSupplierMutation,
  useLazyGetPmSuppliersQuery,
  useLazyGetPmSupplierQuery,
  useSavePmSupplierMutation,
} = supplierApi;
