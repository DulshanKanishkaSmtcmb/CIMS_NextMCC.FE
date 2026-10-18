/** Legacy texts of AppJs/ConfirmArrival.js, kept word for word (including the missing spaces). */
export const MESSAGES = {
  loaded: 'Contracts Loaded successfully',
  loadFailed: 'Something went wrong.Please contact administrator',
  noArrivalDate: 'Enter Confirm Arrival Date',
  noneSelected: 'Any Contracts not Selected to Save.',
  saved: 'Data Saved Successfully',
  notSaved: (msg: string) => `Data not Saved [${msg}]`,
  noServer: 'Unable to process Ajax Request',
} as const;
