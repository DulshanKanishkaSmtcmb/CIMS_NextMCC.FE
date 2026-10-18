import type {
  ConfirmArrivalRequest,
  PendingArrivals,
  PendingContainer,
  PendingContract,
  PendingSupplier,
} from '../../services/arrivalsApi';

/**
 * The list logic of legacy AppJs/ConfirmArrival.js (SuplierRow / CntrRow / DelDo / SelectAllClick / CalDo subscriptions),
 * as pure functions over one state object. Behaviour kept on purpose, including the quirks (docs/13 section 1.3):
 *  - ticking a supplier appends ALL loaded contracts of that supplier code to Pending (also rows on a container);
 *  - ticking a container appends the contracts with the same InboundETD + vessel order + container order;
 *  - unticking removes the matching rows from Pending AND Selected;
 *  - a row matched by a supplier and a container is added twice (no de-duplication);
 *  - Add / Remove move a row to the END of the other list; Select All moves every Pending row to Selected.
 */
export interface ListRow extends PendingContract {
  /** Unique per added row (the same contract can be in the lists twice). */
  uid: number;
}

export interface SupplierLine extends PendingSupplier {
  id: number;
  checked: boolean;
}

export interface ContainerLine extends PendingContainer {
  id: number;
  checked: boolean;
}

export interface ListsState {
  /** Every contract of the last load (legacy arrPO), hidden until picked by a supplier or container. */
  loaded: PendingContract[];
  suppliers: SupplierLine[];
  containers: ContainerLine[];
  pending: ListRow[];
  selected: ListRow[];
  nextUid: number;
}

export const emptyLists: ListsState = {
  loaded: [],
  suppliers: [],
  containers: [],
  pending: [],
  selected: [],
  nextUid: 1,
};

/** After "Load Contracts": suppliers and containers unticked, Pending and Selected empty. */
export function listsFromLoad(data: PendingArrivals): ListsState {
  return {
    loaded: data.contracts,
    suppliers: data.suppliers.map((s, id) => ({ ...s, id, checked: false })),
    containers: data.containers.map((c, id) => ({ ...c, id, checked: false })),
    pending: [],
    selected: [],
    nextUid: 1,
  };
}

function append(
  state: ListsState,
  contracts: PendingContract[],
): Pick<ListsState, 'pending' | 'nextUid'> {
  let uid = state.nextUid;
  const added = contracts.map((c) => ({ ...c, uid: uid++ }));
  return { pending: [...state.pending, ...added], nextUid: uid };
}

const sameContainer = (row: PendingContract, line: PendingContainer) =>
  row.inboundEtd === line.inboundEtd &&
  row.inboundVesselOrderNo === line.inboundVesselOrderNo &&
  row.inboundContainerOrderNo === line.inboundContainerOrderNo;

export function toggleSupplier(state: ListsState, id: number, checked: boolean): ListsState {
  const line = state.suppliers.find((s) => s.id === id);
  if (!line || line.checked === checked) return state;
  const suppliers = state.suppliers.map((s) => (s.id === id ? { ...s, checked } : s));
  if (checked) {
    return {
      ...state,
      suppliers,
      ...append(
        state,
        state.loaded.filter((c) => c.shipperCode === line.shipperCode),
      ),
    };
  }
  const keep = (r: ListRow) => r.shipperCode !== line.shipperCode;
  return {
    ...state,
    suppliers,
    pending: state.pending.filter(keep),
    selected: state.selected.filter(keep),
  };
}

export function toggleContainer(state: ListsState, id: number, checked: boolean): ListsState {
  const line = state.containers.find((c) => c.id === id);
  if (!line || line.checked === checked) return state;
  const containers = state.containers.map((c) => (c.id === id ? { ...c, checked } : c));
  if (checked) {
    return {
      ...state,
      containers,
      ...append(
        state,
        state.loaded.filter((c) => sameContainer(c, line)),
      ),
    };
  }
  const keep = (r: ListRow) => !sameContainer(r, line);
  return {
    ...state,
    containers,
    pending: state.pending.filter(keep),
    selected: state.selected.filter(keep),
  };
}

/** Container No is the one editable cell (legacy `<input data-bind="value:CntrNo">`); it is sent with the save. */
export function editContainerNo(state: ListsState, id: number, containerNo: string): ListsState {
  return {
    ...state,
    containers: state.containers.map((c) => (c.id === id ? { ...c, containerNo } : c)),
  };
}

