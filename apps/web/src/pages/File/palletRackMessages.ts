/**
 * Texts of the Pallet rack build page (docs/19 section 11). Each comment names the legacy AppJs/PalletRackBuildArr.js
 * text it replaces. The validation OUTCOMES are the legacy ones (docs/18 E.1): rack, rows, the row and layer limits,
 * at least one position in use, then the rack must not exist yet; the limits are the ones the legacy check let
 * through (99 rows and 12 layers are allowed, although the old texts said "less than").
 */
export const PALLET_RACK_MESSAGES = {
  /** Legacy toast "Enter Rack No". */
  rackRequired: 'Enter the rack number',
  /** Legacy toast "Enter Nof of Rows in side Rack". */
  rowsRequired: 'Enter the number of rows',
  /** Legacy toast "Nof of Rows must be less than 99" (99 was accepted; a negative number was refused with it). */
  rowsRange: 'A rack has 1 to 99 rows',
  /** Legacy toast "Nof of Layers must be less than 12" (12 was accepted). */
  layersRange: 'A rack has at most 12 layers',
  /** New: no layers gave an empty layout and then "Nothing to save". */
  layersRequired: 'Enter the number of layers',
  /** Legacy toast "Nothing to save any Pallet Positions". */
  noLayout: 'Create the layout first, then save',
  nothingOn: 'Turn at least one position on before saving',
  /** New: the inputs no longer match the layout on screen (legacy saved the inputs with the old layout, P4). */
  layoutStale:
    'The rack number, rows or layers changed after the layout was made. Create the layout again.',
  /** Legacy toast "Pallet Rack Already Exist" (the existence check and the server's 409). */
  alreadyExists: (rack: string) =>
    `Rack ${rack} already exists. Choose View stored rack to see it.`,
  /** Legacy alert "Error Loading Pallet Rack Data". */
  loadFailedTitle: 'The rack could not be loaded',
  /** Legacy alerts "No data found to list out" / "Unable to process Ajax Request" of the rack listing. */
  listEmpty: 'There are no racks to choose from.',
  listFailed: 'The rack list could not be loaded. Try the search button again.',
  /** Legacy toast " Data Saved Successfully". */
  saved: (rack: string, positions: number) =>
    `Rack ${rack} saved with ${positions} ${positions === 1 ? 'position' : 'positions'} in use.`,
  rackHelpNew: 'Position numbers are rack-row-layer (A35-01-01) and at most 10 characters long.',
  rackHelpView: 'Pick a stored rack with the search button.',
  viewOnly:
    'A stored rack is shown as it is: this page cannot change or delete a rack (business question Q10).',
  emptyLayoutTitle: 'No layout yet',
  emptyLayoutNew: 'Enter the rack, rows and layers in step 1 and choose Create layout.',
  emptyLayoutView: 'Pick a stored rack in step 1 and choose Load layout.',
} as const;
