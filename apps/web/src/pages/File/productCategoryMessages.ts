/**
 * Texts of the Product Category (chain codes) page (docs/19 section 11). Each comment names the legacy
 * AppJs/ProductCategory.js text it replaces. The validation OUTCOMES are the legacy ones (docs/17 C.1): code empty,
 * code not one character, name, range, TP partner, range box EAN, then the duplicate check; the first one stops.
 */
export const PRODUCT_CATEGORY_MESSAGES = {
  /** Legacy toast "Can not be empty Chain Code". */
  codeRequired: 'Enter the chain code',
  /** Legacy toast "Chain Code must be exactly 1 character long". */
  codeLength: 'The chain code is one character',
  /** Legacy toast "Can not be empty Chain Name". */
  nameRequired: 'Enter the chain name',
  /** Legacy toast "Can not be empty Range". */
  rangeRequired: 'Choose the range',
  /** Legacy toast "Can not be empty TP Partner Name". */
  tpRequired: 'Enter the TP partner name',
  /** Legacy toast "Can not be empty Range Box EAN". */
  eanRequired: 'Enter the range box EAN',
  /** Legacy toast "Can not Duplicate same Chain Code" (also the server's 409). */
  duplicate: (code: string, name?: string) =>
    name
      ? `Chain code ${code} is already used by ${name}. Choose another code.`
      : `Chain code ${code} already exists. Choose another code.`,
  /** Legacy alert "Error Loading PM Category Data" (both loads). */
  loadFailedTitle: 'The chain codes could not be loaded',
  rangesFailed: 'The ranges could not be loaded. Reload the page to try again.',
  /** Legacy toast "Data Saved Successfully" (the form is cleared, the range kept). */
  added: (code: string, name: string) =>
    `Chain code ${code} (${name}) added. Enter the next one, or close the page.`,
  /** The legacy DataTables Copy / CSV / Excel / PDF / Print buttons were stubs in the port. */
  exportNotAvailable: 'Export (copy, CSV, Excel, PDF, print) is not available yet.',
  emptyTitle: 'No chain codes yet',
  emptyHelp: 'Add the first one with the form above.',
  noMatch: (text: string) => `No chain codes match “${text}”`,
} as const;