export function addRow(state: ListsState, uid: number): ListsState {
  const row = state.pending.find((r) => r.uid === uid);
  if (!row) return state;
  return {
    ...state,
    pending: state.pending.filter((r) => r.uid !== uid),
    selected: [...state.selected, row],
  };
}

export function removeRow(state: ListsState, uid: number): ListsState {
  const row = state.selected.find((r) => r.uid === uid);
  if (!row) return state;
  return {
    ...state,
    selected: state.selected.filter((r) => r.uid !== uid),
    pending: [...state.pending, row],
  };
}

export function selectAll(state: ListsState): ListsState {
  if (state.pending.length === 0) return state;
  return { ...state, selected: [...state.selected, ...state.pending], pending: [] };
}

/** Knockout `numeric` extender: Math.round to the precision, shown without padding or separators. */
export function roundTo(value: number, precision: number): number {
  const m = 10 ** precision;
  return Math.round((Number.isFinite(value) ? value : 0) * m) / m;
}

export interface Totals {
  contracts: number;
  ctns: number;
  pcs: number;
  grossWgt: number;
  cbm: number;
}

/** Footer of each PO grid (legacy CalDo): sums of the rounded row values, rounded again. */
export function totals(rows: readonly PendingContract[]): Totals {
  const sum = (pick: (r: PendingContract) => number, p: number) =>
    roundTo(
      rows.reduce((acc, r) => acc + roundTo(pick(r), p), 0),
      p,
    );
  return {
    contracts: rows.length,
    ctns: sum((r) => r.ctns, 0),
    pcs: sum((r) => r.pcs, 0),
    grossWgt: sum((r) => r.grossWgt, 2),
    cbm: sum((r) => r.cbm, 3),
  };
}

/** Body of POST api/v1/arrivals/confirm: Selected rows in order and the FIRST ticked container (legacy saved only that one). */
export function buildConfirmRequest(state: ListsState, arrivalDate: string): ConfirmArrivalRequest {
  const first = firstTickedContainer(state);
  return {
    arrivalDate,
    rcvNos: state.selected.map((r) => r.rcvNo),
    container: first
      ? {
          inboundEtd: first.inboundEtd,
          vesselOrderNo: first.inboundVesselOrderNo,
          vesselName: first.vesselName,
          containerOrderNo: first.inboundContainerOrderNo,
          loadReference: first.loadReference,
          containerNo: first.containerNo,
          containerType: first.containerType,
        }
      : null,
  };
}

/** The FIRST ticked container: the only one whose vessel/container details the save sends (legacy Q4, docs/13 1.8). */
export function firstTickedContainer(state: ListsState): ContainerLine | undefined {
  return state.containers.find((c) => c.checked);
}

/** How many loaded contracts ticking each line would list, keyed by line id (shown next to each line). */
export function lineCounts(state: ListsState): {
  suppliers: Map<number, number>;
  containers: Map<number, number>;
} {
  return {
    suppliers: new Map(
      state.suppliers.map((s) => [
        s.id,
        state.loaded.filter((c) => c.shipperCode === s.shipperCode).length,
      ]),
    ),
    containers: new Map(
      state.containers.map((line) => [
        line.id,
        state.loaded.filter((c) => sameContainer(c, line)).length,
      ]),
    ),
  };
}

export type PickTarget =
  { kind: 'container'; line: ContainerLine } | { kind: 'supplier'; line: SupplierLine };

/**
 * Quick pick (scan field): the line whose Container No, Load Reference or Supplier Code equals the scanned or typed
 * text, ignoring case and surrounding spaces. Containers first. Picking only ticks the line, exactly like a click.
 */
export function findPickTarget(state: ListsState, text: string): PickTarget | null {
  const wanted = text.trim().toUpperCase();
  if (!wanted) return null;
  const same = (value: string | null | undefined) =>
    !!value && value.trim().toUpperCase() === wanted;
  const container =
    state.containers.find((c) => same(c.containerNo)) ??
    state.containers.find((c) => same(c.loadReference));
  if (container) return { kind: 'container', line: container };
  const supplier = state.suppliers.find((s) => same(s.shipperCode));
  return supplier ? { kind: 'supplier', line: supplier } : null;
}

/** Rcv Nos that appear more than once in the rows (a contract picked by its supplier AND its container, Q5). */
export function duplicateRcvNos(rows: readonly ListRow[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.rcvNo)) twice.add(r.rcvNo);
    seen.add(r.rcvNo);
  }
  return [...twice];
}
