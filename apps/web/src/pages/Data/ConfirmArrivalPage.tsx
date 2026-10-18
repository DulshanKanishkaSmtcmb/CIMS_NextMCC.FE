import { useMemo, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  BlockingOverlay,
  Box,
  Button,
  Checkbox,
  DmyDatePicker,
  formatDmy,
  InventoryGrid,
  PageHeader,
  Paper,
  SelectField,
  Stack,
  TextInput,
  Typography,
  useScanFeedback,
  type InventoryGridColumn,
} from '@cims/ui';
import {
  useConfirmArrivalsMutation,
  useGetConfirmArrivalCountriesQuery,
  useGetConfirmArrivalDcsQuery,
  useLazyGetPendingArrivalsQuery,
} from '../../services/arrivalsApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import {
  addRow,
  buildConfirmRequest,
  editContainerNo,
  emptyLists,
  listsFromLoad,
  removeRow,
  roundTo,
  selectAll,
  toggleContainer,
  toggleSupplier,
  totals,
  type ContainerLine,
  type ListRow,
  type ListsState,
  type SupplierLine,
  type Totals,
} from './confirmArrivalLists';
import { MESSAGES } from './confirmArrivalMessages';

const SHIPMENTS = ['Local', 'Import'] as const;
const ALL = 'All';

interface FilterForm {
  cargoFrom: string;
  dc: string;
  country: string;
  /** Local yyyy-MM-ddTHH:mm:ss or null. */
  arrivalDate: string | null;
}

const num = (precision: number) => (value: number) => String(roundTo(value, precision));

function poColumns(action: (row: ListRow) => ReactNode): InventoryGridColumn<ListRow>[] {
  return [
    {
      field: 'action',
      headerName: '',
      width: 90,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => action(row),
    },
    { field: 'rcvNo', headerName: 'Rcv No', width: 120 },
    {
      field: 'arrivalDate',
      headerName: 'Arrival Time',
      width: 150,
      valueFormatter: (v: string | null) => formatDmy(v, true),
    },
    { field: 'contractNo', headerName: 'Contract No', width: 150 },
    { field: 'itemNo', headerName: 'Item No', width: 120 },
    { field: 'shipperCode', headerName: 'Supplier Code', width: 110 },
    { field: 'shipperName', headerName: 'Supplier Name', width: 200 },
    { field: 'cargoType', headerName: 'Cargo Type', width: 100 },
    { field: 'warehouse', headerName: 'DC', width: 180 },
    { field: 'ctns', headerName: 'Ctns', type: 'number', width: 90, valueFormatter: num(0) },
    { field: 'pcs', headerName: 'PCS', type: 'number', width: 100, valueFormatter: num(0) },
    {
      field: 'grossWgt',
      headerName: 'Gross Weight',
      type: 'number',
      width: 120,
      valueFormatter: num(2),
    },
    { field: 'cbm', headerName: 'CBM', type: 'number', width: 100, valueFormatter: num(3) },
    { field: 'country', headerName: 'Country', width: 90 },
  ];
}

function TotalsLine({ value, testId }: { value: Totals; testId: string }) {
  return (
    <Stack direction="row" spacing={3} sx={{ px: 1, py: 0.5 }} data-testid={testId}>
      <Typography variant="body2">{value.contracts} Contracts</Typography>
      <Typography variant="body2">Ctns {value.ctns}</Typography>
      <Typography variant="body2">PCS {value.pcs}</Typography>
      <Typography variant="body2">Gross Weight {roundTo(value.grossWgt, 2)}</Typography>
      <Typography variant="body2">CBM {roundTo(value.cbm, 3)}</Typography>
    </Stack>
  );
}

function saveErrorText(error: ApiQueryError): string {
  if (error.status === undefined) return MESSAGES.noServer;
  return MESSAGES.notSaved(error.details?.join(' ') ?? error.message);
}

/**
 * Contract - Confirm Arrivals (legacy /Data/ConfirmArrival, CloudMenu 200.05.04). Same field order, labels, defaults,
 * messages and list behaviour as Views/Data/ConfirmArrival.cshtml + AppJs/ConfirmArrival.js; write-up in the legacy
 * repo docs/13-pilot-confirm-arrivals.md. The legacy page has no scan field, no caps-lock field and no sounds.
 */
