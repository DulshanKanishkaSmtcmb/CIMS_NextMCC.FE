import { useRef, useState } from 'react';
import {
  Button,
  ConfirmDialog,
  InventoryGrid,
  PageHeader,
  Paper,
  ScanInput,
  Stack,
  useFocusChain,
  useScanFeedback,
  type InventoryGridColumn,
} from '@cims/ui';
import { useGetFieldCaptionsQuery } from '../../services/referenceApi';

interface ScanRow {
  id: number;
  contractNo: string;
  itemNo: string;
}

const FOCUS_ORDER = ['contractNo', 'itemNo'] as const;

/**
 * PLACEHOLDER for the legacy Data/ConfirmArrival page. It only demonstrates ScanInput, useFocusChain
 * and ScanFeedback with two fields. It has no business rules and sends nothing to the server.
 */
export function ConfirmArrivalPage() {
  const { data: captions } = useGetFieldCaptionsQuery();
  const feedback = useScanFeedback();
  const chain = useFocusChain<(typeof FOCUS_ORDER)[number]>(FOCUS_ORDER);

  const [contractNo, setContractNo] = useState('');
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const nextId = useRef(1);

  const contractLabel = captions?.contractNoCaption ?? 'Contract No';
  const itemLabel = captions?.itemNoCaption ?? 'Item No';

  const columns: InventoryGridColumn<ScanRow>[] = [
    { field: 'contractNo', headerName: contractLabel },
    { field: 'itemNo', headerName: itemLabel },
  ];

  const onContractScan = () => {
    feedback.success();
    chain.advance('contractNo');
  };

  const onItemScan = (itemNo: string) => {
    if (!contractNo.trim()) {
      feedback.error(`Scan ${contractLabel} first`);
      chain.focus('contractNo');
      return;
    }
    setRows((current) => [{ id: nextId.current++, contractNo, itemNo }, ...current]);
    feedback.success(`${itemLabel} ${itemNo} confirmed`);
  };

  return (
    <>
      <PageHeader
        title="Confirm arrival"
        subtitle="Placeholder: shows the scanner components. Nothing is saved."
      />
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2} sx={{ maxWidth: 420 }}>
          <ScanInput
            label={contractLabel}
            autoFocus
            forceUppercase
            clearOnScan={false}
            value={contractNo}
            onValueChange={setContractNo}
            inputRef={chain.ref('contractNo')}
            onScan={onContractScan}
          />
          <ScanInput
            label={itemLabel}
            forceUppercase
            inputRef={chain.ref('itemNo')}
            onScan={onItemScan}
          />
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="error"
              onClick={() => feedback.error('Simulated bad scan')}
            >
              Simulate bad scan
            </Button>
            <Button
              variant="outlined"
              onClick={() => setConfirmClear(true)}
              disabled={rows.length === 0}
            >
              Clear list
            </Button>
          </Stack>
        </Stack>
      </Paper>
      <InventoryGrid<ScanRow>
        columns={columns}
        rows={rows}
        emptyMessage="No items scanned yet"
        hideFooter
        disableVirtualization
      />
      <ConfirmDialog
        open={confirmClear}
        destructive
        title="Clear scanned items?"
        message="The list on this screen will be emptied."
        confirmLabel="Clear"
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setRows([]);
          setConfirmClear(false);
          chain.reset();
        }}
      />
    </>
  );
}
