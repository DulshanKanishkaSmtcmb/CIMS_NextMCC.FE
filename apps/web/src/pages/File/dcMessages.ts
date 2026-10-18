/**
 * Texts of the DCs page (docs/19 section 11). Each comment names the legacy AppJs/DC.js text it replaces. The
 * validation OUTCOMES are the legacy ones: only the name is required (the country may stay empty), then the
 * existence check by name.
 */
export const DC_MESSAGES = {
  /** Legacy toast "Enter DC Name". */
  enterName: 'Enter the DC name',
  /** Legacy toast "DC Already Exist" (also the server's 409). */
  alreadyExists: (name: string) => `DC ${name} already exists. Choose another name.`,
  /** New: the typed name is in the loaded list already. */
  nameInUse: 'This DC is already in the list. Choose another name.',
  /** Legacy toast "DC not Exist" (also the server's 404). */
  doesNotExist: (name: string) =>
    `DC ${name} no longer exists. It may have been changed by someone else: reload the list.`,
  /** Legacy alert "Error Loading Port Data" (sic, D2; the new text names the DC). */
  checkFailedTitle: 'The DC could not be checked',
  loadFailedTitle: 'The DC could not be loaded',
  /** Legacy alert "Invalid Code". */
  notFound: (name: string) => `DC ${name} was not found. Reload the list.`,
  /** Legacy toast "Data Saved Successfully". */
  saved: (name: string, isNew: boolean) => (isNew ? `DC ${name} created.` : `DC ${name} saved.`),
  nameHelp: 'Up to 50 characters. It cannot be changed later.',
  /** Legacy: Country Code was never required. */
  countryOptional: 'Optional.',
  noCountry: 'No country',
  settingsTitle: 'Settings maintained in other screens',
  settingsHelp: 'For reference. This page changes only the country of a DC.',
} as const;
