import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReliefRequestForm from './ReliefRequestForm';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ search: '' })
}), { virtual: true });

jest.mock('../layout/DashboardShell', () => ({
  __esModule: true,
  default: ({ children }) => <div>{children}</div>
}));

const originalStructuredClone = global.structuredClone;
beforeAll(() => {
  global.structuredClone = (value) => require('v8').deserialize(require('v8').serialize(value));
});
afterAll(() => {
  global.structuredClone = originalStructuredClone;
});

const renderReliefJourney = (width) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  global.fetch = jest.fn(async (url) => ({
    ok: true,
    json: async () => {
      if (url.includes('debug-session')) return { role: 'barangay' };
      if (url.includes('barangays/me')) return { _id: 'b1', barangayName: 'Test' };
      if (url.includes('bootstrap')) return { rows: [{ evacuationCenterName: 'Hall', male: 1, female: 1 }] };
      if (url.includes('journey/current')) {
        return {
          request: {
            _id: 'request-1',
            requestNo: 'RR-2026-0001',
            status: 'received',
            currentStage: 'received',
            supportTypes: ['foodpacks'],
            rows: [{ evacuationCenterName: 'Hall', male: 1, female: 1 }]
          },
          stage: 'received',
          summary: { receivedReleases: 1 }
        };
      }
      if (url.includes('relief-distributions')) {
        return {
          request: { _id: 'request-1', currentStage: 'received', supportTypes: ['foodpacks'], rows: [{ evacuationCenterName: 'Hall', male: 1, female: 1 }] },
          records: [],
          caps: { allowsFood: true, foodPacksReceived: 30 }
        };
      }
      return [];
    }
  }));

  render(<ReliefRequestForm />);
  fireEvent.resize(window);
  return screen.findByRole('heading', {
    name: 'Request, track, and confirm relief delivery'
  });
};

test('opens DAFAC family input in a mobile modal', async () => {
  await renderReliefJourney(390);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add DAFAC family record' }))[0]);

  expect(await screen.findByRole('dialog', { name: 'DAFAC family distribution' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save Family Record' })).toBeInTheDocument();
});

test('shows required field validation inside the mobile DAFAC modal', async () => {
  await renderReliefJourney(390);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add DAFAC family record' }))[0]);
  const modal = await screen.findByRole('dialog', { name: 'DAFAC family distribution' });

  fireEvent.click(screen.getByRole('button', { name: 'Save Family Record' }));

  expect(await screen.findByText('Serial number is required for the DAFAC record.')).toBeInTheDocument();
  expect(screen.getByText('Enter the family head surname or first name.')).toBeInTheDocument();
  expect(modal).toBeInTheDocument();
  expect(global.fetch.mock.calls.some(([url, options]) => String(url).includes('/records') && options?.method === 'POST')).toBe(false);
});

test('saves a valid DAFAC record and closes the mobile modal', async () => {
  await renderReliefJourney(390);
  fireEvent.click((await screen.findAllByRole('button', { name: 'Add DAFAC family record' }))[0]);
  const modal = await screen.findByRole('dialog', { name: 'DAFAC family distribution' });

  const inputs = modal.querySelectorAll('input');
  fireEvent.change(inputs[0], { target: { value: 'F-01' } });
  fireEvent.change(modal.querySelector('select'), { target: { value: 'Hall' } });
  fireEvent.change(inputs[2], { target: { value: new Date().toISOString().slice(0, 10) } });
  fireEvent.change(inputs[3], { target: { value: 'Cruz' } });
  fireEvent.change(inputs[4], { target: { value: 'Ana' } });
  fireEvent.change(inputs[6], { target: { value: '1' } });
  const signOffInputs = modal.querySelectorAll('.rrf-dafac-editor-grid.signoff input');
  fireEvent.change(signOffInputs[0], { target: { value: 'Ana Cruz' } });
  fireEvent.change(signOffInputs[1], { target: { value: 'Officer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Family Record' }));

  await waitFor(() => expect(Array.from(modal.querySelectorAll('.rrf-inline-error')).map((item) => item.textContent)).toEqual([]));

  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining('/records'),
    expect.objectContaining({ method: 'POST' })
  ));
  await waitFor(() => expect(modal).not.toBeInTheDocument());
});
