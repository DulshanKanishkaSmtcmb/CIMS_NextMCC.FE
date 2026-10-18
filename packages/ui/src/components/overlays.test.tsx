import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CimsThemeProvider } from '../CimsThemeProvider';
import { BlockingOverlay } from './BlockingOverlay';
import { ConfirmDialog } from './ConfirmDialog';
import { PageLoading } from './PageLoading';

describe('PageLoading', () => {
  it('is an accessible status with a progress indicator', () => {
    render(
      <CimsThemeProvider>
        <PageLoading />
      </CimsThemeProvider>,
    );

    expect(screen.getByRole('status', { name: 'Loading page' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});

describe('BlockingOverlay', () => {
  it('shows the default message while open', () => {
    render(
      <CimsThemeProvider>
        <BlockingOverlay open />
      </CimsThemeProvider>,
    );

    expect(screen.getByText('Processing request...')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows a custom message', () => {
    render(
      <CimsThemeProvider>
        <BlockingOverlay open message="Saving arrival" />
      </CimsThemeProvider>,
    );

    expect(screen.getByText('Saving arrival')).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <CimsThemeProvider>
        <BlockingOverlay open={false} />
      </CimsThemeProvider>,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('covers only its parent when contained', () => {
    render(
      <CimsThemeProvider>
        <BlockingOverlay open contained />
      </CimsThemeProvider>,
    );

    expect(screen.getByRole('alert')).toHaveStyle({ position: 'absolute' });
  });
});

describe('ConfirmDialog', () => {
  function setup(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <CimsThemeProvider>
        <ConfirmDialog
          open
          title="Delete arrival?"
          message="This cannot be undone."
          onConfirm={onConfirm}
          onCancel={onCancel}
          {...props}
        />
      </CimsThemeProvider>,
    );
    return { onConfirm, onCancel, user: userEvent.setup() };
  }

  it('shows title and message in an accessible dialog', () => {
    setup();

    const dialog = screen.getByRole('dialog', { name: 'Delete arrival?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
  });

  it('calls onConfirm and onCancel from the buttons', async () => {
    const { onConfirm, onCancel, user } = setup({ confirmLabel: 'Delete', cancelLabel: 'Keep' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Keep' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('cancels on Escape', async () => {
    const { onCancel, user } = setup();

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('focuses Cancel first when destructive, Confirm otherwise', () => {
    setup({ destructive: true });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('focuses Confirm first when not destructive', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
  });

  it('disables both buttons and ignores Escape while loading', async () => {
    const { onCancel, user } = setup({ loading: true });

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });
});
