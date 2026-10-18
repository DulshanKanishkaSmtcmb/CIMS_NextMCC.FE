import { useRef, useState } from 'react';
import type { ApiQueryError } from '../../services/axiosBaseQuery';

/** The legacy "Option" select of the File/* master pages, in its order. View loads a record and never saves. */
export const ENTRY_OPTIONS = ['New', 'Change', 'View'] as const;
export type EntryOption = (typeof ENTRY_OPTIONS)[number];

/** Legacy texts of AppJs/Country.js, Ports.js and DC.js (toastr / alert), word for word. */
export const COMMON_MESSAGES = {
  saved: 'Data Saved Successfully',
  notSaved: (msg: string) => `Data not Saved [${msg}]`,
  noServer: 'Unable to process Ajax Request',
  /** LoadListDialog: alert when the list has no rows. */
  nothingToList: 'No data found to list out',
  /** GetApiDataFromFindKey: alert when Enter finds no record for the code. */
  invalidCode: 'Invalid Code',
} as const;

/** The messages that differ per page (the "Enter ..." toasts stay in the page, they are only used there). */
export interface EntryMessages {
  /** "Country Code Already Exist" (New and the key exists). */
  alreadyExists: string;
  /** "Country Code not Exist" (Change and the key does not exist). */
  doesNotExist: string;
  /** The alert when the existence check fails. */
  checkFailed: string;
}

/** The text shown for a failed save: the server's message, or the legacy "Unable to process" for no response. */
export function saveFailureText(error: ApiQueryError, messages: EntryMessages): string {
  if (error.status === undefined) return COMMON_MESSAGES.noServer;
  if (error.status === 409) return messages.alreadyExists;
  if (error.status === 404) return messages.doesNotExist;
  return COMMON_MESSAGES.notSaved(error.details?.join(' ') ?? error.message);
}

/**
 * The state the three legacy view models share: the Option select, "AllowChange" (false after a View record is
 * loaded: the fields lock) and "isSaveEnable". `optionRef` always holds the current option for async callbacks.
 */
export function useEntryFlags() {
  const [option, setOptionState] = useState<EntryOption>('New');
  const [allowChange, setAllowChange] = useState(true);
  const [saveEnabled, setSaveEnabled] = useState(true);
  const optionRef = useRef<EntryOption>('New');

  const setOption = (next: EntryOption) => {
    optionRef.current = next;
    setOptionState(next);
  };

  return { option, optionRef, setOption, allowChange, setAllowChange, saveEnabled, setSaveEnabled };
}

/** DataTables "smart" search on one column: every word must occur in the text, case-insensitively. */
export function smartMatches(text: string, search: string): boolean {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = text.toLowerCase();
  return words.every((w) => haystack.includes(w));
}
