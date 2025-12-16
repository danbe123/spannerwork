import apiClient from '../client';

// ============================================================================
// Types
// ============================================================================

export interface UploadedFile {
  fileUrl: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
}

export interface SingleUploadResponse {
  success: boolean;
  data: UploadedFile;
}

export interface MultipleUploadResponse {
  success: boolean;
  data: {
    files: UploadedFile[];
    count: number;
    warning?: string;
    invalidFiles?: string[];
    infectedFiles?: string[];
  };
}

export interface DeleteFileResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// Service
// ============================================================================

export const uploadService = {
  /**
   * Upload a single file
   */
  async uploadFile(file: File): Promise<SingleUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<SingleUploadResponse>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  /**
   * Upload multiple files
   */
  async uploadFiles(files: File[]): Promise<MultipleUploadResponse> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await apiClient.post<MultipleUploadResponse>('/upload/multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  /**
   * Delete a file
   */
  async deleteFile(filename: string): Promise<DeleteFileResponse> {
    const response = await apiClient.delete<DeleteFileResponse>(`/upload/${filename}`);
    return response.data;
  },

  /**
   * Recover a soft-deleted file
   */
  async recoverFile(filename: string): Promise<{ success: boolean; message: string; data: { fileUrl: string } }> {
    const response = await apiClient.post<{ success: boolean; message: string; data: { fileUrl: string } }>(
      `/upload/recover/${filename}`
    );
    return response.data;
  },
};
