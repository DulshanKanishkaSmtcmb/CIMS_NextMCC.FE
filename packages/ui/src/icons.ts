import { createElement, type ReactNode } from 'react';
import DescriptionIcon from '@mui/icons-material/Description';
import FolderIcon from '@mui/icons-material/Folder';
import HomeIcon from '@mui/icons-material/Home';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

const MENU_ICONS = {
  home: HomeIcon,
  folder: FolderIcon,
  inventory: Inventory2Icon,
  reference: MenuBookIcon,
  scan: QrCodeScannerIcon,
  page: DescriptionIcon,
} as const;

export type MenuIconKey = keyof typeof MENU_ICONS;

/** Icon for a navigation entry, by key. Unknown keys fall back to the generic page icon. */
export function getMenuIcon(key?: string): ReactNode {
  const Icon = (
    key && key in MENU_ICONS ? MENU_ICONS[key as MenuIconKey] : DescriptionIcon
  ) as typeof DescriptionIcon;
  return createElement(Icon);
}
