import { Alert, Button, InventoryGrid, PageHeader, type InventoryGridColumn } from '@cims/ui';
import { FIELD_CAPTIONS_URL, useGetFieldCaptionsQuery } from '../../services/referenceApi';

interface CaptionRow {
  id: string;
  caption: string;
}

const COLUMNS: InventoryGridColumn<CaptionRow>[] = [
  { field: 'id', headerName: 'Field', flex: 1 },
  { field: 'caption', headerName: 'Caption', flex: 2 },
];

/** Sample read-only page: renders the five captions returned by the API. */
export function FieldCaptionsPage() {
  const { data, error, isLoading, isFetching, refetch } = useGetFieldCaptionsQuery();

  const rows: CaptionRow[] = data
    ? Object.entries(data).map(([field, caption]) => ({ id: field, caption: String(caption) }))
    : [];

  return (
    <>
      <PageHeader
        title="Field captions"
        subtitle={`GET ${FIELD_CAPTIONS_URL}`}
        actions={
          <Button variant="outlined" onClick={() => void refetch()} disabled={isFetching}>
            Reload
          </Button>
        }
      />
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {'message' in error && error.message
            ? error.message
            : 'Could not load the field captions'}
        </Alert>
      ) : null}
      <InventoryGrid<CaptionRow>
        columns={COLUMNS}
        rows={rows}
        loading={isLoading || isFetching}
        emptyMessage="No captions"
        hideFooter
        disableVirtualization
      />
    </>
  );
}
