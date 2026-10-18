/**
 * Texts of the Confirm Arrivals page. Plain, task-oriented wording (docs/19 section 11); each comment names the legacy
 * AppJs/ConfirmArrival.js text it replaces. The validation OUTCOMES are the legacy ones (date first, then selection,
 * nothing sent); only the words and where they appear changed. The legacy "Data not Saved [<msg>]" keeps its content:
 * the server's message is shown verbatim under the "Data not saved" heading.
 */
export const MESSAGES = {
  /** Legacy toast "Contracts Loaded successfully". */
  loaded: (contracts: number, suppliers: number, containers: number) =>
    `Loaded ${contracts} ${plural(contracts, 'contract')} · ${suppliers} ${plural(suppliers, 'supplier')} · ${containers} ${plural(containers, 'container line')}`,
  /** Legacy toast "Something went wrong.Please contact administrator". */
  loadFailedTitle: 'Contracts could not be loaded',
  loadFailed:
    'Check the network connection and try again. If it keeps failing, contact your administrator.',
  /** Legacy toast "Enter Confirm Arrival Date". */
  noArrivalDate: 'Enter the arrival date and time',
  /** Legacy toast "Any Contracts not Selected to Save.". */
  noneSelected: 'Add at least one contract to the selection before confirming',
  /** Legacy toast "Data Saved Successfully". */
  saved: (contracts: number, when: string) =>
    `Arrival confirmed for ${contracts} ${plural(contracts, 'contract')} (${when}).`,
  savedNext: 'They stay listed below. Load contracts again to see what is still pending.',
  /** Legacy toast "Data not Saved [<msg>]": same content, the server message is shown as details. */
  notSavedTitle: 'Data not saved',
  notSaved: 'Nothing was changed. Correct the problem below and confirm again.',
  /** Legacy toast "Unable to process Ajax Request". */
  noServer:
    'The server could not be reached. Nothing was changed. Check the connection and try again.',
  /** New (quick pick scan field). */
  pickNothingLoaded: 'Load contracts first, then scan a container or supplier.',
  pickNotFound: (text: string) =>
    `No pending container or supplier matches “${text}”. Check the number, or load contracts for the right shipment.`,
  pickedContainer: (name: string, count: number) =>
    `Picked container ${name}: ${count} ${plural(count, 'contract')} listed under Pending.`,
  pickedSupplier: (name: string, count: number) =>
    `Picked supplier ${name}: ${count} ${plural(count, 'contract')} listed under Pending.`,
  pickedAlready: (name: string) => `${name} is already picked.`,
} as const;

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}
