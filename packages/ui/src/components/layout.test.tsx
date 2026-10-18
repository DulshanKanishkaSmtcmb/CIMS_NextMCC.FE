import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CimsThemeProvider } from '../CimsThemeProvider';
import { cimsTheme, cimsTokens } from '../theme';
import { PageHeader } from './PageHeader';
import { TenantSwitcher } from './TenantSwitcher';

const tenants = [
  { id: 'MCC', name: 'Next MCC' },
  { id: 'CFS', name: 'Next CFS' },
];

describe('PageHeader', () => {
  it('renders the title as a level 1 heading with subtitle and actions', () => {
    render(
      <CimsThemeProvider>
        <PageHeader
          title="Confirm arrival"
          subtitle="Scan each item"
          actions={<button>Help</button>}
        />
      </CimsThemeProvider>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Confirm arrival' })).toBeInTheDocument();
    expect(screen.getByText('Scan each item')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
  });

  it('omits subtitle and actions when not given', () => {
    render(
      <CimsThemeProvider>
        <PageHeader title="Home" />
      </CimsThemeProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('TenantSwitcher', () => {
  it('shows the selected tenant and reports a different choice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CimsThemeProvider>
        <TenantSwitcher tenants={tenants} value="MCC" onChange={onChange} />
      </CimsThemeProvider>,
    );

    const select = screen.getByRole('combobox', { name: 'Tenant' });
    expect(select).toHaveTextContent('Next MCC');

    await user.click(select);
    await user.click(within(screen.getByRole('listbox')).getByText('Next CFS'));

    expect(onChange).toHaveBeenCalledWith('CFS');
  });

  it('is disabled when there is nothing to choose between', () => {
    render(
      <CimsThemeProvider>
        <TenantSwitcher tenants={[tenants[0]!]} value="MCC" onChange={() => undefined} />
      </CimsThemeProvider>,
    );

    expect(screen.getByRole('combobox', { name: 'Tenant' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('cimsTheme', () => {
  it('is a light theme built from the tokens', () => {
    expect(cimsTheme.palette.mode).toBe('light');
    expect(cimsTheme.palette.primary.main).toBe(cimsTokens.palette.primary);
    expect(cimsTheme.cims.scanner.inputFontSize).toBe(cimsTokens.scanner.inputFontSize);
  });

  it('defaults inputs and grids to dense', () => {
    expect(cimsTheme.components?.MuiTextField?.defaultProps?.size).toBe('small');
    expect(cimsTheme.components?.MuiDataGrid?.defaultProps?.density).toBe('compact');
  });
});
