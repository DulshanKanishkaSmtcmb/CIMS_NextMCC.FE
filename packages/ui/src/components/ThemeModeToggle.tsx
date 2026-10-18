import { useEffect, useId, useState, type ReactElement } from 'react';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import { useColorScheme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import SystemModeIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import type { CimsThemeMode } from '../CimsThemeProvider';

const MODES: readonly { mode: CimsThemeMode; label: string; hint: string; icon: ReactElement }[] = [
  { mode: 'light', label: 'Light', hint: 'Best in bright halls', icon: <LightModeIcon /> },
  { mode: 'dark', label: 'Dark', hint: 'Night shifts, dim rooms', icon: <DarkModeIcon /> },
  { mode: 'system', label: 'System', hint: 'Follow the Windows setting', icon: <SystemModeIcon /> },
];

/** localStorage key of a signed-in user's own choice (shared PCs: each user gets their mode back at sign-in). */
const userKey = (userId: string) => `cims-theme-mode:${userId}`;

function readUserMode(userId: string): CimsThemeMode | null {
  try {
    const value = window.localStorage.getItem(userKey(userId));
    return value === 'light' || value === 'dark' || value === 'system' ? value : null;
  } catch {
    return null;
  }
}

function writeUserMode(userId: string, mode: CimsThemeMode) {
  try {
    window.localStorage.setItem(userKey(userId), mode);
  } catch {
    // Storage blocked (private window, policy): the choice still applies for this visit.
  }
}

export interface ThemeModeToggleProps {
  /**
   * The signed-in user's id. When given, the choice is also kept per user and restored when that user signs in.
   * Without it the choice is kept per browser (CimsThemeProvider's storage).
   */
  userId?: string;
}

/**
 * Light / dark / system switch for the app bar: an icon button showing the current mode, opening a menu of the three
 * modes. "System" (the default) follows the operating system's prefers-color-scheme. Needs CimsThemeProvider (or the
 * Toolpad AppProvider) with cimsTheme above it.
 */
export function ThemeModeToggle({ userId }: ThemeModeToggleProps) {
  const { mode, systemMode, setMode } = useColorScheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const menuId = useId();
  const current: CimsThemeMode = mode ?? 'system';
  const shown = MODES.find((m) => m.mode === current) ?? MODES[2];
  const label =
    current === 'system'
      ? `Theme: System (${systemMode === 'dark' ? 'dark' : 'light'})`
      : `Theme: ${shown.label}`;

  // A signed-in user gets back the mode they chose last time on this browser.
  useEffect(() => {
    if (!userId) return;
    const saved = readUserMode(userId);
    if (saved) setMode(saved);
  }, [userId, setMode]);

  const choose = (next: CimsThemeMode) => {
    setMode(next);
    if (userId) writeUserMode(userId, next);
    setAnchor(null);
  };

  return (
    <>
      <Tooltip title={label}>
        <IconButton
          aria-label={label}
          aria-haspopup="menu"
          aria-controls={anchor ? menuId : undefined}
          aria-expanded={anchor ? 'true' : undefined}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={(theme) => ({
            width: theme.cims.density.touchTarget - 4,
            height: theme.cims.density.touchTarget - 4,
          })}
        >
          {shown.icon}
        </IconButton>
      </Tooltip>
      <Menu
        id={menuId}
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { 'aria-label': 'Theme' } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {MODES.map((m) => (
          <MenuItem
            key={m.mode}
            role="menuitemradio"
            aria-checked={m.mode === current}
            selected={m.mode === current}
            onClick={() => choose(m.mode)}
            sx={{ minHeight: 44 }}
          >
            <ListItemIcon>{m.icon}</ListItemIcon>
            <ListItemText primary={m.label} secondary={m.hint} />
            <ListItemIcon
              sx={{
                justifyContent: 'flex-end',
                visibility: m.mode === current ? 'visible' : 'hidden',
              }}
            >
              <CheckIcon fontSize="small" />
            </ListItemIcon>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
