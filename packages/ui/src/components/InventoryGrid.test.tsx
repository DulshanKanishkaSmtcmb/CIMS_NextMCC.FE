import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CimsThemeProvider } from '../CimsThemeProvider';
import { InventoryGrid, type InventoryGridProps } from './InventoryGrid';

interface Row {
  id: number;
  sku: string;
  qty: number;
}

const columns: InventoryGridProps<Row>['columns'] = [
  { field: 'sku', headerName: 'SKU' },
  { field: 'qty', headerName: 'Qty', type: 'number', width: 80 },
];

function renderGrid(props: Partial<InventoryGridProps<Row>> = {}) {
  return render(
    <CimsThemeProvider>
      <InventoryGrid<Row> columns={columns} rows={[]} disableVirtualization {...props} />
    </CimsThemeProvider>,
  );
}

describe('InventoryGrid', () => {
  it('renders headers and rows', () => {
    renderGrid({
      rows: [
        { id: 1, sku: 'AB-100', qty: 4 },
        { id: 2, sku: 'CD-200', qty: 9 },
      ],
    });

    expect(screen.getByText('SKU')).toBeInTheDocument();
    expect(screen.getByText('AB-100')).toBeInTheDocument();
    expect(screen.getByText('CD-200')).toBeInTheDocument();
  });

  it('shows the default empty message', () => {
    renderGrid();
    expect(screen.getByText('No records')).toBeInTheDocument();
  });

  it('shows a custom empty message', () => {
    renderGrid({ emptyMessage: 'Nothing arrived yet' });
    expect(screen.getByText('Nothing arrived yet')).toBeInTheDocument();
  });

  it('shows a progress indicator while loading', () => {
    renderGrid({ loading: true });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('uses compact density', () => {
    const { container } = renderGrid({ rows: [{ id: 1, sku: 'AB-100', qty: 4 }] });
    expect(container.querySelector('.MuiDataGrid-root--densityCompact')).not.toBeNull();
  });
});
