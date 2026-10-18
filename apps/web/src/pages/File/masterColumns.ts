import type { LookupColumn } from '@cims/ui';

/**
 * Columns of the "Countries Listing" dialog the supplier pages still use: every column of the table, in the table's
 * order, titled with the SQL column name exactly as the legacy DataTables showed it (legacy `dtHeading`).
 */
export const COUNTRY_COLUMNS: readonly LookupColumn[] = [
  { field: 'countryCode', headerName: 'CountryCode', width: 130 },
  { field: 'countryName', headerName: 'CountryName', width: 220 },
  { field: 'cargoMovement', headerName: 'CargoMovement', width: 140 },
  { field: 'dateEnter', headerName: 'DateEnter', kind: 'dateTime' },
  { field: 'enterBy', headerName: 'EnterBy' },
  { field: 'dateUpdate', headerName: 'DateUpdate', kind: 'dateTime' },
  { field: 'updateBy', headerName: 'UpdateBy' },
  { field: 'contractBlock', headerName: 'ContractBlock', kind: 'boolean' },
];
