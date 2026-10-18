/**
 * Texts of the Ports page (docs/19 section 11). Each comment names the legacy AppJs/Ports.js text it replaces. The
 * validation OUTCOMES are the legacy ones (name before code, then the existence check; the country stays optional).
 */
export const PORT_MESSAGES = {
  /** Legacy toast "Enter Port Name". */
  enterName: 'Enter the port name',
  /** Legacy toast "Enter Port Code". */
  enterCode: 'Enter the port code',
  /** Legacy toast "Port Code Already Exist" (also the server's 409). */
  alreadyExists: (code: string) => `Port code ${code} already exists. Choose another code.`,
  /** New: the typed code is in the loaded list already. */
  codeInUse: (name: string) => `Already used by ${name}. Choose another code.`,
  /** Legacy toast "Port Code not Exist" (also the server's 404). */
  doesNotExist: (code: string) =>
    `Port ${code} no longer exists. It may have been changed by someone else: reload the list.`,
  /** Legacy alert "Error Loading Port Data". */
  checkFailedTitle: 'The port could not be checked',
  loadFailedTitle: 'The port could not be loaded',
  /** Legacy alert "Invalid Code". */
  notFound: (code: string) => `Port ${code} was not found. Reload the list.`,
  /** Legacy toast "Data Saved Successfully". */
  saved: (code: string, isNew: boolean) =>
    isNew ? `Port ${code} created.` : `Port ${code} saved.`,
  codeHelp: 'Up to 10 characters. It cannot be changed later.',
  /** Legacy: Country Code was never required (one port, DAC, has none). */
  countryOptional: 'Optional.',
  noCountry: 'No country',
  /** Legacy "Pre-Entered Ports Listing" box. */
  similarPlural: 'ports',
} as const;
