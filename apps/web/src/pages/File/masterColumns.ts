import type { LookupColumn } from '@cims/ui';

/**
 * Columns of the list dialogs ("Countries Listing", "Ports Listing", "DC Listing"): every column of the table, in the
 * table's order, titled with the SQL column name exactly as the legacy DataTables showed it (legacy `dtHeading`).
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

export const PORT_COLUMNS: readonly LookupColumn[] = [
  { field: 'portCode', headerName: 'PortCode', width: 130 },
  { field: 'portName', headerName: 'PortName', width: 260 },
  { field: 'countryCode', headerName: 'CountryCode', width: 130 },
  { field: 'dateCreate', headerName: 'DateCreate', kind: 'dateTime' },
  { field: 'createBy', headerName: 'CreateBy' },
  { field: 'dateUpdate', headerName: 'DateUpdate', kind: 'dateTime' },
  { field: 'updateBy', headerName: 'UpdateBy' },
  { field: 'seaOrAirPort', headerName: 'SeaOrAirPort' },
  { field: 'isDivertable', headerName: 'IsDivertable', kind: 'boolean' },
];

const flag = (field: string, headerName: string): LookupColumn => ({
  field,
  headerName,
  kind: 'boolean',
  width: 140,
});

export const DC_COLUMNS: readonly LookupColumn[] = [
  { field: 'whCode', headerName: 'WhCode', width: 110 },
  { field: 'whDes', headerName: 'WhDes', width: 240 },
  { field: 'whDesMain', headerName: 'WhDesMain', width: 150 },
  { field: 'countryCode', headerName: 'CountryCode', width: 130 },
  { field: 'loadingOrder', headerName: 'LoadingOrder', kind: 'number' },
  flag('outerLabel', 'OuterLabel'),
  flag('eanLabelScan', 'EANLabelScan'),
  flag('reworkApply', 'ReworkApply'),
  flag('rfidPriceTag', 'RFIDPriceTag'),
  { field: 'rfidPriceTagValidate', headerName: 'RFIDPriceTagValidate', width: 180 },
  flag('removeOriginalTag', 'RemoveOriginalTag'),
  flag('jokerTagsForSets', 'JokerTagsForSets'),
  flag('careWarningLabel', 'CareWarningLabel'),
  flag('preValidationRun', 'PreValidationRun'),
  flag('eanLabelOuterBox', 'EANLabelOuterBox'),
  { field: 'eanDesCol', headerName: 'EANDesCol' },
  flag('packAdditionalBox', 'PackAdditionalBox'),
  { field: 'boxPmCode', headerName: 'BoxPMCode' },
  flag('hangerUse', 'HangerUse'),
  flag('eanLabelPiece', 'EANLabelPiece'),
  flag('postValidation', 'PostValidation'),
  flag('stockUpdate', 'StockUpdate'),
  flag('authorizedToPoPlan', 'AuthorizedToPOPlan'),
  flag('itemOptionFixedLength', 'ItemOptionFixedLength'),
  flag('itemOptionManual', 'ItemOptionManual'),
  { field: 'priceSymble', headerName: 'PriceSymble' },
  flag('printPriceTag', 'PrintPriceTag'),
  flag('boxPackSeperate', 'BoxPackSeperate'),
  flag('storePick', 'StorePick'),
  flag('isRfidOrder', 'IsRfidOrder'),
  { field: 'brandText', headerName: 'BrandText' },
  { field: 'barcodeType', headerName: 'BarcodeType' },
  flag('productCategory', 'ProductCategory'),
  flag('vasCheck', 'VasCheck'),
  flag('enaVerification', 'EnaVerification'),
  { field: 'eanLblType', headerName: 'EanLblType' },
  { field: 'address', headerName: 'Address', width: 300 },
  { field: 'lpnLblType', headerName: 'LpnLblType' },
];
