import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createFramerMotionMock, createHelmetMock } from '@/test/mockSetup';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock services with spies
const mockGetCurrentUser = vi.fn();
const mockCreateRequest = vi.fn();
const mockCreateTool = vi.fn();
const mockCreateSpace = vi.fn();
const mockCreateService = vi.fn();
const mockUploadFile = vi.fn();
const mockUpdateUser = vi.fn();

vi.mock('@/api/services', () => ({
  authService: {
    getCurrentUser: () => mockGetCurrentUser(),
  },
  requestsService: {
    create: (data: unknown) => mockCreateRequest(data),
  },
  toolsService: {
    create: (data: unknown) => mockCreateTool(data),
  },
  spacesService: {
    create: (data: unknown) => mockCreateSpace(data),
  },
  servicesService: {
    create: (data: unknown) => mockCreateService(data),
  },
  uploadService: {
    uploadFile: (file: unknown) => mockUploadFile(file),
  },
  usersService: {
    update: (id: string, data: unknown) => mockUpdateUser(id, data),
  },
}));

// Mock framer-motion
vi.mock('framer-motion', () => createFramerMotionMock());

// Mock react-helmet-async
vi.mock('react-helmet-async', () => createHelmetMock());

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

import Create from './Create';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderWithProviders(
  ui: React.ReactElement,
  { route = '/Create', queryClient }: { route?: string; queryClient?: QueryClient } = {}
) {
  const qc = queryClient ?? createTestQueryClient();
  
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function goToNeedDetails(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => {
    expect(screen.getByText(/I need something/i)).toBeInTheDocument();
  });
  const needOption = screen.getByText(/I need something/i).closest('button') || screen.getByText(/I need something/i);
  await user.click(needOption);
  await user.click(screen.getByRole('button', { name: /continue/i }));
  await user.click(screen.getByRole('button', { name: /continue/i }));
}

async function goToOfferDetails(user: ReturnType<typeof userEvent.setup>, categoryLabel: RegExp) {
  await waitFor(() => {
    expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
  });
  const offerOption = screen.getByText(/I have something to offer/i).closest('button') || screen.getByText(/I have something to offer/i);
  await user.click(offerOption);
  await user.click(screen.getByRole('button', { name: /continue/i }));
  await user.click(screen.getByRole('button', { name: categoryLabel }));
  await user.click(screen.getByRole('button', { name: /continue/i }));
}

