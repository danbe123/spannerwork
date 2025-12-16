import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PostcodeInput from './PostcodeInput';

describe('PostcodeInput', () => {
  const mockSetPostcode = vi.fn();
  const mockSetLocationError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders label and input', () => {
    render(
      <PostcodeInput
        postcode=""
        setPostcode={mockSetPostcode}
        locationError=""
        setLocationError={mockSetLocationError}
      />
    );

    expect(screen.getByLabelText(/Your Location/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., SW1A 1AA')).toBeInTheDocument();
  });

  it('displays the postcode value', () => {
    render(
      <PostcodeInput
        postcode="SW1A 1AA"
        setPostcode={mockSetPostcode}
        locationError=""
        setLocationError={mockSetLocationError}
      />
    );

    expect(screen.getByDisplayValue('SW1A 1AA')).toBeInTheDocument();
  });

  it('converts input to uppercase', () => {
    render(
      <PostcodeInput
        postcode=""
        setPostcode={mockSetPostcode}
        locationError=""
        setLocationError={mockSetLocationError}
      />
    );

    const input = screen.getByPlaceholderText('e.g., SW1A 1AA');
    fireEvent.change(input, { target: { value: 'sw1a 1aa' } });

    expect(mockSetPostcode).toHaveBeenCalledWith('SW1A 1AA');
  });

  it('clears error on change', () => {
    render(
      <PostcodeInput
        postcode=""
        setPostcode={mockSetPostcode}
        locationError="Invalid postcode"
        setLocationError={mockSetLocationError}
      />
    );

    const input = screen.getByPlaceholderText('e.g., SW1A 1AA');
    fireEvent.change(input, { target: { value: 'SW1A' } });

    expect(mockSetLocationError).toHaveBeenCalledWith('');
  });

  it('displays error message when locationError is set', () => {
    render(
      <PostcodeInput
        postcode=""
        setPostcode={mockSetPostcode}
        locationError="Invalid postcode format"
        setLocationError={mockSetLocationError}
      />
    );

    expect(screen.getByText('Invalid postcode format')).toBeInTheDocument();
  });

  it('does not display error when locationError is empty', () => {
    render(
      <PostcodeInput
        postcode=""
        setPostcode={mockSetPostcode}
        locationError=""
        setLocationError={mockSetLocationError}
      />
    );

    expect(screen.queryByText('Invalid postcode format')).not.toBeInTheDocument();
  });

  it('uses custom inputId', () => {
    render(
      <PostcodeInput
        postcode=""
        setPostcode={mockSetPostcode}
        locationError=""
        setLocationError={mockSetLocationError}
        inputId="custom-postcode"
      />
    );

    expect(document.getElementById('custom-postcode')).toBeInTheDocument();
  });

  it('uses custom helpText', () => {
    render(
      <PostcodeInput
        postcode=""
        setPostcode={mockSetPostcode}
        locationError=""
        setLocationError={mockSetLocationError}
        helpText="Custom help message"
      />
    );

    expect(screen.getByText(/Custom help message/)).toBeInTheDocument();
  });

  it('displays default helpText', () => {
    render(
      <PostcodeInput
        postcode=""
        setPostcode={mockSetPostcode}
        locationError=""
        setLocationError={mockSetLocationError}
      />
    );

    expect(screen.getByText(/Users can find listings near them/)).toBeInTheDocument();
  });

  it('has maxLength of 10', () => {
    render(
      <PostcodeInput
        postcode=""
        setPostcode={mockSetPostcode}
        locationError=""
        setLocationError={mockSetLocationError}
      />
    );

    const input = screen.getByPlaceholderText('e.g., SW1A 1AA');
    expect(input).toHaveAttribute('maxLength', '10');
  });

  it('adds error styling when error present', () => {
    render(
      <PostcodeInput
        postcode=""
        setPostcode={mockSetPostcode}
        locationError="Error"
        setLocationError={mockSetLocationError}
      />
    );

    const input = screen.getByPlaceholderText('e.g., SW1A 1AA');
    expect(input.className).toContain('border-red-500');
  });
});
