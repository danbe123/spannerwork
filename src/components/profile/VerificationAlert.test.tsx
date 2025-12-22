import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import VerificationAlert from './VerificationAlert';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('VerificationAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it('returns null when both email and phone are verified', () => {
    const { container } = renderWithRouter(
      <VerificationAlert emailVerified={true} phoneVerified={true} />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('shows alert when email is not verified', () => {
    renderWithRouter(
      <VerificationAlert emailVerified={false} phoneVerified={true} />
    );
    
    expect(screen.getByText(/Verify your email/)).toBeInTheDocument();
  });

  it('shows alert when phone is not verified', () => {
    renderWithRouter(
      <VerificationAlert emailVerified={true} phoneVerified={false} />
    );
    
    expect(screen.getByText(/Add and verify your phone/)).toBeInTheDocument();
  });

  it('shows alert when both are not verified', () => {
    renderWithRouter(
      <VerificationAlert emailVerified={false} phoneVerified={false} />
    );
    
    expect(screen.getByText(/Verify your email and phone/)).toBeInTheDocument();
  });

  it('navigates to Verification page when button clicked', () => {
    renderWithRouter(
      <VerificationAlert emailVerified={false} phoneVerified={false} />
    );
    
    fireEvent.click(screen.getByText('Manage verification'));
    expect(mockNavigate).toHaveBeenCalledWith('/verification');
  });

  it('displays trust building message', () => {
    renderWithRouter(
      <VerificationAlert emailVerified={false} phoneVerified={false} />
    );
    
    expect(screen.getByText(/Build trust by verifying your account/)).toBeInTheDocument();
  });

  it('handles undefined props as unverified', () => {
    renderWithRouter(
      <VerificationAlert />
    );
    
    expect(screen.getByText(/Verify your email and phone/)).toBeInTheDocument();
  });
});
