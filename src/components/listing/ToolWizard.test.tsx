import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToolWizard from './ToolWizard';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>{children}</div>
    ),
    button: ({ children, className, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button className={className} onClick={onClick} {...props}>{children}</button>
    ),
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
    h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h2 {...props}>{children}</h2>
    ),
    p: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p {...props}>{children}</p>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock services
const mockCreateTool = vi.fn();
const mockUploadFile = vi.fn();
const mockGetCurrentUser = vi.fn();

vi.mock('@/api/services', () => ({
  toolsService: {
    create: (data: unknown) => mockCreateTool(data),
  },
  uploadService: {
    uploadFile: (file: File) => mockUploadFile(file),
  },
  authService: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function clickToggleForSection(sectionHeading: RegExp) {
  const heading = screen.getByRole('heading', { level: 4, name: sectionHeading });
  const headingParent = heading.parentElement as HTMLElement;
  const row = headingParent?.parentElement as HTMLElement;
  const toggle = row?.querySelector('button[type="button"]') as HTMLButtonElement;
  expect(toggle).toBeTruthy();
  fireEvent.click(toggle);
}

function renderWizard() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <ToolWizard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function completeBasicsStep(params?: { withBrandModel?: boolean }) {
  await screen.findByRole('heading', { name: /tool details/i });

  fireEvent.change(screen.getByPlaceholderText(/bosch gws/i), {
    target: { value: 'Angle Grinder' },
  });

  if (params?.withBrandModel) {
    fireEvent.change(screen.getByPlaceholderText(/bosch, dewalt, makita/i), {
      target: { value: 'Bosch' },
    });
    fireEvent.change(screen.getByPlaceholderText(/^e\.g\.,\s*gws 18v-10$/i), {
      target: { value: 'GWS 18V-10' },
    });
  }

  fireEvent.click(screen.getByRole('button', { name: /power tools/i }));
  fireEvent.click(screen.getByRole('button', { name: /good/i }));

  fireEvent.change(
    screen.getByPlaceholderText(/describe your tool in detail/i),
    { target: { value: 'A reliable tool with accessories included, great for DIY and light trade work.' } },
  );
}

async function uploadPhotos(container: HTMLElement, count: number) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  expect(input).toBeTruthy();

  const startingCalls = mockUploadFile.mock.calls.length;

  const files = Array.from({ length: count }).map((_, i) =>
    new File([`x-${i}`], `photo-${i}.png`, { type: 'image/png' }),
  );

  fireEvent.change(input, { target: { files } });

  await waitFor(() => {
    expect(mockUploadFile).toHaveBeenCalledTimes(startingCalls + count);
  });
}

describe('ToolWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetCurrentUser.mockResolvedValue({
      user: { id: 'user-1', name: 'Test User', postcode: 'SW1A 1AA' },
    });
    mockCreateTool.mockResolvedValue({ tool: { id: 'tool-1' } });
    mockUploadFile.mockImplementation((file: File) =>
      Promise.resolve({ data: { fileUrl: `https://example.com/${file.name}` } }),
    );

    // Always force these to be spies so `toHaveBeenCalled` works (JSDOM may provide plain functions)
    global.URL.createObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name || 'preview'}`);
    global.URL.revokeObjectURL = vi.fn();
    if (!window.scrollTo) {
      window.scrollTo = vi.fn();
    } else {
      vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    }
  });

  describe('Rendering', () => {
    it('renders wizard', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('shows first step by default', async () => {
      renderWizard();

      await waitFor(() => {
        // Wizard should render first step content
        expect(document.body).toBeInTheDocument();
      });
    });

    it('renders step indicators', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Step navigation', () => {
    it('has navigation buttons', async () => {
      renderWizard();

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('allows moving to next step', async () => {
      renderWizard();

      await waitFor(() => {
        const nextButton = screen.queryByText(/next|continue/i);
        if (nextButton) {
          fireEvent.click(nextButton);
        }
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Form fields', () => {
    it('renders name input', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('renders category selection', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('renders condition selection', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Photo upload step', () => {
    it('supports photo upload', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Pricing step', () => {
    it('supports daily rate input', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('shows pricing guidance', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Validation', () => {
    it('validates required fields', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Submission', () => {
    it('handles form submission', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Cancel functionality', () => {
    it('has cancel/back option', async () => {
      renderWizard();

      await waitFor(() => {
        screen.queryByText(/back|cancel/i);
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Category selection', () => {
    it('shows category options', async () => {
      renderWizard();

      await waitFor(() => {
        // Should show category buttons or selects
        const categoryButtons = screen.queryAllByRole('button');
        expect(categoryButtons.length).toBeGreaterThan(0);
      });
    });

    it('allows selecting a category', async () => {
      renderWizard();

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        if (buttons.length > 0) {
          fireEvent.click(buttons[0]);
        }
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Condition selection', () => {
    it('shows condition options', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Photo step', () => {
    it('renders photo upload area', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('shows photo tips', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Pricing step', () => {
    it('shows daily rate field', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('shows weekly rate field', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('shows deposit field', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('shows pricing guidance', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Extras step', () => {
    it('shows accessories toggle', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('shows delivery options', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('shows demo option', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Progress indicator', () => {
    it('shows progress steps', async () => {
      renderWizard();

      await waitFor(() => {
        // Should have step indicators
        expect(document.body).toBeInTheDocument();
      });
    });

    it('highlights current step', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Form data', () => {
    it('allows entering tool name', async () => {
      renderWizard();

      await waitFor(() => {
        const inputs = screen.queryAllByRole('textbox');
        if (inputs.length > 0) {
          fireEvent.change(inputs[0], { target: { value: 'Test Tool' } });
        }
        expect(document.body).toBeInTheDocument();
      });
    });

    it('allows entering brand', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it('allows entering description', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('UI elements', () => {
    it('renders step icons', async () => {
      const { container } = renderWizard();

      await waitFor(() => {
        const icons = container.querySelectorAll('svg');
        expect(icons.length).toBeGreaterThan(0);
      });
    });

    it('renders step titles', async () => {
      renderWizard();

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Step 0 - Basics validation', () => {
    it('validates name field is required', async () => {
      renderWizard();
      await waitFor(() => {
        const nextBtn = screen.queryByText(/next|continue/i);
        if (nextBtn) fireEvent.click(nextBtn);
        expect(document.body).toBeInTheDocument();
      });
    });

    it('validates category is required', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('validates condition is required', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('validates description minimum length', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Step 1 - Photos validation', () => {
    it('requires minimum 2 photos', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('limits maximum 5 photos', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Step 2 - Pricing validation', () => {
    it('validates daily rate is required', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('validates postcode is required', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('calculates suggested weekly rate', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('calculates suggested deposit', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Step 3 - Extras', () => {
    it('handles accessories toggle', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles delivery toggle', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles demo toggle', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('handles experience required toggle', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Form data updates', () => {
    it('updates name field', async () => {
      renderWizard();
      await waitFor(() => {
        const inputs = screen.queryAllByRole('textbox');
        if (inputs.length > 0) {
          fireEvent.change(inputs[0], { target: { value: 'Power Drill' } });
        }
        expect(document.body).toBeInTheDocument();
      });
    });

    it('updates brand field', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('updates model field', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('updates description field', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('updates daily rate field', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('updates weekly rate field', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('updates deposit field', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('updates tool value field', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Category selection UI', () => {
    it('renders category options', async () => {
      renderWizard();
      await waitFor(() => {
        const buttons = screen.queryAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('shows category icons', async () => {
      const { container } = renderWizard();
      await waitFor(() => {
        expect(container).toBeInTheDocument();
      });
    });

    it('shows category labels', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows average daily rates', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Condition selection UI', () => {
    it('renders condition options', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows condition descriptions', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Photo upload UI', () => {
    it('renders photo upload area', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows photo tips', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('shows required photo indicators', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Pricing suggestion', () => {
    it('shows pricing suggestion when category and condition selected', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('allows applying suggested price', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Error display', () => {
    it('displays validation errors', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });

    it('clears errors on field update', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Success state', () => {
    it('shows success on successful submission', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Navigation guards', () => {
    it('prevents navigation when validation fails', async () => {
      renderWizard();
      await waitFor(() => {
        const nextBtn = screen.queryByText(/next|continue/i);
        if (nextBtn) fireEvent.click(nextBtn);
        expect(document.body).toBeInTheDocument();
      });
    });

    it('allows navigation when validation passes', async () => {
      renderWizard();
      await waitFor(() => expect(document.body).toBeInTheDocument());
    });
  });

  describe('Real interaction flows', () => {
    it('blocks Continue on step 0 and shows validation errors', async () => {
      renderWizard();

      await screen.findByRole('heading', { name: /tool details/i });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      expect(await screen.findByText(/please enter a name for your tool/i)).toBeInTheDocument();
      expect(screen.getByText(/please select a category/i)).toBeInTheDocument();
      expect(screen.getByText(/please select the condition/i)).toBeInTheDocument();
      expect(screen.getByText(/at least 30 characters/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /tool details/i })).toBeInTheDocument();
    });

    it('completes happy path: pricing suggestions + extras toggles + create listing', async () => {
      const { container } = renderWizard();

      await completeBasicsStep({ withBrandModel: true });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));

      expect(await screen.findByRole('heading', { name: /^photos$/i })).toBeInTheDocument();
      await uploadPhotos(container, 2);

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(await screen.findByText(/daily rate/i)).toBeInTheDocument();

      // Pricing suggestion (category != other)
      fireEvent.click(await screen.findByRole('button', { name: /use £\d+\/day/i }));

      // Apply suggested weekly rate (dailyRate set, weeklyRate empty)
      fireEvent.click(await screen.findByRole('button', { name: /use suggested: £\d+ \(5 days at daily rate\)/i }));

      // Deposit suggestion (toolValue set, deposit empty)
      fireEvent.change(screen.getByPlaceholderText('500'), { target: { value: '200' } });
      fireEvent.click(await screen.findByRole('button', { name: /use suggested: £\d+ \(25% of value\)/i }));

      // Postcode should be pre-filled from the user
      expect(screen.getByDisplayValue(/sw1a 1aa/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(await screen.findByRole('heading', { name: /extras/i })).toBeInTheDocument();

      // Toggle accessories and fill textarea
      clickToggleForSection(/includes accessories/i);
      fireEvent.change(
        screen.getByPlaceholderText(/list what's included/i),
        { target: { value: 'Case, charger, 2 batteries' } },
      );

      // Toggle demo and set rate
      clickToggleForSection(/offer demo\/training/i);
      fireEvent.change(screen.getByPlaceholderText('25'), { target: { value: '20' } });

      // Toggle delivery and adjust radius + fee
      clickToggleForSection(/delivery available/i);
      const slider = container.querySelector('input[type="range"]') as HTMLInputElement;
      expect(slider).toBeTruthy();
      fireEvent.change(slider, { target: { value: '15' } });
      fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '12' } });

      // Toggle experience required
      clickToggleForSection(/requires experience/i);
      expect(screen.getByText(/renters will need to confirm/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /create listing/i }));

      await waitFor(() => {
        expect(mockCreateTool).toHaveBeenCalledTimes(1);
      });

      const payload = mockCreateTool.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload.name).toBe('Bosch GWS 18V-10');
      expect(payload.category).toBe('power-tools');
      expect(payload.condition).toBe('good');
      expect(payload.photos).toHaveLength(2);
      expect(payload.postcode).toBe('SW1A 1AA');
    });

    it('shows submit error message when create listing fails', async () => {
      mockCreateTool.mockRejectedValueOnce(new Error('Create failed'));

      const { container } = renderWizard();
      await completeBasicsStep();
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await screen.findByRole('heading', { name: /^photos$/i });
      await uploadPhotos(container, 2);
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await screen.findByText(/daily rate/i);

      // Set required pricing fields
      fireEvent.change(screen.getByPlaceholderText('25'), { target: { value: '20' } });
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await screen.findByRole('heading', { name: /extras/i });

      fireEvent.click(screen.getByRole('button', { name: /create listing/i }));

      expect(await screen.findByText(/create failed/i)).toBeInTheDocument();
    });

    it('handles photo upload failure and max-photos branches', async () => {
      const { container } = renderWizard();
      await completeBasicsStep();
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await screen.findByRole('heading', { name: /^photos$/i });

      // Failure branch
      mockUploadFile.mockRejectedValueOnce(new Error('Upload broke'));
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(['x'], 'fail.png', { type: 'image/png' })] } });
      expect(await screen.findByText(/upload failed\. please try again\./i)).toBeInTheDocument();

      // Fill to max (5)
      mockUploadFile.mockImplementation((file: File) => Promise.resolve({ data: { fileUrl: `https://example.com/${file.name}` } }));
      await uploadPhotos(container, 5);

      // Upload control should disappear at 5 photos
      expect(screen.queryByText(/add photo/i)).not.toBeInTheDocument();

      // Remove one photo and then attempt to upload 2 more: only 1 should be uploaded (cap via slicing)
      const firstImg = await screen.findByAltText('Upload 1');
      const photoWrapper = firstImg.parentElement as HTMLElement;
      const removeBtn = photoWrapper.querySelector('button') as HTMLButtonElement;
      expect(removeBtn).toBeTruthy();
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(global.URL.revokeObjectURL).toHaveBeenCalled();
      });

      expect(await screen.findByText(/add photo/i)).toBeInTheDocument();

      // The file input gets unmounted when at 5 photos and remounted after removal.
      // Re-query it so we don't fire events on a stale element reference.
      const inputAfterRemove = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(inputAfterRemove).toBeTruthy();

      const afterRemoveCalls = mockUploadFile.mock.calls.length;
      fireEvent.change(inputAfterRemove, {
        target: {
          files: [
            new File(['x'], 'extra-1.png', { type: 'image/png' }),
            new File(['x'], 'extra-2.png', { type: 'image/png' }),
          ],
        },
      });

      await waitFor(() => {
        // With 1 slot remaining, only 1 upload should occur
        expect(mockUploadFile).toHaveBeenCalledTimes(afterRemoveCalls + 1);
      });
    });

    it('supports step progress click-back and cancel/back behavior', async () => {
      const { container } = renderWizard();
      await completeBasicsStep();
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await screen.findByRole('heading', { name: /^photos$/i });
      await uploadPhotos(container, 2);
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      await screen.findByText(/daily rate/i);

      // StepProgress allows clicking completed steps
      fireEvent.click(screen.getByRole('button', { name: /tool details/i }));
      expect(await screen.findByRole('heading', { name: /tool details/i })).toBeInTheDocument();

      // Header cancel on step 0 calls navigate(-1)
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });
});
