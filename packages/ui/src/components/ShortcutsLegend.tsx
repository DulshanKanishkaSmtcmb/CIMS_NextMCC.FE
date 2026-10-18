import { Fragment, useId } from 'react';
import Box from '@mui/material/Box';
import KeyboardIcon from '@mui/icons-material/KeyboardOutlined';
import { formatShortcut, type KeyboardShortcut } from './useKeyboardShortcuts';

export interface ShortcutsLegendProps {
  shortcuts: readonly Pick<KeyboardShortcut, 'keys' | 'description' | 'enabled'>[];
  /** Accessible name of the list. Default "Keyboard shortcuts". */
  label?: string;
  'data-testid'?: string;
}

/** Always-visible, quiet list of the page's keyboard shortcuts: key caps + what they do. */
export function ShortcutsLegend({
  shortcuts,
  label = 'Keyboard shortcuts',
  'data-testid': testId,
}: ShortcutsLegendProps) {
  const labelId = useId();
  if (shortcuts.length === 0) return null;
  return (
    <Box
      data-testid={testId}
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: 2,
        rowGap: 0.5,
        typography: 'caption',
        color: 'text.secondary',
      }}
    >
      <Box
        component="span"
        id={labelId}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
      >
        <KeyboardIcon fontSize="small" aria-hidden />
        <Box
          component="span"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
          }}
        >
          {label}
        </Box>
      </Box>
      <Box
        component="ul"
        aria-labelledby={labelId}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          columnGap: 2,
          rowGap: 0.5,
          listStyle: 'none',
          m: 0,
          p: 0,
        }}
      >
        {shortcuts.map((s) => (
          <Box
            component="li"
            key={s.keys}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              opacity: s.enabled === false ? 0.55 : 1,
            }}
          >
            <span>
              {formatShortcut(s.keys).map((k, i) => (
                <Fragment key={k + i}>
                  {i > 0 ? '+' : null}
                  <kbd>{k}</kbd>
                </Fragment>
              ))}
            </span>
            <span>{s.description}</span>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