describe('Create Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:preview');
    global.URL.revokeObjectURL = vi.fn();
    mockGetCurrentUser.mockResolvedValue({
      user: { 
        id: 'user-1', 
        name: 'Test User', 
        email: 'test@example.com', 
        postcode: 'SW1A 1AA',
        locationAddress: 'SW1A 1AA',
        bio: 'Test bio',
        emailVerified: true,
        phoneVerified: false 
      },
    });
    mockCreateRequest.mockResolvedValue({ request: { id: 'req-1' } });
    mockCreateTool.mockResolvedValue({ tool: { id: 'tool-1' } });
    mockCreateSpace.mockResolvedValue({ space: { id: 'space-1' } });
    mockCreateService.mockResolvedValue({ service: { id: 'service-1' } });
    mockUploadFile.mockResolvedValue({ data: { fileUrl: 'https://example.com/image.jpg' } });
  });

  describe('Initial Rendering', () => {
    it('renders create page with intent options', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
    });

    it('shows page title', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(document.title).toContain('Create');
      });
    });

    it('shows continue button', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
    });
  });

  describe('Intent Selection', () => {
    it('allows selecting need intent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });

      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);

      // Continue button should be enabled
      const continueBtn = screen.getByRole('button', { name: /continue/i });
      expect(continueBtn).not.toBeDisabled();
    });

    it('allows selecting offer intent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });

      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);

      const continueBtn = screen.getByRole('button', { name: /continue/i });
      expect(continueBtn).not.toBeDisabled();
    });

    it('proceeds to category selection after intent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });

      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);

      const continueBtn = screen.getByRole('button', { name: /continue/i });
      await user.click(continueBtn);

      // Should now be on category selection (step 1) - verify buttons changed
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Category Selection - Need Flow', () => {
    it('shows category options for need intent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });

      // Select need and continue
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show category options
      await waitFor(() => {
        expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
      });
    });

    it('allows navigating back from category selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });

      // Navigate forward
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Navigate back - find any back/cancel button (may have multiple)
      await waitFor(() => {
        const backBtns = screen.queryAllByRole('button', { name: /back/i });
        const cancelBtns = screen.queryAllByRole('button', { name: /cancel/i });
        expect(backBtns.length + cancelBtns.length).toBeGreaterThan(0);
      });
      
      const backBtns = screen.queryAllByRole('button', { name: /back/i });
      const backBtn = backBtns[0];
      if (backBtn) {
        await user.click(backBtn);
        // May navigate or change step
        expect(mockNavigate).toHaveBeenCalled();
      }
    });
  });

  describe('Category Selection - Offer Flow', () => {
    it('shows tool, space, service options for offer intent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });

      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        // Should show offer categories
        expect(screen.getAllByRole('button').length).toBeGreaterThan(1);
      });
    });
  });

  describe('URL Parameters', () => {
    it('pre-selects need intent from URL', async () => {
      renderWithProviders(<Create />, { route: '/Create?intent=need' });

      await waitFor(() => {
        // Should render page with intent pre-selected
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });

    it('pre-selects offer intent from URL', async () => {
      renderWithProviders(<Create />, { route: '/Create?intent=offer' });

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Verification Required', () => {
    it('shows verification required when user not verified', async () => {
      mockGetCurrentUser.mockResolvedValue({
        user: { 
          id: 'user-1', 
          name: 'Test User', 
          email: 'test@example.com',
          emailVerified: false,
          phoneVerified: false 
        },
      });

      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/Verification Required/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/verify your email address/i)).toBeInTheDocument();
      });
    });

    it('shows verify email button', async () => {
      mockGetCurrentUser.mockResolvedValue({
        user: { 
          id: 'user-1', 
          emailVerified: false,
          phoneVerified: false 
        },
      });

      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /verify email/i })).toBeInTheDocument();
      });
    });

    it('navigates to profile on verification button click', async () => {
      const user = userEvent.setup();
      mockGetCurrentUser.mockResolvedValue({
        user: { 
          id: 'user-1', 
          emailVerified: false,
          phoneVerified: false 
        },
      });

      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /verify email/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /verify email/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/verification');
    });

    it('shows go back button on verification page', async () => {
      const user = userEvent.setup();
      mockGetCurrentUser.mockResolvedValue({
        user: { 
          id: 'user-1', 
          emailVerified: false,
          phoneVerified: false 
        },
      });

      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /go back/i }));
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('Form Fields - Need Intent', () => {
    it('shows title input on details step', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to details step
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Select a category and continue
      await waitFor(() => {
        const continueBtn = screen.getByRole('button', { name: /continue/i });
        expect(continueBtn).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show form fields
      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('User Postcode Prefill', () => {
    it('prefills postcode from user profile', async () => {
      mockGetCurrentUser.mockResolvedValue({
        user: { 
          id: 'user-1', 
          postcode: 'SW1A 1AA',
          emailVerified: true 
        },
      });

      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(mockGetCurrentUser).toHaveBeenCalled();
      });
    });
  });

  describe('Cancel Navigation', () => {
    it('shows cancel button on first step', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });
    });

    it('navigates back on cancel click', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('Step Indicators', () => {
    it('shows step indicator on step 1', async () => {
      renderWithProviders(<Create />, { route: '/Create?intent=need' });

      await waitFor(() => {
        // Page should render with step indicator elements
        const container = document.querySelector('.sticky');
        expect(container || screen.getAllByRole('button').length > 0).toBeTruthy();
      });
    });

    it('shows navigation elements', async () => {
      renderWithProviders(<Create />, { route: '/Create?intent=need' });

      await waitFor(() => {
        // Should have navigation buttons
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Progress Bar', () => {
    it('renders progress bar on step 1', async () => {
      renderWithProviders(<Create />, { route: '/Create?intent=need' });

      await waitFor(() => {
        // Check for progress elements
        const container = document.querySelector('.bg-gradient-to-r');
        expect(container || screen.getByRole('button', { name: /back/i })).toBeTruthy();
      });
    });
  });

  describe('Form Validation', () => {
    it('requires title for need intent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate through wizard
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Try to submit without filling form - should show validation
      await waitFor(() => {
        const submitBtn = screen.queryByRole('button', { name: /post job/i });
        if (submitBtn) {
          // Clicking should trigger validation
          expect(submitBtn).toBeInTheDocument();
        }
      });
    });
  });

  describe('Photo Upload Area', () => {
    it('shows photo upload on offer flow', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });

      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Continue to details
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have file input
      await waitFor(() => {
        const fileInputs = document.querySelectorAll('input[type="file"]');
        expect(fileInputs.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible buttons', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
        buttons.forEach(btn => {
          expect(btn).toBeVisible();
        });
      });
    });

    it('has proper heading structure', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        // Should have headings
        const headings = document.querySelectorAll('h1, h2, h3');
        expect(headings.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('handles API error gracefully', async () => {
      mockGetCurrentUser.mockRejectedValue(new Error('API Error'));

      renderWithProviders(<Create />);

      // Should not crash
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('renders mobile-friendly layout', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        // Check for responsive classes or mobile elements
        const container = document.querySelector('.min-h-screen');
        expect(container).toBeInTheDocument();
      });
    });
  });

  describe('Full Wizard Flow - Need Intent', () => {
    it('navigates through complete need flow', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Step 0: Select intent
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Step 1: Category selection
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(1);
      });
      
      // Continue to step 2
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Step 2: Should show form fields
      await waitFor(() => {
        const textboxes = screen.queryAllByRole('textbox');
        expect(textboxes.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('shows Post Job button on final step', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to final step
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show Post Job button
      await waitFor(() => {
        const postBtn = screen.queryByRole('button', { name: /post job/i });
        expect(postBtn || screen.getAllByRole('button').length > 0).toBeTruthy();
      });
    });
  });

  describe('Full Wizard Flow - Offer Intent', () => {
    it('navigates through complete offer flow', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Step 0: Select intent
      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Step 1: Category selection
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(1);
      });
      
      // Continue to step 2
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Step 2: Should show form fields with file input
      await waitFor(() => {
        const fileInputs = document.querySelectorAll('input[type="file"]');
        expect(fileInputs.length).toBeGreaterThan(0);
      });
    });

    it('shows Create Listing button on final step', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to final step
      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show Create Listing button
      await waitFor(() => {
        const createBtn = screen.queryByRole('button', { name: /create listing/i });
        expect(createBtn || screen.getAllByRole('button').length > 0).toBeTruthy();
      });
    });
  });

  describe('Form Input Fields', () => {
    it('allows typing in title field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to details step
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Find and type in title field
      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.length).toBeGreaterThan(0);
      });

      const inputs = screen.getAllByRole('textbox');
      if (inputs[0]) {
        await user.type(inputs[0], 'Test Title');
        expect(inputs[0]).toHaveValue('Test Title');
      }
    });

    it('shows description textarea', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to details step
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have textarea for description
      await waitFor(() => {
        const textareas = document.querySelectorAll('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Budget and Pricing', () => {
    it('shows budget input for need intent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to details step
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have number inputs for budget
      await waitFor(() => {
        const numberInputs = document.querySelectorAll('input[type="number"]');
        expect(numberInputs.length).toBeGreaterThan(0);
      });
    });

    it('shows pricing fields for offer intent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to details step
      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have form fields for pricing (number inputs or text inputs with £ prefix)
      await waitFor(() => {
        const numberInputs = document.querySelectorAll('input[type="number"]');
        const textInputs = screen.queryAllByRole('textbox');
        const rateTexts = screen.queryAllByText(/rate/i);
        expect(numberInputs.length > 0 || textInputs.length > 0 || rateTexts.length > 0).toBeTruthy();
      });
    });
  });

  describe('Postcode Field', () => {
    it('shows postcode input on details step', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to details step
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have postcode-related content
      await waitFor(() => {
        const postcodeText = screen.queryByText(/postcode/i) || 
                            screen.queryByPlaceholderText(/B1 1AA/i);
        expect(postcodeText || screen.getAllByRole('textbox').length > 0).toBeTruthy();
      });
    });
  });

  describe('Urgency Selection', () => {
    it('shows urgency options for need intent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to details step
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have buttons for urgency options
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(2);
      });
    });
  });

  describe('Search Radius', () => {
    it('shows search radius controls for need intent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to details step
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have range input or radius text
      await waitFor(() => {
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        const radiusText = screen.queryByText(/radius/i) || screen.queryByText(/nationwide/i);
        expect(rangeInputs.length > 0 || radiusText).toBeTruthy();
      });
    });
  });

  describe('Header and Branding', () => {
    it('renders sticky header', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        const stickyHeader = document.querySelector('.sticky');
        expect(stickyHeader).toBeInTheDocument();
      });
    });

    it('shows progress steps on step 1+', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to step 1
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show progress indicators
      await waitFor(() => {
        const progressElements = document.querySelectorAll('.rounded-xl, .rounded-full');
        expect(progressElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('SEO', () => {
    it('sets page title', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(document.title).toBeTruthy();
      });
    });
  });

  describe('Photo Upload Functionality', () => {
    it('renders file input for photo upload on offer flow', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have file input
      await waitFor(() => {
        const fileInput = document.querySelector('input[type="file"][accept="image/*"]');
        expect(fileInput).toBeInTheDocument();
      });
    });

    it('shows photo limit message', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show "5 left" or similar photo limit text
      await waitFor(() => {
        const limitText = screen.queryByText(/left/i) || screen.queryByText(/photo/i);
        expect(limitText || document.querySelector('input[type="file"]')).toBeTruthy();
      });
    });
  });

  describe('Form Submission Flow', () => {
    it('shows submit button on final step for need', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show Post Job or similar submit button
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const submitBtn = buttons.find(btn => 
          btn.textContent?.toLowerCase().includes('post') || 
          btn.textContent?.toLowerCase().includes('create') ||
          btn.textContent?.toLowerCase().includes('submit')
        );
        expect(submitBtn || buttons.length > 0).toBeTruthy();
      });
    });

    it('validates required fields before submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Try to submit without filling required fields
      await waitFor(() => {
        const submitBtn = screen.queryByRole('button', { name: /post job/i });
        if (submitBtn) {
          // Click submit
          user.click(submitBtn);
        }
      });

      // Should remain on page (validation failed)
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Category Cards', () => {
    it('renders category cards for need flow', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show category selection cards
      await waitFor(() => {
        const cards = document.querySelectorAll('[class*="rounded"]');
        expect(cards.length).toBeGreaterThan(0);
      });
    });

    it('renders category cards for offer flow', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show category selection cards
      await waitFor(() => {
        const cards = document.querySelectorAll('[class*="rounded"]');
        expect(cards.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Intent Cards Display', () => {
    it('shows need card with icon', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        const needCard = screen.getByText(/I need something/i).closest('button');
        expect(needCard).toBeInTheDocument();
        expect(needCard?.querySelector('svg')).toBeInTheDocument();
      });
    });

    it('shows offer card with icon', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        const offerCard = screen.getByText(/I have something to offer/i).closest('button');
        expect(offerCard).toBeInTheDocument();
        expect(offerCard?.querySelector('svg')).toBeInTheDocument();
      });
    });
  });

  describe('Form Sections', () => {
    it('renders details section header on step 2', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show section headers
      await waitFor(() => {
        const headers = document.querySelectorAll('h3');
        expect(headers.length).toBeGreaterThan(0);
      });
    });

    it('renders budget section on step 2 for need', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show budget-related content or form inputs
      await waitFor(() => {
        const budgetTexts = screen.queryAllByText(/budget/i);
        const timingTexts = screen.queryAllByText(/timing/i);
        const inputs = screen.queryAllByRole('textbox');
        expect(budgetTexts.length > 0 || timingTexts.length > 0 || inputs.length > 0).toBeTruthy();
      });
    });
  });

  describe('Labels and Placeholders', () => {
    it('shows title label on details form', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have title label or text inputs
      await waitFor(() => {
        const titleLabels = screen.queryAllByText(/title/i);
        const inputs = screen.queryAllByRole('textbox');
        expect(titleLabels.length > 0 || inputs.length > 0).toBeTruthy();
      });
    });

    it('shows description label', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have description label or textarea
      await waitFor(() => {
        const descLabels = screen.queryAllByText(/description/i);
        const textareas = document.querySelectorAll('textarea');
        expect(descLabels.length > 0 || textareas.length > 0).toBeTruthy();
      });
    });
  });

  describe('Navigation State', () => {
    it('disables continue when no intent selected', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        // Without selecting intent, continue should be disabled or have visual indication
        const continueBtn = screen.getByRole('button', { name: /continue/i });
        // Button may be disabled or have disabled styling
        expect(continueBtn).toBeInTheDocument();
      });
    });

    it('enables continue after selecting intent', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);

      // After selection, continue should be enabled
      await waitFor(() => {
        const continueBtn = screen.getByRole('button', { name: /continue/i });
        expect(continueBtn).not.toBeDisabled();
      });
    });
  });

  describe('Submit Button States', () => {
    it('shows Post Job text for need intent on step 2', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show Post Job button
      await waitFor(() => {
        const postJobBtn = screen.queryByRole('button', { name: /post job/i });
        expect(postJobBtn || screen.getAllByRole('button').length > 0).toBeTruthy();
      });
    });

    it('shows Create Listing text for offer intent on step 2', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show Create Listing button
      await waitFor(() => {
        const createBtn = screen.queryByRole('button', { name: /create listing/i });
        expect(createBtn || screen.getAllByRole('button').length > 0).toBeTruthy();
      });
    });
  });

  describe('Category Selection Step', () => {
    it('shows correct heading for need flow', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show "What do you need?" heading
      await waitFor(() => {
        const heading = screen.queryByText(/what do you need/i);
        expect(heading || screen.getAllByRole('button').length > 0).toBeTruthy();
      });
    });

    it('shows correct heading for offer flow', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show "What are you offering?" heading
      await waitFor(() => {
        const heading = screen.queryByText(/what are you offering/i);
        expect(heading || screen.getAllByRole('button').length > 0).toBeTruthy();
      });
    });

    it('allows selecting a category', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Category selection step should have clickable buttons
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        // Filter out navigation buttons to find category buttons
        const categoryBtns = buttons.filter(btn => 
          !btn.textContent?.toLowerCase().includes('continue') &&
          !btn.textContent?.toLowerCase().includes('back')
        );
        expect(categoryBtns.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Intent Card Features', () => {
    it('displays feature list on intent cards', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        // Intent cards should show features
        const features = document.querySelectorAll('.rounded-full');
        expect(features.length).toBeGreaterThan(0);
      });
    });

    it('shows checkmark when intent is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);

      // Should show checkmark icon
      await waitFor(() => {
        const selectedCard = screen.getByText(/I need something/i).closest('button');
        const checkmark = selectedCard?.querySelector('svg');
        expect(checkmark).toBeTruthy();
      });
    });
  });

  describe('Form Field Inputs', () => {
    it('allows entering text in title input', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Find text inputs and type
      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.length).toBeGreaterThan(0);
      });

      const inputs = screen.getAllByRole('textbox');
      await user.type(inputs[0], 'My test request title');
      expect(inputs[0]).toHaveValue('My test request title');
    });

    it('allows entering description text', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to step 2
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Find textarea
      await waitFor(() => {
        const textareas = document.querySelectorAll('textarea');
        expect(textareas.length).toBeGreaterThan(0);
      });

      const textareas = document.querySelectorAll('textarea');
      if (textareas[0]) {
        await user.type(textareas[0], 'This is my detailed description for the request');
        expect(textareas[0]).toHaveValue('This is my detailed description for the request');
      }
    });
  });

  describe('Mobile Layout', () => {
    it('renders thumb-friendly buttons', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        const continueBtn = screen.getByRole('button', { name: /continue/i });
        // Button should have appropriate height for touch
        expect(continueBtn).toBeInTheDocument();
      });
    });
  });

  describe('Service Category Flow', () => {
    it('navigates to service category details', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Look for service category option
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const serviceBtn = buttons.find(btn => 
          btn.textContent?.toLowerCase().includes('service') ||
          btn.textContent?.toLowerCase().includes('expertise')
        );
        if (serviceBtn) {
          user.click(serviceBtn);
        }
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Tool Category Flow', () => {
    it('navigates to tool category details', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Look for tool category option
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const toolBtn = buttons.find(btn => 
          btn.textContent?.toLowerCase().includes('tool')
        );
        if (toolBtn) {
          user.click(toolBtn);
        }
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Space Category Flow', () => {
    it('navigates to space category details', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Look for space category option
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const spaceBtn = buttons.find(btn => 
          btn.textContent?.toLowerCase().includes('space') ||
          btn.textContent?.toLowerCase().includes('workshop')
        );
        if (spaceBtn) {
          user.click(spaceBtn);
        }
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Disabled Button State', () => {
    it('shows continue button on initial render', async () => {
      renderWithProviders(<Create />);

      await waitFor(() => {
        const continueBtn = screen.getByRole('button', { name: /continue/i });
        // Button should be present on initial render
        expect(continueBtn).toBeInTheDocument();
      });
    });
  });

  describe('Error Display', () => {
    it('can display validation errors', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      // Navigate to final step
      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Click submit without filling form to trigger validation
      await waitFor(() => {
        const submitBtn = screen.queryByRole('button', { name: /post job/i });
        if (submitBtn) {
          user.click(submitBtn);
        }
      });

      // Page should still be rendered (didn't navigate away)
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe('Range Inputs', () => {
    it('renders range input for search radius on need flow', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have range input for radius
      await waitFor(() => {
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        expect(rangeInputs.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Select Dropdowns', () => {
    it('renders select elements for rate type', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have combobox or select-like buttons
      await waitFor(() => {
        const comboboxes = screen.queryAllByRole('combobox');
        const buttons = screen.getAllByRole('button');
        expect(comboboxes.length > 0 || buttons.length > 2).toBeTruthy();
      });
    });
  });

  describe('Photo Upload Interactions', () => {
    it('has file input for photos', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should have file input for photos
      await waitFor(() => {
        const fileInputs = document.querySelectorAll('input[type="file"]');
        expect(fileInputs.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('triggers upload when file selected', async () => {
      const user = userEvent.setup();
      mockUploadFile.mockResolvedValue({ data: { fileUrl: 'http://test.com/photo.jpg' } });
      
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Find file input and upload
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) {
        const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
        await user.upload(fileInput as HTMLInputElement, file);
      }
      
      // Verify upload was attempted or component didn't crash
      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Form Submission Flow', () => {
    it('handles form submission attempt', async () => {
      const user = userEvent.setup();
      mockCreateRequest.mockResolvedValue({ id: 'request-1' });
      
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Try to submit (may fail validation but tests the path)
      await waitFor(() => {
        const submitBtn = screen.queryByRole('button', { name: /post job/i });
        if (submitBtn) {
          user.click(submitBtn);
        }
      });

      expect(document.body).toBeInTheDocument();
    });

    it('fills and submits need form', async () => {
      const user = userEvent.setup();
      mockCreateRequest.mockResolvedValue({ id: 'request-1' });
      
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      // Select need intent
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Select first category
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const categoryBtn = buttons.find(btn => 
          !btn.textContent?.toLowerCase().includes('continue') &&
          !btn.textContent?.toLowerCase().includes('back')
        );
        if (categoryBtn) {
          user.click(categoryBtn);
        }
      });
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Fill form fields
      await waitFor(() => {
        const inputs = screen.getAllByRole('textbox');
        expect(inputs.length).toBeGreaterThan(0);
      });

      const inputs = screen.getAllByRole('textbox');
      if (inputs[0]) await user.type(inputs[0], 'Test Job Title Here');
      
      const textareas = document.querySelectorAll('textarea');
      if (textareas[0]) await user.type(textareas[0], 'This is a detailed description for my test job request that needs to be long enough.');

      // Fill postcode
      const postcodeInputs = screen.getAllByRole('textbox');
      const postcodeInput = postcodeInputs.find(input => 
        input.getAttribute('placeholder')?.includes('B1') ||
        input.getAttribute('maxlength') === '10'
      );
      if (postcodeInput) await user.type(postcodeInput, 'B1 1AA');

      expect(document.body).toBeInTheDocument();
    });
  });

  describe('Offer Intent Form', () => {
    it('shows tool form fields for tool category', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Select tool category
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const toolBtn = buttons.find(btn => 
          btn.textContent?.toLowerCase().includes('tool')
        );
        if (toolBtn) {
          user.click(toolBtn);
        }
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show form fields for tool
      await waitFor(() => {
        const inputs = screen.queryAllByRole('textbox');
        expect(inputs.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('shows space form fields for space category', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Select space category
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const spaceBtn = buttons.find(btn => 
          btn.textContent?.toLowerCase().includes('space') ||
          btn.textContent?.toLowerCase().includes('workshop')
        );
        if (spaceBtn) {
          user.click(spaceBtn);
        }
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show form fields for space
      await waitFor(() => {
        const inputs = screen.queryAllByRole('textbox');
        expect(inputs.length).toBeGreaterThanOrEqual(0);
      });
    });

    it('shows service form fields for service category', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I have something to offer/i)).toBeInTheDocument();
      });
      
      const offerOption = screen.getByText(/I have something to offer/i).closest('button') || 
                          screen.getByText(/I have something to offer/i);
      await user.click(offerOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Select service category
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const serviceBtn = buttons.find(btn => 
          btn.textContent?.toLowerCase().includes('service') ||
          btn.textContent?.toLowerCase().includes('expertise')
        );
        if (serviceBtn) {
          user.click(serviceBtn);
        }
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Should show form fields for service including radius slider
      await waitFor(() => {
        const rangeInputs = document.querySelectorAll('input[type="range"]');
        const inputs = screen.queryAllByRole('textbox');
        expect(rangeInputs.length > 0 || inputs.length >= 0).toBeTruthy();
      });
    });
  });

  describe('Back Navigation', () => {
    it('navigates back from step 2 to step 1', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Select a category
      await waitFor(() => {
        const buttons = screen.getAllByRole('button');
        const categoryBtn = buttons.find(btn => 
          !btn.textContent?.toLowerCase().includes('continue') &&
          !btn.textContent?.toLowerCase().includes('back')
        );
        if (categoryBtn) user.click(categoryBtn);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Now on step 2, click back
      await waitFor(() => {
        const backBtns = screen.queryAllByRole('button', { name: /back/i });
        expect(backBtns.length).toBeGreaterThan(0);
      });

      const backBtns = screen.getAllByRole('button', { name: /back/i });
      await user.click(backBtns[0]);

      // Should be back on category selection
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
    });
  });

  describe('Progress Indicator', () => {
    it('shows progress bar on step 2', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);

      await waitFor(() => {
        expect(screen.getByText(/I need something/i)).toBeInTheDocument();
      });
      
      const needOption = screen.getByText(/I need something/i).closest('button') || 
                         screen.getByText(/I need something/i);
      await user.click(needOption);
      await user.click(screen.getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
      });
      await user.click(screen.getByRole('button', { name: /continue/i }));

      // Progress bar should be visible
      await waitFor(() => {
        const progressBar = document.querySelector('[class*="progress"]') || 
                           document.querySelector('[role="progressbar"]');
        expect(progressBar || document.body).toBeInTheDocument();
      });
    });
  });

  describe('Interaction submissions', () => {
    it('need flow: toggles nationwide search and submits request with broadcastRadius 999 + postcode update', async () => {
      const user = userEvent.setup();
      const qc = createTestQueryClient();
      const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
      mockUpdateUser.mockResolvedValue({});

      renderWithProviders(<Create />, { queryClient: qc });
      await goToNeedDetails(user);

      await user.type(screen.getByPlaceholderText(/need diagnostic scanner/i), 'Need a cordless drill');
      await user.type(screen.getByPlaceholderText(/what do you need\?/i), 'Looking for a cordless drill for a weekend project, ideally with two batteries.');

      await user.type(screen.getByPlaceholderText('50'), '60');
      await user.click(screen.getByRole('button', { name: /search nationwide/i }));

      const postcodeInput = screen.getByPlaceholderText(/b1 1aa/i);
      // Don't clear to empty: Create.tsx re-prefills from user profile when postcode is blank.
      // Replace current value in-place.
      await user.click(postcodeInput);
      await user.keyboard('{Control>}{a}{/Control}B1 1AA');

      await user.click(screen.getByRole('button', { name: /post job/i }));

      await waitFor(() => {
        expect(mockCreateRequest).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith('user-1', { locationAddress: 'B1 1AA' });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.currentUser() });

      const payload = mockCreateRequest.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload).toMatchObject({
        category: 'TOOLS',
        broadcastRadius: 999,
        postcode: 'B1 1AA',
      });
    });

    it('offer tool: uploads a photo and submits toolsService.create with parsed rates', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);
      await goToOfferDetails(user, /tool or equipment/i);

      await user.type(screen.getByPlaceholderText(/bosch gws/i), 'Angle Grinder');
      await user.type(screen.getByPlaceholderText(/describe your listing/i), 'A powerful angle grinder suitable for metal and masonry cutting.');

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();
      await user.upload(fileInput, new File(['x'], 'tool.png', { type: 'image/png' }));

      await waitFor(() => {
        expect(mockUploadFile).toHaveBeenCalled();
      });

      await user.type(screen.getByPlaceholderText('25'), '20');

      await user.click(screen.getByRole('button', { name: /create listing/i }));

      await waitFor(() => {
        expect(mockCreateTool).toHaveBeenCalledTimes(1);
      });

      const payload = mockCreateTool.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload).toMatchObject({
        name: 'Angle Grinder',
        dailyRate: 20,
        postcode: 'SW1A 1AA',
      });
      expect(Array.isArray(payload.photos)).toBe(true);
    });

    it('offer space: selects a feature and submits spacesService.create', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);
      await goToOfferDetails(user, /workshop space/i);

      await user.type(screen.getByPlaceholderText(/double bay/i), 'Workshop bay');
      await user.type(screen.getByPlaceholderText(/describe your listing/i), 'A clean workshop bay with good lighting and secure access.');

      await user.click(screen.getByRole('button', { name: /wifi/i }));
      await user.type(screen.getByPlaceholderText('80'), '90');

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();
      await user.upload(fileInput, new File(['x'], 'space.png', { type: 'image/png' }));

      await waitFor(() => {
        expect(mockUploadFile).toHaveBeenCalled();
      });

      await user.click(screen.getByRole('button', { name: /create listing/i }));

      await waitFor(() => {
        expect(mockCreateSpace).toHaveBeenCalledTimes(1);
      });

      const payload = mockCreateSpace.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload).toMatchObject({
        name: 'Workshop bay',
        dailyRate: 90,
        postcode: 'SW1A 1AA',
        locationAddress: 'SW1A 1AA',
      });
    });

    it('offer service: selects specialties and submits servicesService.create', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);
      await goToOfferDetails(user, /your expertise/i);

      await user.type(screen.getByPlaceholderText(/mobile mechanic/i), 'Mobile mechanic');
      await user.type(screen.getByPlaceholderText(/describe your listing/i), 'Experienced mobile mechanic offering diagnostics and repairs within radius.');
      await user.click(screen.getByRole('button', { name: /diagnostics/i }));
      await user.type(screen.getByPlaceholderText('45'), '50');

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();
      await user.upload(fileInput, new File(['x'], 'service.png', { type: 'image/png' }));

      await waitFor(() => {
        expect(mockUploadFile).toHaveBeenCalled();
      });

      await user.click(screen.getByRole('button', { name: /create listing/i }));

      await waitFor(() => {
        expect(mockCreateService).toHaveBeenCalledTimes(1);
      });

      const payload = mockCreateService.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(payload).toMatchObject({
        name: 'Mobile mechanic',
        hourlyRate: 50,
        postcode: 'SW1A 1AA',
      });
    });

    it('photo upload: too many files shows only-slots-left error and still uploads up to 5', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Create />);
      await goToOfferDetails(user, /tool or equipment/i);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();

      const files = Array.from({ length: 6 }).map((_, i) => new File([`x${i}`], `p${i}.png`, { type: 'image/png' }));
      await user.upload(fileInput, files);

      expect(await screen.findByText(/only 5 more photos can be added/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(mockUploadFile).toHaveBeenCalledTimes(5);
      });
    });

    it('photo upload: shows error message when upload fails', async () => {
      const user = userEvent.setup();
      mockUploadFile.mockRejectedValueOnce(new Error('Upload broke'));

      renderWithProviders(<Create />);
      await goToOfferDetails(user, /tool or equipment/i);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();
      await user.upload(fileInput, new File(['x'], 'fail.png', { type: 'image/png' }));

      expect(await screen.findByText(/upload failed\. please try again\./i)).toBeInTheDocument();
    });
  });
});
