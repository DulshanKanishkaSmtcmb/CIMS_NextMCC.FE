import type { LookupColumn } from '@cims/ui';

/**
 * Columns of the Supplier and PM Supplier list dialogs: every column of the table, in the table's order, titled with the
 * SQL column name exactly as the legacy DataTables showed it (legacy `dtHeading`).
 */
export const SUPPLIER_COLUMNS: readonly LookupColumn[] = [
  { field: 'shipperCode', headerName: 'ShipperCode', width: 130 },
  { field: 'shipperName', headerName: 'ShipperName', width: 300 },
  { field: 'shipperAddress1', headerName: 'ShipperAddress1', width: 220 },
  { field: 'shipperAddress2', headerName: 'ShipperAddress2', width: 220 },
  { field: 'shipperAddress3', headerName: 'ShipperAddress3', width: 220 },
  { field: 'shipperAddress4', headerName: 'ShipperAddress4', width: 220 },
  { field: 'shipperContact1', headerName: 'ShipperContact1', width: 180 },
  { field: 'shipperContact2', headerName: 'ShipperContact2', width: 180 },
  { field: 'shipperContact3', headerName: 'ShipperContact3', width: 180 },
  { field: 'dateCreate', headerName: 'DateCreate', kind: 'dateTime' },
  { field: 'createBy', headerName: 'CreateBy' },
  { field: 'dateUpdate', headerName: 'DateUpdate', kind: 'dateTime' },
  { field: 'updateBy', headerName: 'UpdateBy' },
  { field: 'shipperCodeAir', headerName: 'ShipperCodeAir' },
  { field: 'shipperCodeSea', headerName: 'ShipperCodeSea' },
  { field: 'shipperTel', headerName: 'ShipperTel', width: 180 },
  { field: 'shipperEmail', headerName: 'ShipperEmail', width: 220 },
  { field: 'shipperFax', headerName: 'ShipperFax', width: 180 },
  { field: 'countryCode', headerName: 'CountryCode' },
  { field: 'limaSupplierCode', headerName: 'LimaSupplierCode' },
  { field: 'rexNo', headerName: 'REXNo' },
];

export const PM_SUPPLIER_COLUMNS: readonly LookupColumn[] = [
  { field: 'pmSupplierCode', headerName: 'PMSupplierCode', width: 150 },
  { field: 'pmSupplierName', headerName: 'PMSupplierName', width: 300 },
  { field: 'pmSupplierAddress1', headerName: 'PMSupplierAddress1', width: 220 },
  { field: 'pmSupplierAddress2', headerName: 'PMSupplierAddress2', width: 220 },
  { field: 'pmSupplierAddress3', headerName: 'PMSupplierAddress3', width: 220 },
  { field: 'pmSupplierAddress4', headerName: 'PMSupplierAddress4', width: 220 },
  { field: 'pmSupplierContact1', headerName: 'PMSupplierContact1', width: 180 },
  { field: 'pmSupplierContact2', headerName: 'PMSupplierContact2', width: 180 },
  { field: 'pmSupplierContact3', headerName: 'PMSupplierContact3', width: 180 },
  { field: 'pmSupplierTel', headerName: 'PMSupplierTel', width: 180 },
  { field: 'pmSupplierEmail', headerName: 'PMSupplierEmail', width: 220 },
  { field: 'pmSupplierFax', headerName: 'PMSupplierFax', width: 180 },
  { field: 'countryCode', headerName: 'CountryCode' },
];

/** The "Sea Shipper Listing" and "Air Shipper Listing" dialogs (legacy `select ShCode, ShName, ShAdd1..4`). */
export const FREIGHT_SHIPPER_COLUMNS: readonly LookupColumn[] = [
  { field: 'shCode', headerName: 'ShCode', width: 110 },
  { field: 'shName', headerName: 'ShName', width: 300 },
  { field: 'shAdd1', headerName: 'ShAdd1', width: 220 },
  { field: 'shAdd2', headerName: 'ShAdd2', width: 220 },
  { field: 'shAdd3', headerName: 'ShAdd3', width: 220 },
  { field: 'shAdd4', headerName: 'ShAdd4', width: 220 },
];
