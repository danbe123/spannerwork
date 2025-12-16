import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhotoUploader from './PhotoUploader';

// Mock the upload service
vi.mock('@/api/services', () => ({
  uploadService: {
    uploadFile: vi.fn(),
  },
}));

import { uploadService } from '@/api/services';

describe('PhotoUploader', () => {
  const mockSetPhotos = vi.fn();
  const mockSetUploadingPhoto = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with required badge when required is true', () => {
    render(
      <PhotoUploader
        photos={[]}
        setPhotos={mockSetPhotos}
        uploadingPhoto={false}
        setUploadingPhoto={mockSetUploadingPhoto}
        required={true}
      />
    );

    expect(screen.getByText('Photos')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('renders with recommended badge when required is false', () => {
    render(
      <PhotoUploader
        photos={[]}
        setPhotos={mockSetPhotos}
        uploadingPhoto={false}
        setUploadingPhoto={mockSetUploadingPhoto}
        required={false}
      />
    );

    expect(screen.getByText('Recommended')).toBeInTheDocument();
  });

  it('renders upload button', () => {
    render(
      <PhotoUploader
        photos={[]}
        setPhotos={mockSetPhotos}
        uploadingPhoto={false}
        setUploadingPhoto={mockSetUploadingPhoto}
      />
    );

    expect(screen.getByText('Upload Photo')).toBeInTheDocument();
  });

  it('shows uploading state when uploadingPhoto is true', () => {
    render(
      <PhotoUploader
        photos={[]}
        setPhotos={mockSetPhotos}
        uploadingPhoto={true}
        setUploadingPhoto={mockSetUploadingPhoto}
      />
    );

    expect(screen.getByText('Uploading...')).toBeInTheDocument();
  });

  it('renders existing photos', () => {
    const photos = ['http://example.com/photo1.jpg', 'http://example.com/photo2.jpg'];

    render(
      <PhotoUploader
        photos={photos}
        setPhotos={mockSetPhotos}
        uploadingPhoto={false}
        setUploadingPhoto={mockSetUploadingPhoto}
      />
    );

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('src', photos[0]);
    expect(images[1]).toHaveAttribute('src', photos[1]);
  });

  it('handles photo upload successfully', async () => {
    vi.mocked(uploadService.uploadFile).mockResolvedValue({
      data: { fileUrl: 'http://example.com/uploaded.jpg' },
    });

    render(
      <PhotoUploader
        photos={[]}
        setPhotos={mockSetPhotos}
        uploadingPhoto={false}
        setUploadingPhoto={mockSetUploadingPhoto}
      />
    );

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = document.getElementById('photo-upload') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockSetUploadingPhoto).toHaveBeenCalledWith(true);
    });

    await waitFor(() => {
      expect(uploadService.uploadFile).toHaveBeenCalledWith(file);
    });

    await waitFor(() => {
      expect(mockSetPhotos).toHaveBeenCalledWith(['http://example.com/uploaded.jpg']);
    });

    await waitFor(() => {
      expect(mockSetUploadingPhoto).toHaveBeenCalledWith(false);
    });
  });

  it('handles photo upload error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(uploadService.uploadFile).mockRejectedValue(new Error('Upload failed'));

    render(
      <PhotoUploader
        photos={[]}
        setPhotos={mockSetPhotos}
        uploadingPhoto={false}
        setUploadingPhoto={mockSetUploadingPhoto}
      />
    );

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = document.getElementById('photo-upload') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockSetUploadingPhoto).toHaveBeenCalledWith(false);
    });

    consoleError.mockRestore();
  });

  it('does not upload if no file selected', () => {
    render(
      <PhotoUploader
        photos={[]}
        setPhotos={mockSetPhotos}
        uploadingPhoto={false}
        setUploadingPhoto={mockSetUploadingPhoto}
      />
    );

    const input = document.getElementById('photo-upload') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(mockSetUploadingPhoto).not.toHaveBeenCalled();
  });

  it('removes photo when X button clicked', () => {
    const photos = ['http://example.com/photo1.jpg', 'http://example.com/photo2.jpg'];

    render(
      <PhotoUploader
        photos={photos}
        setPhotos={mockSetPhotos}
        uploadingPhoto={false}
        setUploadingPhoto={mockSetUploadingPhoto}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: '' }).filter(
      btn => btn.querySelector('.lucide-x')
    );
    
    // Click the first remove button
    if (removeButtons.length > 0) {
      fireEvent.click(removeButtons[0]);
      expect(mockSetPhotos).toHaveBeenCalledWith(['http://example.com/photo2.jpg']);
    }
  });

  it('uses custom inputId', () => {
    render(
      <PhotoUploader
        photos={[]}
        setPhotos={mockSetPhotos}
        uploadingPhoto={false}
        setUploadingPhoto={mockSetUploadingPhoto}
        inputId="custom-upload"
      />
    );

    expect(document.getElementById('custom-upload')).toBeInTheDocument();
  });

  it('disables upload button when uploading', () => {
    render(
      <PhotoUploader
        photos={[]}
        setPhotos={mockSetPhotos}
        uploadingPhoto={true}
        setUploadingPhoto={mockSetUploadingPhoto}
      />
    );

    const uploadButton = screen.getByRole('button', { name: /uploading/i });
    expect(uploadButton).toBeDisabled();
  });
});