export function ConfirmArrivalPage() {
  const navigate = useNavigate();
  const feedback = useScanFeedback();
  const { control, getValues, setValue } = useForm<FilterForm>({
    defaultValues: { cargoFrom: 'Local', dc: ALL, country: ALL, arrivalDate: null },
  });

  const dcs = useGetConfirmArrivalDcsQuery();
  const countries = useGetConfirmArrivalCountriesQuery();
  const [loadPending, pendingState] = useLazyGetPendingArrivalsQuery();
  const [confirmArrivals, confirmState] = useConfirmArrivalsMutation();

  const [lists, setLists] = useState<ListsState>(emptyLists);

  const dcOptions = useMemo(() => [ALL, ...(dcs.data ?? []).map((d) => d.whDes)], [dcs.data]);
  const countryOptions = useMemo(
    () => [ALL, ...(countries.data ?? []).map((c) => c.countryCode)],
    [countries.data],
  );
  const selectedCountry = useWatch({ control, name: 'country' });
  const countryName =
    selectedCountry === ALL
      ? ''
      : (countries.data?.find((c) => c.countryCode === selectedCountry)?.countryName ?? '');

  const loadContracts = async () => {
    setLists(emptyLists);
    const { cargoFrom, dc, country } = getValues();
    const result = await loadPending({ cargoFrom, dc, country });
    if (result.data) {
      setLists(listsFromLoad(result.data));
      feedback.notifySuccess(MESSAGES.loaded);
    } else {
      feedback.notifyError(MESSAGES.loadFailed);
    }
  };

  const save = async () => {
    const arrivalDate = getValues('arrivalDate');
    if (!arrivalDate) {
      feedback.notifyError(MESSAGES.noArrivalDate);
      return;
    }
    const request = buildConfirmRequest(lists, arrivalDate);
    if (request.rcvNos.length === 0) {
      feedback.notifyError(MESSAGES.noneSelected);
      return;
    }
    const result = await confirmArrivals(request);
    if ('data' in result && result.data) {
      // Like the legacy page, the lists stay as they are after a save.
      feedback.notifySuccess(MESSAGES.saved);
    } else if ('error' in result) {
      feedback.notifyError(saveErrorText(result.error as ApiQueryError));
    }
  };

  const startNew = () => {
    setValue('arrivalDate', null);
    setLists(emptyLists);
  };

  const supplierColumns: InventoryGridColumn<SupplierLine>[] = [
    {
      field: 'checked',
      headerName: '',
      width: 60,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Checkbox
          checked={row.checked}
          onChange={(_, checked) => setLists((s) => toggleSupplier(s, row.id, checked))}
          slotProps={{ input: { 'aria-label': `Supplier ${row.shipperCode || '(blank)'}` } }}
        />
      ),
    },
    { field: 'shipperCode', headerName: 'Supplier Code', width: 130 },
    { field: 'shipperName', headerName: 'Supplier Name', width: 300 },
  ];

  const containerColumns: InventoryGridColumn<ContainerLine>[] = [
    {
      field: 'checked',
      headerName: '',
      width: 60,
      sortable: false,
      filterable: false,
      renderCell: ({ row }) => (
        <Checkbox
          checked={row.checked}
          onChange={(_, checked) => setLists((s) => toggleContainer(s, row.id, checked))}
          slotProps={{
            input: {
              'aria-label': `Container ${row.containerNo || row.loadReference || row.id + 1}`,
            },
          }}
        />
      ),
    },
    { field: 'vesselName', headerName: 'Vessel Name', width: 200 },
    { field: 'loadReference', headerName: 'Load Reference', width: 200 },
    { field: 'containerNo', headerName: 'Container No', width: 200, editable: true },
    { field: 'containerType', headerName: 'Container Type', width: 200 },
  ];

  const pendingColumns = poColumns((row) => (
    <Button
      size="small"
      color="success"
      variant="contained"
      onClick={() => setLists((s) => addRow(s, row.uid))}
    >
      Add
    </Button>
  ));
  const selectedColumns = poColumns((row) => (
    <Button
      size="small"
      color="error"
      variant="contained"
      onClick={() => setLists((s) => removeRow(s, row.uid))}
    >
      Remove
    </Button>
  ));

  const busy = pendingState.isFetching || confirmState.isLoading;

  return (
    <Box sx={{ position: 'relative' }}>
      <PageHeader title="Contract - Confirm Arrivals" />
      <BlockingOverlay
        open={busy}
        contained
        message={confirmState.isLoading ? 'Saving...' : 'Loading...'}
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2} sx={{ maxWidth: 480 }}>
          <Controller
            control={control}
            name="cargoFrom"
            render={({ field }) => (
              <SelectField
                label="Shipment"
                value={field.value}
                options={SHIPMENTS}
                onChange={field.onChange}
              />
            )}
          />
          <Box>
            <Button
              id="btnLoadPOs"
              variant="contained"
              color="info"
              onClick={() => void loadContracts()}
            >
              Load Contracts
            </Button>
          </Box>
          <Controller
            control={control}
            name="dc"
            render={({ field }) => (
              <SelectField
                label="DC"
                value={field.value}
                options={dcOptions}
                onChange={field.onChange}
              />
            )}
          />
          <Stack spacing={1}>
            <Controller
              control={control}
              name="country"
              render={({ field }) => (
                <SelectField
                  label="Country"
                  value={field.value}
                  options={countryOptions}
                  onChange={field.onChange}
                />
              )}
            />
            <TextInput ariaLabel="Country name" value={countryName} />
          </Stack>
        </Stack>
      </Paper>

      {lists.suppliers.length > 0 ? (
        <Paper sx={{ p: 2, mb: 2 }} id="SupList">
          <Typography variant="subtitle1" component="h2" gutterBottom>
            Supplier List - Pending Arrival Confirmation
          </Typography>
          <InventoryGrid<SupplierLine>
            columns={supplierColumns}
            rows={lists.suppliers}
            hideFooter={lists.suppliers.length <= 100}
            initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
            disableVirtualization
          />
        </Paper>
      ) : null}

      {lists.containers.length > 0 ? (
        <Paper sx={{ p: 2, mb: 2 }} id="tblContainers">
          <Typography variant="subtitle1" component="h2" gutterBottom>
            Containers List - Pending Arrival Confirmation
          </Typography>
          <InventoryGrid<ContainerLine>
            columns={containerColumns}
            rows={lists.containers}
            hideFooter={lists.containers.length <= 100}
            initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
            processRowUpdate={(updated) => {
              setLists((s) => editContainerNo(s, updated.id, updated.containerNo));
              return updated;
            }}
            disableVirtualization
          />
        </Paper>
      ) : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ maxWidth: 320 }}>
          <Controller
            control={control}
            name="arrivalDate"
            render={({ field }) => (
              <DmyDatePicker
                withTime
                label="Arrival Date [dd/mm/yyyy hh:mm]"
                value={field.value}
                onChange={field.onChange}
                fullWidth
              />
            )}
          />
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }} id="tblPending">
        <Typography variant="subtitle1" component="h2" gutterBottom>
          PO Listing - Pending Load Plan
        </Typography>
        <Box sx={{ mb: 1 }}>
          <Button
            size="small"
            color="success"
            variant="contained"
            onClick={() => setLists(selectAll)}
          >
            Select All
          </Button>
        </Box>
        <InventoryGrid<ListRow>
          columns={pendingColumns}
          rows={lists.pending}
          getRowId={(r) => r.uid}
          emptyMessage="No contracts"
          hideFooter={lists.pending.length <= 100}
          initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
          disableVirtualization
        />
        <TotalsLine value={totals(lists.pending)} testId="pendingTotals" />
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }} id="tblSelected">
        <Typography variant="subtitle1" component="h2" gutterBottom>
          PO Listing - Selected
        </Typography>
        <InventoryGrid<ListRow>
          columns={selectedColumns}
          rows={lists.selected}
          getRowId={(r) => r.uid}
          emptyMessage="No contracts"
          hideFooter={lists.selected.length <= 100}
          initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
          disableVirtualization
        />
        <TotalsLine value={totals(lists.selected)} testId="selectedTotals" />
      </Paper>

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          color="info"
          onClick={() => void save()}
          disabled={confirmState.isLoading}
        >
          Save
        </Button>
        <Button variant="contained" color="info" onClick={startNew}>
          New
        </Button>
        <Button variant="contained" color="info" onClick={() => void navigate(PATHS.home)}>
          Close
        </Button>
      </Stack>
    </Box>
  );
}
