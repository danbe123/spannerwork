import apiClient from '../client';

// ============================================================================
// Types
// ============================================================================

export type BlogPostStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  featuredImage: string | null;
  category: string;
  tags: string[];
  author: string;
  authorAvatar: string | null;
  readTime: number;
  status: BlogPostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metaTitle: string | null;
  metaDescription: string | null;
  createdBy?: {
    id: string;
    name: string | null;
    email: string;
  };
  updatedBy?: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  featuredImage: string | null;
  category: string;
  tags: string[];
  author: string;
  authorAvatar: string | null;
  readTime: number;
  publishedAt: string | null;
}

export interface ListBlogPostsParams {
  page?: number;
  limit?: number;
  category?: string;
}

export interface AdminListBlogPostsParams extends ListBlogPostsParams {
  status?: BlogPostStatus | 'all';
  search?: string;
}

export interface CreateBlogPostData {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  featuredImage?: string | null;
  category: string;
  tags?: string[];
  author: string;
  authorAvatar?: string | null;
  readTime?: number;
  status?: BlogPostStatus;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface UpdateBlogPostData extends Partial<CreateBlogPostData> {}

export interface PaginatedBlogResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Public Blog Service (for readers)
// ============================================================================

export const blogService = {
  /**
   * List published blog posts (public)
   */
  async listPublished(params: ListBlogPostsParams = {}): Promise<PaginatedBlogResponse<BlogPostSummary>> {
    const response = await apiClient.get<PaginatedBlogResponse<BlogPostSummary>>('/blog', { params });
    return response.data;
  },

  /**
   * Get a blog post by slug (public)
   */
  async getBySlug(slug: string): Promise<{ data: BlogPost }> {
    const response = await apiClient.get<{ data: BlogPost }>(`/blog/post/${slug}`);
    return response.data;
  },

  /**
   * Get all categories (public)
   */
  async getCategories(): Promise<{ data: string[] }> {
    const response = await apiClient.get<{ data: string[] }>('/blog/categories');
    return response.data;
  },
};

// ============================================================================
// Admin Blog Service (for content management)
// ============================================================================

export const adminBlogService = {
  /**
   * List all blog posts (admin)
   */
  async listAll(params: AdminListBlogPostsParams = {}): Promise<PaginatedBlogResponse<BlogPost>> {
    const response = await apiClient.get<PaginatedBlogResponse<BlogPost>>('/blog/admin', { params });
    return response.data;
  },

  /**
   * Get a blog post by ID (admin)
   */
  async getById(id: string): Promise<{ data: BlogPost }> {
    const response = await apiClient.get<{ data: BlogPost }>(`/blog/admin/${id}`);
    return response.data;
  },

  /**
   * Create a new blog post
   */
  async create(data: CreateBlogPostData): Promise<{ data: BlogPost }> {
    const response = await apiClient.post<{ data: BlogPost }>('/blog/admin', data);
    return response.data;
  },

  /**
   * Update a blog post
   */
  async update(id: string, data: UpdateBlogPostData): Promise<{ data: BlogPost }> {
    const response = await apiClient.put<{ data: BlogPost }>(`/blog/admin/${id}`, data);
    return response.data;
  },

  /**
   * Delete a blog post
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/blog/admin/${id}`);
  },

  /**
   * Publish a blog post
   */
  async publish(id: string): Promise<{ data: BlogPost }> {
    const response = await apiClient.post<{ data: BlogPost }>(`/blog/admin/${id}/publish`);
    return response.data;
  },

  /**
   * Unpublish a blog post
   */
  async unpublish(id: string): Promise<{ data: BlogPost }> {
    const response = await apiClient.post<{ data: BlogPost }>(`/blog/admin/${id}/unpublish`);
    return response.data;
  },
};

export default blogService;
