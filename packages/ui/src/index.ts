export {
  CimsThemeProvider,
  type CimsThemeProviderProps,
  type CimsThemeMode,
} from './CimsThemeProvider';
export {
  cimsTheme,
  cimsTokens,
  CIMS_MODE_STORAGE_KEY,
  CIMS_COLOR_SCHEME_STORAGE_KEY,
  type CimsThemeTokens,
} from './theme';

export { ScanInput, type ScanInputProps } from './components/ScanInput';
export { useFocusChain, type FocusChain, type FocusChainOptions } from './components/useFocusChain';
export { ScanFeedbackProvider } from './components/scanFeedback/ScanFeedbackProvider';
export type { ScanFeedbackProviderProps } from './components/scanFeedback/ScanFeedbackProvider';
export type { ScanFeedbackConfig } from './components/scanFeedback/ScanFeedbackContext';
export { useScanFeedback, type ScanFeedback } from './components/scanFeedback/useScanFeedback';
export { playSound, DEFAULT_SOUND_URLS, type ScanSoundUrls } from './components/scanFeedback/sound';
export { InventoryGrid, type InventoryGridProps } from './components/InventoryGrid';
export type { GridColDef as InventoryGridColumn } from '@mui/x-data-grid';
export { DmyDatePicker, type DmyDatePickerProps } from './components/DmyDatePicker';
export {
  DMY_DISPLAY_FORMAT,
  DMY_TIME_DISPLAY_FORMAT,
  ISO_DATE_FORMAT,
  ISO_DATE_TIME_FORMAT,
  parseIsoDate,
  formatIsoDate,
  parseIsoDateTime,
  formatIsoDateTime,
  formatDmy,
} from './components/dates';
export { SelectField, type SelectFieldProps, type SelectOption } from './components/SelectField';
export { TextInput, type TextInputProps } from './components/TextInput';
export { BlockingOverlay, type BlockingOverlayProps } from './components/BlockingOverlay';
export { ConfirmDialog, type ConfirmDialogProps } from './components/ConfirmDialog';
export { LookupField, type LookupFieldProps } from './components/LookupField';
export { LookupDialog, type LookupColumn, type LookupDialogProps } from './components/LookupDialog';
export { lookupCellText, type LookupColumnKind } from './components/lookupText';
export { PageHeader, type PageHeaderProps } from './components/PageHeader';
export { PageLoading, type PageLoadingProps } from './components/PageLoading';
export { TenantSwitcher, type Tenant, type TenantSwitcherProps } from './components/TenantSwitcher';

export { getMenuIcon, type MenuIconKey } from './icons';
export * from './primitives';

// UX foundation (docs/19-ux-design-principles.md): page templates, states, form layout, shortcuts.
export type { CimsStatusTone, CimsStatusColour } from './theme';
export { PageShell, type PageShellProps } from './templates/PageShell';
export { ActionBar, type ActionBarProps } from './templates/ActionBar';
export { OperationalPage, type OperationalPageProps } from './templates/OperationalPage';
export {
  MasterDataPage,
  type MasterDataPageProps,
  type MasterDataMode,
  type MasterDataListItem,
} from './templates/MasterDataPage';
export { FormSection, type FormSectionProps } from './components/FormSection';
export {
  FieldGrid,
  FieldGridItem,
  type FieldGridProps,
  type FieldGridItemProps,
  type FieldGridColumns,
} from './components/FieldGrid';
export { StatusChip, type StatusChipProps, type StatusTone } from './components/StatusChip';
export { EmptyState, type EmptyStateProps } from './components/EmptyState';
export { ErrorState, type ErrorStateProps } from './components/ErrorState';
export {
  TableSkeleton,
  ListSkeleton,
  FormSkeleton,
  type TableSkeletonProps,
  type ListSkeletonProps,
  type FormSkeletonProps,
} from './components/SkeletonPresets';
export { InlineHint, type InlineHintProps, type InlineHintTone } from './components/InlineHint';
export {
  ValidationSummary,
  type ValidationSummaryProps,
  type ValidationIssue,
} from './components/ValidationSummary';
export { SegmentedControl, type SegmentedControlProps } from './components/SegmentedControl';
export { CheckboxField, type CheckboxFieldProps } from './components/CheckboxField';
export { StatGroup, type StatGroupProps, type StatItem } from './components/StatGroup';
export { PropertyList, type PropertyListProps, type PropertyItem } from './components/PropertyList';
export { formatNumber, NUMBER_LOCALE } from './components/format';
export {
  useKeyboardShortcuts,
  matchesShortcut,
  formatShortcut,
  type KeyboardShortcut,
} from './components/useKeyboardShortcuts';
export { ShortcutsLegend, type ShortcutsLegendProps } from './components/ShortcutsLegend';
export { ThemeModeToggle, type ThemeModeToggleProps } from './components/ThemeModeToggle';
