import type { ReactNode } from 'react';
import { BlockingOverlay, Box, Button, PageHeader, Paper, SelectField, Stack } from '@cims/ui';
import { ENTRY_OPTIONS, type EntryOption } from './masterEntry';

export interface MasterEntryShellProps {
  /** Page and box title, e.g. "Country Master Details". */
  title: string;
  option: EntryOption;
  onOptionChange: (option: EntryOption) => void;
  saveEnabled: boolean;
  onSave: () => void;
  onNew: () => void;
  onClose: () => void;
  /** The Option choices, in order. Default: New, Change, View (PM Master offers only New and Change). */
  options?: readonly EntryOption[];
  /** Show the New button. Default true (the PM Master page has no New button: the legacy one is commented out). */
  showNew?: boolean;
  /** A request is running: the page is blocked and a message shows. */
  busy?: boolean;
  busyMessage?: string;
  children: ReactNode;
}

/**
 * Frame shared by the File/* master pages (Country, Ports, DC): title, the Option select, the form body, and the
 * Save / New / Close footer, in the legacy order.
 */
export function MasterEntryShell({
  title,
  option,
  onOptionChange,
  saveEnabled,
  onSave,
  onNew,
  onClose,
  options = ENTRY_OPTIONS,
  showNew = true,
  busy = false,
  busyMessage = 'Loading...',
  children,
}: MasterEntryShellProps) {
  return (
    <Box sx={{ position: 'relative' }}>
      <PageHeader title={title} />
      <BlockingOverlay open={busy} contained message={busyMessage} />
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Box sx={{ maxWidth: 240 }}>
            <SelectField
              label="Option"
              value={option}
              options={options}
              onChange={(next) => onOptionChange(next as EntryOption)}
            />
          </Box>
          {children}
        </Stack>
      </Paper>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" color="info" onClick={onSave} disabled={!saveEnabled}>
          Save
        </Button>
        {showNew ? (
          <Button variant="contained" color="info" onClick={onNew}>
            New
          </Button>
        ) : null}
        <Button variant="contained" color="info" onClick={onClose}>
          Close
        </Button>
      </Stack>
    </Box>
  );
}
