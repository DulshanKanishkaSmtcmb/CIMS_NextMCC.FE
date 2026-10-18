import { describe, expect, it } from 'vitest';
import { buildNavigation, legacyPath } from './buildNavigation';
import { MENU_STUB, type LegacyMenuRow } from './menuStub';

const base: LegacyMenuRow = {
  menuId: 'x',
  menuName: 'X',
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
};

const row = (partial: Partial<LegacyMenuRow>): LegacyMenuRow => ({ ...base, ...partial });

describe('legacyPath', () => {
  it('is /Controller/Action, defaulting the action to Index', () => {
    expect(legacyPath(row({ menuController: 'Data', menuAction: 'ConfirmArrival' }))).toBe(
      '/Data/ConfirmArrival',
    );
    expect(legacyPath(row({ menuController: 'Home' }))).toBe('/Home/Index');
    expect(legacyPath(row({}))).toBeNull();
  });
});

describe('buildNavigation', () => {
  it('turns the stub into groups with legacy-path leaves', () => {
    const navigation = buildNavigation(MENU_STUB);

    expect(navigation.map((item) => ('title' in item ? item.title : ''))).toEqual([
      'Home',
      'Data',
      'File',
      'Reference',
    ]);

    const [home, data, file, reference] = navigation as Array<{
      segment?: string;
      children?: Array<{ title?: string; segment?: string }>;
    }>;
    expect(home?.segment).toBe('Home/Index');
    expect(data?.segment).toBeUndefined();
    expect(data?.children).toMatchObject([
      { title: 'Confirm Arrival', segment: 'Data/ConfirmArrival' },
    ]);
    expect(file?.children).toMatchObject([
      { title: 'Country', segment: 'File/Country' },
      { title: 'Ports...', segment: 'File/Ports' },
      { title: 'DC', segment: 'File/DC' },
    ]);
    expect(reference?.children).toMatchObject([
      { title: 'Field Captions', segment: 'Reference/FieldCaptions' },
    ]);
  });

  it('nests three levels using the child parent ids', () => {
    const navigation = buildNavigation([
      row({ menuId: 'a', menuName: 'A', menuIsParent: true }),
      row({ menuId: 'a.1', menuName: 'A1', menuParentId: 'a', menuIsChild1Parent: true }),
      row({
        menuId: 'a.1.1',
        menuName: 'Leaf',
        menuParentId: 'a',
        menuChild1ParentId: 'a.1',
        menuController: 'C',
        menuAction: 'Go',
      }),
    ]);

    const a = navigation[0] as { children?: Array<{ children?: Array<{ segment?: string }> }> };
    expect(a.children?.[0]?.children?.[0]?.segment).toBe('C/Go');
  });

  it('drops disabled rows and groups without pages', () => {
    const navigation = buildNavigation([
      row({ menuId: 'g', menuName: 'Empty group', menuIsParent: true }),
      row({
        menuId: 'p',
        menuName: 'Off',
        menuController: 'C',
        menuAction: 'A',
        menuStatus: false,
      }),
      row({ menuId: 'q', menuName: 'On', menuController: 'C', menuAction: 'B' }),
    ]);

    expect(navigation).toHaveLength(1);
    expect(navigation[0]).toMatchObject({ title: 'On', segment: 'C/B' });
  });
});
