/**
 * Texts of the OK-to-load / hold reasons page (docs/19 section 11). Each comment names the legacy
 * AppJs/OkToLoadReason.js text it replaces. The OUTCOMES are the legacy ones (docs/18 C.1): a DC must be chosen,
 * an allocated reason cannot be removed, the whole list is saved in its order (blank reasons refused, O2).
 */
export const OK_TO_LOAD_MESSAGES = {
  /** Legacy toast "DC not selected". */
  dcNotSelected: 'Choose the DC first',
  /** Legacy toast "Reasons Data Loaded successfully": now the count next to the list. */
  count: (n: number) => (n === 1 ? '1 reason' : `${n} reasons`),
  /** Legacy toast "Something went wrong.Please contact administrator" (the reasons could not be loaded). */
  loadFailedTitle: 'The reasons could not be loaded',
  dcsFailedTitle: 'The DCs could not be loaded',
  /** Legacy toast "This Reason is already allocated into Contracts. So not allow to Remove" (now prevented). */
  allocated: 'Cannot be removed',
  allocatedChip: 'Used by contracts',
  /** Legacy: removing was immediate and final until reload; now it can be undone until saved. */
  removed: (reason: string) => `Removed “${reason || 'new reason'}”.`,
  /** New (O2): the legacy page saved blank reasons and hid them on the next load. */
  enterReason: 'Enter the reason',
  blankReasons: (n: number) => (n === 1 ? 'One reason has no text' : `${n} reasons have no text`),
  /** Legacy toast "Data Saved Successfully". */
  saved: (dc: string, n: number) => `Saved ${n === 1 ? '1 reason' : `${n} reasons`} for ${dc}.`,
  /** Server 409 REASON_ALLOCATED (the guard behind O1). */
  allocatedRefused:
    'A reason that contracts already use was left out. Nothing was changed. Choose the DC again to see its reasons.',
  emptyTitle: (dc: string) => `No reasons for ${dc} yet`,
  emptyHelp: 'Add the first one with Add reason.',
  noDcTitle: 'Choose a DC',
  noDcHelp: 'Its reasons appear here.',
  readOnlyHelp: 'Stored reasons keep their text; change their details or add new ones.',
  unsaved: (added: number, removed: number, changed: number) =>
    [
      added ? `${added} added` : '',
      removed ? `${removed} removed` : '',
      changed ? `${changed} changed` : '',
    ]
      .filter(Boolean)
      .join(' · '),
} as const;
