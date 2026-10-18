/**
 * Texts of the Countries page (docs/19 section 11). Each comment names the legacy AppJs/Country.js text it replaces.
 * The validation OUTCOMES are the legacy ones (name checked before code, then the existence check; nothing is sent
 * when a check fails); only the words and where they appear changed. Shared texts: masterDataPage.ts.
 */
export const COUNTRY_MESSAGES = {
  /** Legacy toast "Enter Country Name". */
  enterName: 'Enter the country name',
  /** Legacy toast "Enter Country Code". */
  enterCode: 'Enter the country code',
  /** Legacy toast "Country Code Already Exist" (New and the code exists; also the server's 409). */
  alreadyExists: (code: string) => `Country code ${code} already exists. Choose another code.`,
  /** Typed in New mode, before saving: the code is in the list already (new, nothing legacy). */
  codeInUse: (name: string) => `Already used by ${name}. Choose another code.`,
  /** Legacy toast "Country Code not Exist" (Change and the code is gone; also the server's 404). */
  doesNotExist: (code: string) =>
    `Country ${code} no longer exists. It may have been changed by someone else: reload the list.`,
  /** Legacy alert "Error Loading Country Data" (the existence check or the record could not be read). */
  checkFailedTitle: 'The country could not be checked',
  loadFailedTitle: 'The country could not be loaded',
  /** Legacy alert "Invalid Code" (Enter with a code that does not exist): the record was removed meanwhile. */
  notFound: (code: string) => `Country ${code} was not found. Reload the list.`,
  /** Legacy toast "Data Saved Successfully". */
  saved: (code: string, isNew: boolean) =>
    isNew ? `Country ${code} created.` : `Country ${code} saved.`,
  /** New: the code of a new country is the key; it cannot be changed after saving. */
  codeHelp: 'Up to 10 characters. It cannot be changed later.',
  /** Legacy "Pre-Entered Supplier Listing" box (sic): the similar-names hint. */
  similarPlural: 'countries',
} as const;
