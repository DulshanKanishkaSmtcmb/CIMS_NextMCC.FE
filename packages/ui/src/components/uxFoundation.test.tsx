import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CimsThemeProvider } from '../CimsThemeProvider';
import { cimsTheme } from '../theme';
import { CheckboxField } from './CheckboxField';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { FieldGrid, FieldGridItem } from './FieldGrid';
import { formatNumber } from './format';
import { FormSection } from './FormSection';
import { InlineHint } from './InlineHint';
import { PropertyList } from './PropertyList';
import { SegmentedControl } from './SegmentedControl';
import { ShortcutsLegend } from './ShortcutsLegend';
import { FormSkeleton, ListSkeleton, TableSkeleton } from './SkeletonPresets';
import { StatGroup } from './StatGroup';
import { StatusChip } from './StatusChip';
import { formatShortcut, matchesShortcut, useKeyboardShortcuts } from './useKeyboardShortcuts';
import { ValidationSummary } from './ValidationSummary';

const wrap = (ui: React.ReactElement) => render(<CimsThemeProvider>{ui}</CimsThemeProvider>);

describe('theme tokens', () => {
  it('exposes status colours, focus ring, layout and density on theme.cims', () => {
    expect(Object.keys(cimsTheme.cims.status)).toEqual([
      'success',
      'warning',
      'error',
      'info',
      'neutral',
    ]);
    expect(cimsTheme.cims.focusRing.width).toBeGreaterThanOrEqual(2);
    expect(cimsTheme.cims.density.touchTarget).toBe(44);
    expect(cimsTheme.typography.button.textTransform).toBe('none');
  });
});

describe('StatusChip', () => {
  it('always shows the status as text with an icon', () => {
    wrap(<StatusChip tone="warning" label="Unsaved changes" data-testid="chip" />);
    const chip = screen.getByTestId('chip');
    expect(chip).toHaveTextContent('Unsaved changes');
    expect(chip).toHaveAttribute('data-tone', 'warning');
    expect(chip.querySelector('svg')).not.toBeNull();
  });
});

describe('EmptyState', () => {
  it('says what is empty and offers the next step', async () => {
    const user = userEvent.setup();
    const onLoad = vi.fn();
    wrap(
      <EmptyState
        title="No contracts loaded"
        description="Choose a shipment and select Load contracts."
        action={<button onClick={onLoad}>Load contracts</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No contracts loaded' })).toBeInTheDocument();
    expect(screen.getByText('Choose a shipment and select Load contracts.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load contracts' }));
    expect(onLoad).toHaveBeenCalled();
  });
});

describe('ErrorState', () => {
  it('is announced, shows the server details and retries', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    wrap(
      <ErrorState
        title="Data not saved"
        message="Nothing was changed."
        details="Contract Data not found.[Empty List]"
        onRetry={onRetry}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Data not saved');
    expect(alert).toHaveTextContent('Contract Data not found.[Empty List]');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('Skeleton presets', () => {
  it('announce loading once and hide the shapes from screen readers', () => {
    wrap(
      <>
        <TableSkeleton label="Loading contracts" />
        <ListSkeleton label="Loading containers" />
        <FormSkeleton label="Loading country" />
      </>,
    );
    for (const name of ['Loading contracts', 'Loading containers', 'Loading country']) {
      const status = screen.getByRole('status', { name });
      expect(status).toHaveAttribute('aria-busy', 'true');
      expect(status.firstElementChild).toHaveAttribute('aria-hidden');
    }
  });
});

describe('InlineHint', () => {
  it('announces errors but not static guidance', () => {
    wrap(
      <>
        <InlineHint tone="error">Enter the arrival date and time</InlineHint>
        <InlineHint>Only the first ticked container is updated</InlineHint>
        <InlineHint tone="success" live>
          Saved
        </InlineHint>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the arrival date and time');
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByText('Only the first ticked container is updated').closest('[role]')).toBe(
      null,
    );
  });
});

describe('ValidationSummary', () => {
  it('takes focus when it appears and jumps to a field', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    function Harness() {
      const [shown, setShown] = useState(false);
      return (
        <>
          <button onClick={() => setShown(true)}>Save</button>
          <ValidationSummary
            issues={shown ? [{ field: 'name', message: 'Enter the country name', onSelect }] : []}
          />
        </>
      );
    }
    wrap(<Harness />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Enter the country name' }));
    expect(onSelect).toHaveBeenCalled();
  });
});

describe('FormSection and FieldGrid', () => {
  it('renders a labelled section with a step number and fields in DOM order', () => {
    wrap(
      <FormSection step={1} title="Find pending contracts" description="Choose filters">
        <FieldGrid columns={{ xs: 1, md: 3 }}>
          <input aria-label="First" />
          <FieldGridItem span="full">
            <input aria-label="Second" />
          </FieldGridItem>
        </FieldGrid>
      </FormSection>,
    );
    const section = screen.getByRole('region', { name: /^Step 1:\s*Find pending contracts$/ });
    expect(within(section).getByText('Choose filters')).toBeInTheDocument();
    const [first, second] = within(section).getAllByRole('textbox');
    expect(first).toHaveAccessibleName('First');
    expect(second).toHaveAccessibleName('Second');
  });
});

describe('SegmentedControl', () => {
  it('shows every choice, marks the selected one and never clears it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    wrap(
      <SegmentedControl
        label="Shipment"
        value="Local"
        options={['Local', 'Import']}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('group', { name: 'Shipment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Local', pressed: true })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Local' }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Import' }));
    expect(onChange).toHaveBeenCalledWith('Import');
  });
});

describe('CheckboxField', () => {
  it('toggles from its label and is described by its helper text', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <CimsThemeProvider>
          <CheckboxField
            label="Divertable"
            helperText="Cargo for this port may be diverted."
            checked={checked}
            onChange={setChecked}
          />
        </CimsThemeProvider>
      );
    }
    render(<Harness />);
    const box = screen.getByRole('checkbox', { name: 'Divertable' });
    expect(box).toHaveAccessibleDescription('Cargo for this port may be diverted.');
    await user.click(screen.getByText('Divertable'));
    expect(box).toBeChecked();
  });
});

