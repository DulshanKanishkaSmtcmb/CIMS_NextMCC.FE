import { screen } from '@testing-library/react';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it } from 'vitest';
import { configure, resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { FieldCaptionsPage } from './FieldCaptionsPage';

const captions = {
  sysCaption: 'Customs System',
  contractNoCaption: 'Contract No',
  itemNoCaption: 'Item No',
  poNoCaption: 'PO No',
  deliveryNoCaption: 'Delivery No',
};

afterEach(() => resetClient());

describe('FieldCaptionsPage', () => {
  it('loads the five captions from the API and shows them in the grid', async () => {
    const seen: InternalAxiosRequestConfig[] = [];
    configure({
      baseURL: 'http://api.test',
      getToken: () => 'tok',
      getTenant: () => 'MCC',
      axiosConfig: {
        adapter: async (config) => {
          seen.push(config);
          return { data: captions, status: 200, statusText: 'OK', headers: {}, config };
        },
      },
    });

    renderWithProviders(<FieldCaptionsPage />, { preloadedState: signedInState });

    expect(await screen.findByText('Customs System')).toBeInTheDocument();
    for (const caption of Object.values(captions)) {
      expect(screen.getByText(caption, { selector: '[role="gridcell"]' })).toBeInTheDocument();
    }
    expect(seen[0]?.url).toBe('/api/v1/reference/field-captions');
    expect(seen[0]?.headers.get('Authorization')).toBe('Bearer tok');
    expect(seen[0]?.headers.get('X-Tenant')).toBe('MCC');
  });

  it('shows an error message when the API fails', async () => {
    configure({
      baseURL: 'http://api.test',
      axiosConfig: {
        adapter: async (config) => {
          throw new AxiosError('boom', '500', config, null, {
            data: { title: 'Database unavailable' },
            status: 500,
            statusText: '',
            headers: {},
            config,
          });
        },
      },
    });

    renderWithProviders(<FieldCaptionsPage />, { preloadedState: signedInState });

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
  });
});
