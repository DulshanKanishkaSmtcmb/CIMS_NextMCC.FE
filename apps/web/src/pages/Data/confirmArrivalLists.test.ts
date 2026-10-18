import { describe, expect, it } from 'vitest';
import type { PendingArrivals, PendingContract } from '../../services/arrivalsApi';
import {
  addRow,
  buildConfirmRequest,
  editContainerNo,
  listsFromLoad,
  removeRow,
  roundTo,
  selectAll,
  toggleContainer,
  toggleSupplier,
  totals,
} from './confirmArrivalLists';

const contract = (rcvNo: string, extra: Partial<PendingContract> = {}): PendingContract => ({
  rcvNo,
  arrivalDate: null,
  contractNo: `C-${rcvNo}`,
  itemNo: 'I1',
  shipperCode: 'S1',
  shipperName: 'Supplier 1',
  cargoType: 'Box',
  warehouse: 'JO JO WEB',
  ctns: 1,
  pcs: 10,
  grossWgt: 1.006,
  cbm: 0.0004,
  inboundVesselOrderNo: 0,
  inboundBookingDate: null,
  confirmArriveStatus: '',
  inboundEtd: null,
  inboundContainerOrderNo: 0,
  country: 'IND',
  ...extra,
});

const onContainer = {
  inboundEtd: '2026-10-17T00:00:00',
  inboundVesselOrderNo: 1,
  inboundContainerOrderNo: 1,
};

const loaded: PendingArrivals = {
  contracts: [
    contract('R1'),
    contract('R2', { shipperCode: 'S2' }),
    contract('R3', { ...onContainer }), // supplier S1 AND on container 1
  ],
  suppliers: [
    { shipperCode: 'S1', shipperName: 'Supplier 1' },
    { shipperCode: 'S2', shipperName: 'Supplier 2' },
  ],
  containers: [
    {
      inboundEtd: null,
      inboundVesselOrderNo: 0,
      inboundContainerOrderNo: 0,
      vesselName: '',
      loadReference: '',
      containerNo: '',
      containerType: '',
    },
    {
      ...onContainer,
      vesselName: 'MSC ANNA',
      loadReference: 'LR-1',
      containerNo: 'MSCU1',
      containerType: '40HC',
    },
  ],
};

const rcvNos = (rows: { rcvNo: string }[]) => rows.map((r) => r.rcvNo);

describe('confirm arrival list logic (legacy ConfirmArrival.js)', () => {
  it('starts with unticked lists and empty grids after a load', () => {
    const s = listsFromLoad(loaded);
    expect(s.suppliers.every((x) => !x.checked)).toBe(true);
    expect(s.containers.every((x) => !x.checked)).toBe(true);
    expect(s.pending).toEqual([]);
    expect(s.selected).toEqual([]);
  });

  it('ticking a supplier adds every loaded row of that supplier, including rows on a container', () => {
    const s = toggleSupplier(listsFromLoad(loaded), 0, true);
    expect(rcvNos(s.pending)).toEqual(['R1', 'R3']);
  });

  it('ticking a container adds the rows with the same ETD, vessel order and container order', () => {
    const s = toggleContainer(listsFromLoad(loaded), 1, true);
    expect(rcvNos(s.pending)).toEqual(['R3']);
  });

  it('the 0/0 container key picks the rows that are not on a container', () => {
    const s = toggleContainer(listsFromLoad(loaded), 0, true);
    expect(rcvNos(s.pending)).toEqual(['R1', 'R2']);
  });

  it('a row picked by a supplier and a container is listed twice, as on the legacy page', () => {
    let s = toggleSupplier(listsFromLoad(loaded), 0, true);
    s = toggleContainer(s, 1, true);
    expect(rcvNos(s.pending)).toEqual(['R1', 'R3', 'R3']);
    expect(new Set(s.pending.map((r) => r.uid)).size).toBe(3);
  });

  it('unticking removes the matching rows from Pending and from Selected', () => {
    let s = toggleSupplier(listsFromLoad(loaded), 0, true);
    s = toggleSupplier(s, 1, true);
    s = addRow(s, s.pending[0].uid); // R1 to Selected
    s = toggleSupplier(s, 0, false);
    expect(rcvNos(s.pending)).toEqual(['R2']);
    expect(rcvNos(s.selected)).toEqual([]);
  });

  it('Add and Remove move a row to the end of the other list; Select All moves everything', () => {
    let s = toggleSupplier(listsFromLoad(loaded), 0, true);
    s = toggleSupplier(s, 1, true); // pending R1, R3, R2
    s = addRow(s, s.pending[1].uid);
    expect(rcvNos(s.selected)).toEqual(['R3']);
    s = removeRow(s, s.selected[0].uid);
    expect(rcvNos(s.pending)).toEqual(['R1', 'R2', 'R3']);
    s = selectAll(s);
    expect(rcvNos(s.selected)).toEqual(['R1', 'R2', 'R3']);
    expect(s.pending).toEqual([]);
  });

  it('totals round like the Knockout numeric extender (0, 0, 2 and 3 decimals)', () => {
    const t = totals([contract('A'), contract('B', { ctns: 2.6, cbm: 0.0006 })]);
    expect(t).toEqual({ contracts: 2, ctns: 4, pcs: 20, grossWgt: 2.02, cbm: 0.001 });
    expect(roundTo(1.0005, 3)).toBe(1.001);
  });

  it('the save request carries Selected in order and the ticked container with the edited container no', () => {
    let s = toggleContainer(listsFromLoad(loaded), 1, true);
    s = editContainerNo(s, 1, 'MSCU9999999');
    s = selectAll(s);
    const request = buildConfirmRequest(s, '2026-10-18T14:30:00');
    expect(request.rcvNos).toEqual(['R3']);
    expect(request.arrivalDate).toBe('2026-10-18T14:30:00');
    expect(request.container).toEqual({
      inboundEtd: '2026-10-17T00:00:00',
      vesselOrderNo: 1,
      vesselName: 'MSC ANNA',
      containerOrderNo: 1,
      loadReference: 'LR-1',
      containerNo: 'MSCU9999999',
      containerType: '40HC',
    });
  });

  it('with several ticked containers only the first in list order is sent (legacy saved Rows[0] only)', () => {
    let s = listsFromLoad(loaded);
    s = toggleContainer(s, 1, true);
    s = toggleContainer(s, 0, true);
    s = selectAll(s);
    const request = buildConfirmRequest(s, '2026-10-18T14:30:00');
    expect(request.rcvNos).toEqual(['R3', 'R1', 'R2']);
    expect(request.container).toEqual({
      inboundEtd: null,
      vesselOrderNo: 0,
      vesselName: '',
      containerOrderNo: 0,
      loadReference: '',
      containerNo: '',
      containerType: '',
    });
  });

  it('sends no container when none is ticked', () => {
    const s = selectAll(toggleSupplier(listsFromLoad(loaded), 0, true));
    expect(buildConfirmRequest(s, '2026-10-18T14:30:00').container).toBeNull();
  });
});