describe('PropertyList', () => {
  it('pairs each label with its value as a named description list', () => {
    render(
      <CimsThemeProvider>
        <PropertyList
          label="Settings"
          items={[
            { label: 'Loading order', value: '10' },
            { label: 'Stock update', value: 'Yes' },
          ]}
        />
      </CimsThemeProvider>,
    );
    const list = screen.getByLabelText('Settings');
    expect(
      within(list)
        .getAllByRole('term')
        .map((t) => t.textContent),
    ).toEqual(['Loading order', 'Stock update']);
    expect(
      within(list)
        .getAllByRole('definition')
        .map((d) => d.textContent),
    ).toEqual(['10', 'Yes']);
  });
});

describe('StatGroup and formatNumber', () => {
  it('reads as "label: value" pairs', () => {
    wrap(
      <StatGroup
        label="Totals"
        data-testid="totals"
        items={[
          { label: 'Contracts', value: 2 },
          { label: 'CBM', value: formatNumber(18.936, 3) },
        ]}
      />,
    );
    expect(screen.getByTestId('totals')).toHaveTextContent('Contracts: 2');
    expect(screen.getByTestId('totals')).toHaveTextContent('CBM: 18.936');
  });

  it('formats with separators, at most the given decimals and no trailing zeros', () => {
    expect(formatNumber(2980, 2)).toBe('2,980');
    expect(formatNumber(10.26, 2)).toBe('10.26');
    expect(formatNumber(0.5, 3, { fixed: true })).toBe('0.500');
    expect(formatNumber(Number.NaN)).toBe('');
    expect(formatNumber(null)).toBe('');
  });
});

describe('useKeyboardShortcuts', () => {
  const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

  it('matches combinations by key or physical code', () => {
    expect(matchesShortcut(key({ key: 's', ctrlKey: true }), 'ctrl+s')).toBe(true);
    expect(matchesShortcut(key({ key: 's' }), 'ctrl+s')).toBe(false);
    expect(matchesShortcut(key({ key: '¬', code: 'KeyL', altKey: true }), 'alt+l')).toBe(true);
    expect(matchesShortcut(key({ key: 'Enter', ctrlKey: true }), 'mod+enter')).toBe(true);
    expect(matchesShortcut(key({ key: '?', shiftKey: true }), '?')).toBe(true);
    expect(matchesShortcut(key({ key: 'Escape' }), 'esc')).toBe(true);
  });

  it('formats keys for the legend', () => {
    expect(formatShortcut('ctrl+enter')).toEqual(['Ctrl', 'Enter']);
    expect(formatShortcut('alt+l')).toEqual(['Alt', 'L']);
    expect(formatShortcut('escape')).toEqual(['Esc']);
  });

  it('never hijacks typing and skips disabled shortcuts', async () => {
    const user = userEvent.setup();
    const slash = vi.fn();
    const save = vi.fn();
    const off = vi.fn();
    function Harness() {
      const shortcuts = [
        { keys: '/', description: 'Find', handler: slash },
        { keys: 'ctrl+s', description: 'Save', handler: save },
        { keys: 'alt+x', description: 'Off', handler: off, enabled: false },
      ];
      useKeyboardShortcuts(shortcuts);
      return (
        <>
          <input aria-label="Name" />
          <ShortcutsLegend shortcuts={shortcuts} />
        </>
      );
    }
    wrap(<Harness />);

    await user.click(screen.getByRole('textbox', { name: 'Name' }));
    await user.keyboard('/');
    expect(slash).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('/');
    await user.keyboard('{Control>}s{/Control}');
    expect(save).toHaveBeenCalledTimes(1);
    await user.keyboard('{Alt>}x{/Alt}');
    expect(off).not.toHaveBeenCalled();

    const legend = screen.getByRole('list', { name: 'Keyboard shortcuts' });
    expect(within(legend).getAllByRole('listitem')).toHaveLength(3);
    expect(within(legend).getByText('Save').parentElement).toHaveTextContent('Ctrl+SSave');
  });
});
