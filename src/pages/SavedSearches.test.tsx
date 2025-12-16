import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SavedSearches from './SavedSearches';

// Mock services
const mockGetCurrentUser = vi.fn();
const mockList = vi.fn();
const mockCreate = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/api/services', () => ({
  authService: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
  savedSearchesService: {
    list: () => mockList(),
    create: (data: unknown) => mockCreate(data),
    delete: (id: string) => mockDelete(id),
    update: (id: string, data: unknown) => mockUpdate(id, data),
  },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderSavedSearches() {
  if (!('ResizeObserver' in globalThis)) {
    ;(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <SavedSearches />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('SavedSearches Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ user: { id: 'user-1', name: 'Test User' } });
    mockList.mockResolvedValue({ savedSearches: [] });
    mockCreate.mockResolvedValue({ savedSearch: { id: 'search-1' } });
    mockDelete.mockResolvedValue({ success: true });
    mockUpdate.mockResolvedValue({ success: true });
  });

  it('shows empty state and opens create form from CTA', async () => {
    const user = userEvent.setup();
    renderSavedSearches();

    expect(await screen.findByText(/No Saved Searches/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Create Your First Search/i }));
    expect(await screen.findByText(/Create Saved Search/i)).toBeInTheDocument();
  });

  it('does not create when required fields are missing', async () => {
    const user = userEvent.setup();
    renderSavedSearches();

    await user.click(await screen.findByRole('button', { name: /New Search/i }));
    expect(await screen.findByText(/Create Saved Search/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Save Search/i }));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('creates a saved search with defaults and calls create service', async () => {
    const user = userEvent.setup();
    renderSavedSearches();

    await user.click(await screen.findByRole('button', { name: /New Search/i }));

    await user.type(screen.getByPlaceholderText('e.g., Weekend Table Saw'), 'My Search');
    await user.type(screen.getByPlaceholderText('e.g., table saw'), 'saw');
    await user.click(screen.getByRole('button', { name: /Save Search/i }));

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'My Search',
        filters: {
          query: 'saw',
          category: 'all',
          priceMin: 0,
          priceMax: 200,
          radiusMiles: 10,
          emailAlerts: true,
          alertFrequency: 'daily',
        },
      });
    });
  });

  it('renders saved searches list, toggles alerts via update, and deletes via confirmation dialog', async () => {
    const user = userEvent.setup();
    mockList.mockResolvedValue({
      savedSearches: [
        {
          id: 's1',
          name: 'Search 1',
          filters: {
            emailAlerts: true,
            query: 'drill',
            category: 'tools',
            priceMin: 0,
            priceMax: 50,
            radiusMiles: 5,
            alertFrequency: 'daily',
          },
        },
      ],
    });

    renderSavedSearches();

    expect(await screen.findByText('Search 1')).toBeInTheDocument();
    expect(screen.getByText(/"drill"/i)).toBeInTheDocument();
    expect(screen.getByText(/Alerts On/i)).toBeInTheDocument();

    const card = screen.getByText('Search 1').closest('div.rounded-xl');
    if (!(card instanceof HTMLElement)) throw new Error('Saved search card not found');
    const cardQueries = within(card);

    const runSearchLink = screen.getByRole('link', { name: /Run This Search Now/i });
    expect(runSearchLink).toHaveAttribute('href', '/search?q=drill');

    // Toggle alerts off
    const buttonsInCard = cardQueries.getAllByRole('button');
    const toggleButton = buttonsInCard.find((b) => b.querySelector('svg[class*="lucide-bell"]'));
    if (!toggleButton) throw new Error('Toggle alerts button not found');
    await user.click(toggleButton);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('s1', { filters: { emailAlerts: false } });
    });

    // Delete flow
    const deleteButton = buttonsInCard.find((b) => b.querySelector('svg[class*="lucide-trash"]'));
    if (!deleteButton) throw new Error('Delete button not found');
    await user.click(deleteButton);
    expect(await screen.findByText(/Delete Saved Search\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Delete Search/i }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('s1');
    });

    // Ensure we didn't open create form accidentally
    expect(cardQueries.queryByText(/Create Saved Search/i)).not.toBeInTheDocument();
  });
});
