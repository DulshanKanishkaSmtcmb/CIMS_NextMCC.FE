/**
 * A row shaped like the legacy CloudMenu table (columns used by DataMenu.cs and DataApiController.cs),
 * with camelCase names as the future API will return them.
 */
export interface LegacyMenuRow {
  menuId: string;
  menuName: string;
  menuParentId: string;
  menuChild1ParentId: string;
  menuChild2ParentId: string;
  menuIsParent: boolean;
  menuIsChild1Parent: boolean;
  menuIsChild2Parent: boolean;
  /** Legacy: CSS class. In this stub: a key understood by getMenuIcon() in @cims/ui. */
  menuImageClass: string;
  menuArea: string;
  menuController: string;
  menuAction: string;
  menuActionPara: string;
  menuStatus: boolean;
}

function row(
  partial: Partial<LegacyMenuRow> & Pick<LegacyMenuRow, 'menuId' | 'menuName'>,
): LegacyMenuRow {
  return {
    menuParentId: '0',
    menuChild1ParentId: '0',
    menuChild2ParentId: '0',
    menuIsParent: false,
    menuIsChild1Parent: false,
    menuIsChild2Parent: false,
    menuImageClass: 'page',
    menuArea: '',
    menuController: '',
    menuAction: '',
    menuActionPara: '',
    menuStatus: true,
    ...partial,
  };
}

/**
 * TODO: replace with the user's allocated menu from the API (CloudMenu joined with CloudMenuAllocation).
 * The ids below are illustrative, not real CloudMenu ids.
 */
export const MENU_STUB: readonly LegacyMenuRow[] = [
  row({
    menuId: '1',
    menuName: 'Home',
    menuImageClass: 'home',
    menuController: 'Home',
    menuAction: 'Index',
  }),
  row({ menuId: '2', menuName: 'Data', menuIsParent: true, menuImageClass: 'folder' }),
  row({
    menuId: '2.1',
    menuName: 'Confirm Arrival',
    menuParentId: '2',
    menuImageClass: 'scan',
    menuController: 'Data',
    menuAction: 'ConfirmArrival',
  }),
  row({ menuId: '3', menuName: 'Reference', menuIsParent: true, menuImageClass: 'reference' }),
  row({
    menuId: '3.1',
    menuName: 'Field Captions',
    menuParentId: '3',
    menuImageClass: 'page',
    menuController: 'Reference',
    menuAction: 'FieldCaptions',
  }),
];
