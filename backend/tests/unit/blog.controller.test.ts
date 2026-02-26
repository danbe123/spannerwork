import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';

// Mock dependencies
const mockPrisma = vi.hoisted(() => ({
  blogPost: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../src/config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { blogController } from '../../src/controllers/blog.controller.js';

describe('BlogController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  describe('listPublished', () => {
    it('should return published blog posts with pagination', async () => {
      const mockPosts = [
        { id: 'post-1', slug: 'test-post', title: 'Test Post', status: 'PUBLISHED' },
        { id: 'post-2', slug: 'another-post', title: 'Another Post', status: 'PUBLISHED' },
      ];
      mockPrisma.blogPost.findMany.mockResolvedValue(mockPosts);
      mockPrisma.blogPost.count.mockResolvedValue(2);

      mockReq = {
        query: { page: '1', limit: '20' },
      };

      await blogController.listPublished(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PUBLISHED' },
          orderBy: { publishedAt: 'desc' },
          skip: 0,
          take: 20,
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        data: mockPosts,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      });
    });

    it('should filter by category when provided', async () => {
      mockPrisma.blogPost.findMany.mockResolvedValue([]);
      mockPrisma.blogPost.count.mockResolvedValue(0);

      mockReq = {
        query: { page: '1', limit: '20', category: 'tutorials' },
      };

      await blogController.listPublished(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PUBLISHED', category: 'tutorials' },
        })
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.blogPost.findMany.mockResolvedValue([]);
      mockPrisma.blogPost.count.mockResolvedValue(50);

      mockReq = {
        query: { page: '3', limit: '10' },
      };

      await blogController.listPublished(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: {
            page: 3,
            limit: 10,
            total: 50,
            totalPages: 5,
          },
        })
      );
    });
  });

  describe('getBySlug', () => {
    it('should return a published blog post by slug', async () => {
      const mockPost = {
        id: 'post-1',
        slug: 'test-post',
        title: 'Test Post',
        content: 'Test content',
        status: 'PUBLISHED',
      };
      mockPrisma.blogPost.findUnique.mockResolvedValue(mockPost);

      mockReq = {
        params: { slug: 'test-post' },
        user: undefined,
      };

      await blogController.getBySlug(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'test-post' },
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith({ data: mockPost });
    });

    it('should return 404 when post not found', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);

      mockReq = {
        params: { slug: 'non-existent' },
        user: undefined,
      };

      await blogController.getBySlug(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Blog post not found' });
    });

    it('should return 404 for non-published post when user is not admin', async () => {
      const mockPost = {
        id: 'post-1',
        slug: 'draft-post',
        title: 'Draft Post',
        content: 'Draft content',
      };
      mockPrisma.blogPost.findUnique
        .mockResolvedValueOnce(mockPost) // First call returns post data
        .mockResolvedValueOnce({ status: 'DRAFT' }); // Second call checks status

      mockReq = {
        params: { slug: 'draft-post' },
        user: { id: 'user-123', role: 'USER' } as any,
      };

      await blogController.getBySlug(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Blog post not found' });
    });

    it('should allow admin to view non-published posts', async () => {
      const mockPost = {
        id: 'post-1',
        slug: 'draft-post',
        title: 'Draft Post',
        content: 'Draft content',
      };
      mockPrisma.blogPost.findUnique.mockResolvedValue(mockPost);

      mockReq = {
        params: { slug: 'draft-post' },
        user: { id: 'admin-123', role: 'ADMIN' } as any,
      };

      await blogController.getBySlug(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ data: mockPost });
    });
  });

  describe('listAll (admin)', () => {
    it('should return all blog posts with pagination', async () => {
      const mockPosts = [
        { id: 'post-1', slug: 'published', title: 'Published', status: 'PUBLISHED' },
        { id: 'post-2', slug: 'draft', title: 'Draft', status: 'DRAFT' },
      ];
      mockPrisma.blogPost.findMany.mockResolvedValue(mockPosts);
      mockPrisma.blogPost.count.mockResolvedValue(2);

      mockReq = {
        query: { page: '1', limit: '20' },
      };

      await blogController.listAll(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: 'desc' },
          skip: 0,
          take: 20,
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        data: mockPosts,
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
        },
      });
    });

    it('should filter by status', async () => {
      mockPrisma.blogPost.findMany.mockResolvedValue([]);
      mockPrisma.blogPost.count.mockResolvedValue(0);

      mockReq = {
        query: { page: '1', limit: '20', status: 'DRAFT' },
      };

      await blogController.listAll(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DRAFT' }),
        })
      );
    });

    it('should filter by search query', async () => {
      mockPrisma.blogPost.findMany.mockResolvedValue([]);
      mockPrisma.blogPost.count.mockResolvedValue(0);

      mockReq = {
        query: { page: '1', limit: '20', search: 'test' },
      };

      await blogController.listAll(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ title: expect.any(Object) }),
              expect.objectContaining({ excerpt: expect.any(Object) }),
            ]),
          }),
        })
      );
    });

    it('should not filter by status when "all" is provided', async () => {
      mockPrisma.blogPost.findMany.mockResolvedValue([]);
      mockPrisma.blogPost.count.mockResolvedValue(0);

      mockReq = {
        query: { page: '1', limit: '20', status: 'all' },
      };

      await blogController.listAll(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ status: expect.anything() }),
        })
      );
    });
  });

  describe('getById (admin)', () => {
    it('should return a blog post by ID', async () => {
      const mockPost = {
        id: 'post-1',
        slug: 'test-post',
        title: 'Test Post',
        status: 'DRAFT',
        createdBy: { id: 'admin-1', name: 'Admin', email: 'admin@test.com' },
        updatedBy: { id: 'admin-1', name: 'Admin', email: 'admin@test.com' },
      };
      mockPrisma.blogPost.findUnique.mockResolvedValue(mockPost);

      mockReq = {
        params: { id: 'post-1' },
      };

      await blogController.getById(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith({ data: mockPost });
    });

    it('should return 404 when post not found', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);

      mockReq = {
        params: { id: 'non-existent' },
      };

      await blogController.getById(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Blog post not found' });
    });
  });

  describe('create (admin)', () => {
    it('should create a new blog post', async () => {
      const mockPost = {
        id: 'new-post-1',
        slug: 'new-post',
        title: 'New Post',
        excerpt: 'New excerpt',
        content: 'New content',
        category: 'tutorials',
        author: 'Admin User',
        status: 'DRAFT',
      };
      mockPrisma.blogPost.findUnique.mockResolvedValue(null); // Slug doesn't exist
      mockPrisma.blogPost.create.mockResolvedValue(mockPost);

      mockReq = {
        user: { id: 'admin-123' } as any,
        body: {
          slug: 'new-post',
          title: 'New Post',
          excerpt: 'New excerpt',
          content: 'New content',
          category: 'tutorials',
          author: 'Admin User',
          status: 'DRAFT',
        },
      };

      await blogController.create(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slug: 'new-post',
            title: 'New Post',
            createdById: 'admin-123',
            updatedById: 'admin-123',
          }),
        })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({ data: mockPost });
    });

    it('should set publishedAt when status is PUBLISHED', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);
      mockPrisma.blogPost.create.mockResolvedValue({ id: 'new-post-1' });

      mockReq = {
        user: { id: 'admin-123' } as any,
        body: {
          slug: 'new-post',
          title: 'New Post',
          excerpt: 'New excerpt',
          content: 'New content',
          category: 'tutorials',
          author: 'Admin User',
          status: 'PUBLISHED',
        },
      };

      await blogController.create(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            publishedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should return 400 when slug already exists', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({ id: 'existing-post', slug: 'existing-slug' });

      mockReq = {
        user: { id: 'admin-123' } as any,
        body: {
          slug: 'existing-slug',
          title: 'New Post',
          excerpt: 'New excerpt',
          content: 'New content',
          category: 'tutorials',
          author: 'Admin User',
        },
      };

      await blogController.create(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'A blog post with this slug already exists',
      });
    });

    it('should validate required fields', async () => {
      mockReq = {
        user: { id: 'admin-123' } as any,
        body: {
          // Missing required fields
          title: 'New Post',
        },
      };

      await expect(
        blogController.create(mockReq as Request, mockRes as Response)
      ).rejects.toThrow();
    });

    it('should validate slug format', async () => {
      mockReq = {
        user: { id: 'admin-123' } as any,
        body: {
          slug: 'Invalid Slug With Spaces!',
          title: 'New Post',
          excerpt: 'New excerpt',
          content: 'New content',
          category: 'tutorials',
          author: 'Admin User',
        },
      };

      await expect(
        blogController.create(mockReq as Request, mockRes as Response)
      ).rejects.toThrow();
    });
  });

  describe('update (admin)', () => {
    it('should update a blog post', async () => {
      const existingPost = {
        id: 'post-1',
        slug: 'test-post',
        title: 'Old Title',
        publishedAt: null,
      };
      const updatedPost = {
        id: 'post-1',
        slug: 'test-post',
        title: 'New Title',
      };
      mockPrisma.blogPost.findUnique.mockResolvedValue(existingPost);
      mockPrisma.blogPost.update.mockResolvedValue(updatedPost);

      mockReq = {
        params: { id: 'post-1' },
        user: { id: 'admin-123' } as any,
        body: {
          title: 'New Title',
        },
      };

      await blogController.update(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: expect.objectContaining({
            title: 'New Title',
            updatedById: 'admin-123',
          }),
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith({ data: updatedPost });
    });

    it('should return 404 when post not found', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);

      mockReq = {
        params: { id: 'non-existent' },
        user: { id: 'admin-123' } as any,
        body: {
          title: 'New Title',
        },
      };

      await blogController.update(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Blog post not found' });
    });

    it('should return 400 when updating slug to one that already exists', async () => {
      mockPrisma.blogPost.findUnique
        .mockResolvedValueOnce({ id: 'post-1', slug: 'original-slug' }) // Existing post
        .mockResolvedValueOnce({ id: 'post-2', slug: 'taken-slug' }); // Conflicting slug

      mockReq = {
        params: { id: 'post-1' },
        user: { id: 'admin-123' } as any,
        body: {
          slug: 'taken-slug',
        },
      };

      await blogController.update(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'A blog post with this slug already exists',
      });
    });

    it('should set publishedAt when publishing for the first time', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: 'post-1',
        slug: 'test-post',
        publishedAt: null,
      });
      mockPrisma.blogPost.update.mockResolvedValue({ id: 'post-1' });

      mockReq = {
        params: { id: 'post-1' },
        user: { id: 'admin-123' } as any,
        body: {
          status: 'PUBLISHED',
        },
      };

      await blogController.update(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            publishedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should not update publishedAt if already set', async () => {
      const originalDate = new Date('2024-01-01');
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: 'post-1',
        slug: 'test-post',
        publishedAt: originalDate,
      });
      mockPrisma.blogPost.update.mockResolvedValue({ id: 'post-1' });

      mockReq = {
        params: { id: 'post-1' },
        user: { id: 'admin-123' } as any,
        body: {
          status: 'PUBLISHED',
        },
      };

      await blogController.update(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            publishedAt: originalDate,
          }),
        })
      );
    });
  });

  describe('delete (admin)', () => {
    it('should delete a blog post', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: 'post-1',
        slug: 'test-post',
      });
      mockPrisma.blogPost.delete.mockResolvedValue({ id: 'post-1' });

      mockReq = {
        params: { id: 'post-1' },
        user: { id: 'admin-123' } as any,
      };

      await blogController.delete(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.delete).toHaveBeenCalledWith({
        where: { id: 'post-1' },
      });
      expect(mockRes.status).toHaveBeenCalledWith(204);
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('should return 404 when post not found', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);

      mockReq = {
        params: { id: 'non-existent' },
        user: { id: 'admin-123' } as any,
      };

      await blogController.delete(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Blog post not found' });
    });
  });

  describe('publish (admin)', () => {
    it('should publish a blog post', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: 'post-1',
        slug: 'test-post',
        status: 'DRAFT',
        publishedAt: null,
      });
      mockPrisma.blogPost.update.mockResolvedValue({
        id: 'post-1',
        status: 'PUBLISHED',
        publishedAt: new Date(),
      });

      mockReq = {
        params: { id: 'post-1' },
        user: { id: 'admin-123' } as any,
      };

      await blogController.publish(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: expect.objectContaining({
            status: 'PUBLISHED',
            publishedAt: expect.any(Date),
            updatedById: 'admin-123',
          }),
        })
      );
    });

    it('should return 404 when post not found', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);

      mockReq = {
        params: { id: 'non-existent' },
        user: { id: 'admin-123' } as any,
      };

      await blogController.publish(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should preserve existing publishedAt date', async () => {
      const originalDate = new Date('2024-01-01');
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: 'post-1',
        slug: 'test-post',
        status: 'DRAFT',
        publishedAt: originalDate,
      });
      mockPrisma.blogPost.update.mockResolvedValue({ id: 'post-1' });

      mockReq = {
        params: { id: 'post-1' },
        user: { id: 'admin-123' } as any,
      };

      await blogController.publish(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            publishedAt: originalDate,
          }),
        })
      );
    });
  });

  describe('unpublish (admin)', () => {
    it('should unpublish a blog post', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue({
        id: 'post-1',
        slug: 'test-post',
        status: 'PUBLISHED',
      });
      mockPrisma.blogPost.update.mockResolvedValue({
        id: 'post-1',
        status: 'DRAFT',
      });

      mockReq = {
        params: { id: 'post-1' },
        user: { id: 'admin-123' } as any,
      };

      await blogController.unpublish(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'post-1' },
          data: expect.objectContaining({
            status: 'DRAFT',
            updatedById: 'admin-123',
          }),
        })
      );
    });

    it('should return 404 when post not found', async () => {
      mockPrisma.blogPost.findUnique.mockResolvedValue(null);

      mockReq = {
        params: { id: 'non-existent' },
        user: { id: 'admin-123' } as any,
      };

      await blogController.unpublish(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getCategories (public)', () => {
    it('should return unique categories from published posts', async () => {
      const mockCategories = [
        { category: 'tutorials' },
        { category: 'news' },
        { category: 'guides' },
      ];
      mockPrisma.blogPost.findMany.mockResolvedValue(mockCategories);

      mockReq = {};

      await blogController.getCategories(mockReq as Request, mockRes as Response);

      expect(mockPrisma.blogPost.findMany).toHaveBeenCalledWith({
        where: { status: 'PUBLISHED' },
        select: { category: true },
        distinct: ['category'],
      });
      expect(mockRes.json).toHaveBeenCalledWith({
        data: ['tutorials', 'news', 'guides'],
      });
    });

    it('should return empty array when no published posts', async () => {
      mockPrisma.blogPost.findMany.mockResolvedValue([]);

      mockReq = {};

      await blogController.getCategories(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({
        data: [],
      });
    });
  });
});
