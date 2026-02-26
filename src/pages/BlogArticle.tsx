import { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { blogService } from "@/api/services";
import { queryKeys } from "@/lib/queryKeys";
import SEO from "@/components/SEO";
import MarketingFooter from "@/components/MarketingFooter";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import Breadcrumbs from "@/components/Breadcrumbs";
import {
  Calendar,
  Clock,
  User,
  ArrowLeft,
  ArrowRight,
  Share2,
  FileText,
  AlertCircle,
  Wrench,
  Home
} from "lucide-react";
import { toast } from "sonner";

function DesktopNav() {
  return (
    <nav className="hidden lg:block bg-white border-b border-gray-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl flex items-center justify-center shadow-lg">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-xl text-gray-900 group-hover:text-brand-800 transition-colors">SpannerWork</h2>
            <p className="text-xs text-brand-800 font-semibold">Tools. Skills. Space.</p>
          </div>
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/how-it-works" className="font-medium text-gray-700 hover:text-brand-800 transition-colors">How It Works</Link>
          <Link to="/pricing" className="font-medium text-gray-700 hover:text-brand-800 transition-colors">Pricing</Link>
          <Link to="/blog" className="font-medium text-brand-800">Blog</Link>
          <Link to="/resources" className="font-medium text-gray-700 hover:text-brand-800 transition-colors">Resources</Link>
          <Button asChild className="bg-brand-800 hover:bg-brand-900">
            <Link to="/feed">
              <Home className="w-4 h-4 mr-2" />
              Go to App
            </Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}

export default function BlogArticle() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const articleRef = useRef<HTMLElement>(null);
  const [readProgress, setReadProgress] = useState(0);

  const { data: postData, isLoading, error } = useQuery({
    queryKey: queryKeys.blogPost(slug || ''),
    queryFn: () => blogService.getBySlug(slug || ''),
    enabled: !!slug,
  });

  // Fetch related posts
  const { data: allPostsData } = useQuery({
    queryKey: queryKeys.blogPosts(),
    queryFn: () => blogService.listPublished({ limit: 50 }),
    enabled: !!postData?.data,
  });

  const post = postData?.data;

  // Calculate related posts (same category, excluding current)
  const relatedPosts = allPostsData?.data
    ?.filter(p => p.slug !== slug && (p.category === post?.category || post?.tags?.some(t => p.tags?.includes(t))))
    .slice(0, 3) || [];

  // Reading progress indicator
  useEffect(() => {
    const handleScroll = () => {
      if (!articleRef.current) return;

      const articleTop = articleRef.current.offsetTop;
      const articleHeight = articleRef.current.offsetHeight;
      const windowHeight = window.innerHeight;
      const scrollY = window.scrollY;

      // Calculate progress
      const start = articleTop - windowHeight / 2;
      const end = articleTop + articleHeight - windowHeight;
      const progress = Math.min(100, Math.max(0, ((scrollY - start) / (end - start)) * 100));

      setReadProgress(progress);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [post]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post?.title || 'SpannerWork Blog',
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <DocsMobileHeader />
        <DesktopNav />
        <SEO title="Loading... | SpannerWork Blog" description="Loading blog article..." />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Skeleton className="h-6 w-48 mb-8" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !post) {
    return (
      <div className="min-h-screen bg-white">
        <DocsMobileHeader />
        <DesktopNav />
        <SEO title="Article Not Found | SpannerWork Blog" description="The requested blog article could not be found." />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Article Not Found</h1>
          <p className="text-gray-600 mb-8">
            The blog article you're looking for doesn't exist or has been removed.
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={() => navigate(-1)} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button asChild className="bg-brand-800 hover:bg-brand-900">
              <Link to="/blog">Browse All Articles</Link>
            </Button>
          </div>
        </div>
        <MarketingFooter />
      </div>
    );
  }

  const publishedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : null;

  // Generate BlogPosting JSON-LD schema
  const blogPostingSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt,
    "author": {
      "@type": "Person",
      "name": post.author
    },
    "datePublished": post.publishedAt,
    "dateModified": post.updatedAt || post.publishedAt,
    "image": post.featuredImage || "https://spannerwork.com/og-image.png",
    "publisher": {
      "@type": "Organization",
      "name": "SpannerWork",
      "logo": {
        "@type": "ImageObject",
        "url": "https://spannerwork.com/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://spannerwork.com/blog/${post.slug}`
    },
    "keywords": post.tags?.join(", ") || post.category,
    "articleSection": post.category
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://spannerwork.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Blog",
        "item": "https://spannerwork.com/blog"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": post.category,
        "item": `https://spannerwork.com/blog?category=${post.category?.toLowerCase()}`
      },
      {
        "@type": "ListItem",
        "position": 4,
        "name": post.title
      }
    ]
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gray-200">
        <div
          className="h-full bg-gradient-to-r from-brand-800 to-[#FFC107] transition-all duration-150"
          style={{ width: `${readProgress}%` }}
        />
      </div>

      <DocsMobileHeader />
      <DesktopNav />
      <SEO
        title={post.metaTitle || `${post.title} | SpannerWork Blog`}
        description={post.metaDescription || post.excerpt}
        keywords={post.tags?.join(', ') || post.category}
        type="article"
        image={post.featuredImage ?? undefined}
      />

      {/* JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Featured Image Hero (if available) */}
      {post.featuredImage && (
        <div className="relative h-64 md:h-96 overflow-hidden">
          <img
            src={post.featuredImage}
            alt={post.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-900/90 to-transparent" />
        </div>
      )}

      {/* Hero Section */}
      <section className={`bg-gradient-to-br from-brand-800 via-brand-900 to-[#A52A14] py-12 md:py-16 ${post.featuredImage ? '-mt-32 md:-mt-48 relative z-10' : ''}`}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "Blog", href: "/blog" },
              { label: post.category },
            ]}
            variant="dark"
          />

          <div className="mt-6">
            <Link to={`/blog?category=${post.category?.toLowerCase()}`}>
              <Badge className="bg-white/20 text-white hover:bg-white/30 mb-4">
                {post.category}
              </Badge>
            </Link>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
              {post.title}
            </h1>
            <p className="text-lg md:text-xl text-brand-100 mb-6">
              {post.excerpt}
            </p>

            <div className="flex flex-wrap items-center gap-4 text-sm text-brand-100">
              <span className="flex items-center gap-1">
                <User className="w-4 h-4" />
                {post.author}
              </span>
              {publishedDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {publishedDate}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {post.readTime} min read
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <article ref={articleRef} className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Tags */}
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {post.tags.map((tag) => (
              <Link key={tag} to={`/blog?tag=${encodeURIComponent(tag)}`}>
                <Badge variant="secondary" className="text-sm hover:bg-gray-200 cursor-pointer transition-colors">
                  {tag}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* Content - supports HTML (sanitized for XSS protection) */}
        <div
          className="prose prose-lg max-w-none prose-gray
            prose-headings:text-gray-900
            prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-2
            prose-a:text-brand-800 hover:prose-a:text-brand-900
            prose-blockquote:border-brand-800 prose-blockquote:bg-gray-50
            prose-code:bg-gray-100 prose-code:text-brand-800 prose-code:rounded prose-code:px-1
            prose-pre:bg-gray-900
            prose-img:rounded-lg prose-img:shadow-md
            prose-table:border prose-th:bg-gray-50 prose-th:border prose-td:border"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
        />

        {/* Share & Navigation */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <Button
              variant="outline"
              onClick={handleShare}
              className="flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share Article
            </Button>
            <Button asChild variant="outline">
              <Link to="/blog" className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Blog
              </Link>
            </Button>
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="py-16 px-4 sm:px-6 lg:px-8 border-t border-gray-100">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">You might also like</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedPosts.map((relatedPost) => (
                <Card key={relatedPost.slug} className="border-none shadow-lg hover:shadow-xl transition-shadow group overflow-hidden">
                  {relatedPost.featuredImage ? (
                    <Link to={`/blog/${relatedPost.slug}`} className="block aspect-[16/9] overflow-hidden">
                      <img
                        src={relatedPost.featuredImage}
                        alt={relatedPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </Link>
                  ) : (
                    <div className="h-1 bg-gradient-to-r from-brand-800 to-[#FFC107]" />
                  )}
                  <CardContent className="p-4">
                    <Badge variant="secondary" className="text-xs mb-2">
                      {relatedPost.category}
                    </Badge>
                    <Link to={`/blog/${relatedPost.slug}`}>
                      <h3 className="font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-brand-800 transition-colors">
                        {relatedPost.title}
                      </h3>
                    </Link>
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {relatedPost.readTime} min
                      </span>
                      <Link to={`/blog/${relatedPost.slug}`} className="text-brand-800 hover:text-brand-900 font-medium flex items-center gap-1">
                        Read <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="bg-gray-50 py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-none shadow-xl overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-brand-800 to-[#FFC107]" />
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-brand-800 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                Ready to Get Started?
              </h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Join SpannerWork to find tools, workshop space, and expert mechanics near you.
                Whether you need to borrow equipment or earn money from your skills, we've got you covered.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="bg-brand-800 hover:bg-brand-900">
                  <Link to="/feed">Browse Listings</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/profile">Create Account</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
