import type { LookupColumn } from '@cims/ui';

/**
 * Columns of the "Packing Material Master Listing" dialog: every PMMaster column, in the table's order, titled with the
 * SQL column name as the legacy DataTables showed it (legacy `dtHeading`). Decimal and money columns show no decimals,
 * like the legacy renderer.
 */
export const PM_MASTER_COLUMNS: readonly LookupColumn[] = [
  { field: 'pmCode', headerName: 'PMCode', width: 130 },
  { field: 'pmDescription', headerName: 'PMDescription', width: 300 },
  { field: 'pmCategory', headerName: 'PMCategory', width: 130 },
  { field: 'pmIssueType', headerName: 'PMIssueType', width: 130 },
  { field: 'qtyInHand', headerName: 'QtyInHand', kind: 'number', width: 130 },
  { field: 'qtyReOrderLevel', headerName: 'QtyReOrderLevel', kind: 'number', width: 150 },
  { field: 'pmWgt', headerName: 'PMWgt', kind: 'number', width: 110 },
  { field: 'pmCbm', headerName: 'PMCBM', kind: 'number', width: 110 },
  { field: 'getJokerCount', headerName: 'GetJokerCount', kind: 'boolean', width: 140 },
  { field: 'getPartCount', headerName: 'GetPartCount', kind: 'boolean', width: 140 },
  { field: 'getCtnCount', headerName: 'GetCtnCount', kind: 'boolean', width: 140 },
  { field: 'stockCbm', headerName: 'StockCBM', kind: 'number', width: 120 },
  { field: 'isActive', headerName: 'IsActive', kind: 'boolean', width: 110 },
];
