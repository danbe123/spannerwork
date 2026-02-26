import { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { z } from 'zod';
import { sanitizeRichContent } from '../utils/sanitize.js';

// Validation schemas
const createBlogPostSchema = z.object({
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  title: z.string().min(1).max(200),
  excerpt: z.string().min(1).max(500),
  content: z.string().min(1),
  featuredImage: z.string().url().optional().nullable(),
  category: z.string().min(1).max(100),
  tags: z.array(z.string()).default([]),
  author: z.string().min(1).max(100),
  authorAvatar: z.string().url().optional().nullable(),
  readTime: z.number().int().min(1).max(60).default(5),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).default('DRAFT'),
  metaTitle: z.string().max(70).optional().nullable(),
  metaDescription: z.string().max(160).optional().nullable(),
});

const updateBlogPostSchema = createBlogPostSchema.partial();

const listBlogPostsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED', 'all']).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
});

class BlogController {
  /**
   * List all blog posts (public - only published)
   */
  async listPublished(req: Request, res: Response) {
    const { page = 1, limit = 20, category } = listBlogPostsSchema.parse(req.query);

    const where = {
      status: 'PUBLISHED' as const,
      ...(category && { category }),
    };

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          featuredImage: true,
          category: true,
          tags: true,
          author: true,
          authorAvatar: true,
          readTime: true,
          publishedAt: true,
        },
      }),
      prisma.blogPost.count({ where }),
    ]);

    return res.json({
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * Get a single blog post by slug (public - only published)
   */
  async getBySlug(req: Request, res: Response) {
    const { slug } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        featuredImage: true,
        category: true,
        tags: true,
        author: true,
        authorAvatar: true,
        readTime: true,
        publishedAt: true,
        metaTitle: true,
        metaDescription: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    // Only show published posts to public
    const isAdmin = req.user?.role === 'ADMIN';
    if (!isAdmin) {
      const fullPost = await prisma.blogPost.findUnique({
        where: { slug },
        select: { status: true },
      });
      if (fullPost?.status !== 'PUBLISHED') {
        return res.status(404).json({ error: 'Blog post not found' });
      }
    }

    return res.json({ data: post });
  }

  /**
   * List all blog posts (admin - all statuses)
   */
  async listAll(req: Request, res: Response) {
    const { page = 1, limit = 20, status, category, search } = listBlogPostsSchema.parse(req.query);

    const where = {
      ...(status && status !== 'all' && { status: status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }),
      ...(category && { category }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' as const } },
          { excerpt: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          updatedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.blogPost.count({ where }),
    ]);

    return res.json({
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * Get a single blog post by ID (admin)
   */
  async getById(req: Request, res: Response) {
    const { id } = req.params;

    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    return res.json({ data: post });
  }

  /**
   * Create a new blog post (admin)
   */
  async create(req: Request, res: Response) {
    const data = createBlogPostSchema.parse(req.body);
    const userId = req.user!.id;

    // Check if slug already exists
    const existing = await prisma.blogPost.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      return res.status(400).json({ error: 'A blog post with this slug already exists' });
    }

    // Sanitize HTML content to prevent XSS attacks
    const sanitizedContent = sanitizeRichContent(data.content);

    const post = await prisma.blogPost.create({
      data: {
        ...data,
        content: sanitizedContent,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        createdById: userId,
        updatedById: userId,
      },
    });

    logger.info('Blog post created', { postId: post.id, slug: post.slug, userId });

    return res.status(201).json({ data: post });
  }

  /**
   * Update a blog post (admin)
   */
  async update(req: Request, res: Response) {
    const { id } = req.params;
    const data = updateBlogPostSchema.parse(req.body);
    const userId = req.user!.id;

    const existing = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    // Check if new slug conflicts with another post
    if (data.slug && data.slug !== existing.slug) {
      const slugConflict = await prisma.blogPost.findUnique({
        where: { slug: data.slug },
      });
      if (slugConflict) {
        return res.status(400).json({ error: 'A blog post with this slug already exists' });
      }
    }

    // Set publishedAt when publishing for the first time
    let publishedAt = existing.publishedAt;
    if (data.status === 'PUBLISHED' && !existing.publishedAt) {
      publishedAt = new Date();
    }

    // Sanitize HTML content if provided to prevent XSS attacks
    const updateData = {
      ...data,
      ...(data.content && { content: sanitizeRichContent(data.content) }),
      publishedAt,
      updatedById: userId,
    };

    const post = await prisma.blogPost.update({
      where: { id },
      data: updateData,
    });

    logger.info('Blog post updated', { postId: post.id, slug: post.slug, userId });

    return res.json({ data: post });
  }

  /**
   * Delete a blog post (admin)
   */
  async delete(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    await prisma.blogPost.delete({
      where: { id },
    });

    logger.info('Blog post deleted', { postId: id, slug: existing.slug, userId });

    return res.status(204).send();
  }

  /**
   * Publish a blog post (admin)
   */
  async publish(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: existing.publishedAt || new Date(),
        updatedById: userId,
      },
    });

    logger.info('Blog post published', { postId: post.id, slug: post.slug, userId });

    return res.json({ data: post });
  }

  /**
   * Unpublish a blog post (admin)
   */
  async unpublish(req: Request, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;

    const existing = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        status: 'DRAFT',
        updatedById: userId,
      },
    });

    logger.info('Blog post unpublished', { postId: post.id, slug: post.slug, userId });

    return res.json({ data: post });
  }

  /**
   * Get blog categories (public)
   */
  async getCategories(_req: Request, res: Response) {
    const categories = await prisma.blogPost.findMany({
      where: { status: 'PUBLISHED' },
      select: { category: true },
      distinct: ['category'],
    });

    return res.json({
      data: categories.map(c => c.category),
    });
  }
}

export const blogController = new BlogController();
export default blogController;
