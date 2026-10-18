import type { Navigation, NavigationPageItem } from '@toolpad/core/AppProvider';
import { getMenuIcon } from '@cims/ui';
import type { LegacyMenuRow } from './menuStub';

const NO_PARENT = new Set(['', '0']);

/**
 * The id of the row this row hangs under.
 * ASSUMPTION to confirm against real CloudMenu data: a level-1 child carries its parent in
 * MenuParentID, a level-2 child adds MenuChild1ParentID, a level-3 child adds MenuChild2ParentID.
 * The deepest non-empty id wins.
 */
function parentIdOf(menuRow: LegacyMenuRow): string | null {
  for (const id of [menuRow.menuChild2ParentId, menuRow.menuChild1ParentId, menuRow.menuParentId]) {
    if (id && !NO_PARENT.has(id)) return id;
  }
  return null;
}

/** Legacy page URL: /Controller/Action. Leaf routes keep these paths. */
export function legacyPath(menuRow: LegacyMenuRow): string | null {
  if (!menuRow.menuController) return null;
  return `/${menuRow.menuController}/${menuRow.menuAction || 'Index'}`;
}

/** Builds the Toolpad navigation tree from legacy menu rows. Disabled rows and empty groups are dropped. */
export function buildNavigation(rows: readonly LegacyMenuRow[]): Navigation {
  const active = rows.filter((menuRow) => menuRow.menuStatus);
  const byParent = new Map<string | null, LegacyMenuRow[]>();
  for (const menuRow of active) {
    const parent = parentIdOf(menuRow);
    byParent.set(parent, [...(byParent.get(parent) ?? []), menuRow]);
  }

  const toItem = (menuRow: LegacyMenuRow): NavigationPageItem | null => {
    const children = (byParent.get(menuRow.menuId) ?? [])
      .map(toItem)
      .filter((item): item is NavigationPageItem => item !== null);
    const path = legacyPath(menuRow);

    if (!path && children.length === 0) return null;

    const item: NavigationPageItem = {
      kind: 'page',
      title: menuRow.menuName,
      icon: getMenuIcon(menuRow.menuImageClass),
    };
    // The segment is the full legacy path so the generated link equals the legacy URL.
    if (path) item.segment = path.slice(1);
    if (children.length > 0) item.children = children;
    return item;
  };

  return (byParent.get(null) ?? [])
    .map(toItem)
    .filter((item): item is NavigationPageItem => item !== null);
}
