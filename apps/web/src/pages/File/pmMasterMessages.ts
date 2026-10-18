/**
 * Texts of the Packing materials page (docs/19 section 11). Each comment names the legacy AppJs/PMMaster.js text it
 * replaces (the legacy ones had typos: "Meterial", "Is Acive"). The validation OUTCOMES are the legacy ones (docs/17
 * B.1): description, code (new), the three numbers, then the existence check, then the two counts (M2: refused).
 */
export const PM_MASTER_MESSAGES = {
  /** Legacy toast "Enter Description". */
  enterDescription: 'Enter the description',
  /** Legacy toast "Enter PM Code". */
  enterCode: 'Enter the packing material code',
  /** Legacy toasts "Reorder Level / PM Weight / CBM must be positive number" (0 is allowed). */
  reorderNegative: 'Enter a reorder level of 0 or more',
  weightNegative: 'Enter a weight of 0 or more',
  cbmNegative: 'Enter a CBM of 0 or more',
  /** Legacy toast "can not be select Get Jokers Count and Get Parts Count both check box" (it then saved anyway, M2). */
  bothCounts: 'Choose either jokers count or parts count, not both',
  /** Legacy toast "Meterial Code Already Exist" (also the server's 409). */
  alreadyExists: (code: string) =>
    `Packing material code ${code} already exists. Choose another code.`,
  codeInUse: (description: string) => `Already used by ${description}. Choose another code.`,
  /** Legacy toast "Meterial Code not Exist" (also the server's 404). */
  doesNotExist: (code: string) =>
    `Packing material ${code} no longer exists. It may have been changed by someone else: reload the list.`,
  /** Legacy alert "Error Loading Country Data" (sic, M5; the previous port said "Error Loading PM Data"). */
  checkFailedTitle: 'The packing material could not be checked',
  loadFailedTitle: 'The packing material could not be loaded',
  notFound: (code: string) => `Packing material ${code} was not found. Reload the list.`,
  /** Legacy alert "Error Loading PM Category Data". */
  categoriesFailed: 'The PM categories could not be loaded. Reload the page to try again.',
  /** Legacy toast "Data Saved Successfully". */
  saved: (code: string, isNew: boolean) =>
    isNew ? `Packing material ${code} created.` : `Packing material ${code} saved.`,
  codeHelp: 'Up to 10 characters. It cannot be changed later.',
  /** M1 / business question Q1 made visible: the save keeps two decimals. */
  twoDecimals: (stored: number) =>
    `Stored as ${stored}. Saving keeps two decimals (business question Q1).`,
} as const;
