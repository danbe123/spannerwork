import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { blogService } from "@/api/services";
import { queryKeys } from "@/lib/queryKeys";
import SEO from "@/components/SEO";
import MarketingFooter from "@/components/MarketingFooter";
import DocsMobileHeader from "@/components/docs/DocsMobileHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  ArrowRight,
  Clock,
  FileText,
  Wrench,
  Warehouse,
  GraduationCap,
  TrendingUp,
  ArrowLeft,
  Home,
  Search,
  X,
  Tag
} from "lucide-react";

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Wrench; color: string }> = {
  tools: { label: 'Tools & Equipment', icon: Wrench, color: 'text-brand-800' },
  workshop: { label: 'Workshop Space', icon: Warehouse, color: 'text-purple-600' },
  providers: { label: 'For Providers', icon: GraduationCap, color: 'text-blue-600' },
  diy: { label: 'DIY Tips', icon: TrendingUp, color: 'text-green-600' },
};

const POSTS_PER_PAGE = 12;

export default function Blog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(POSTS_PER_PAGE);

  const categoryFilter = searchParams.get('category');
  const tagFilter = searchParams.get('tag');

  const { data: blogData, isLoading, error } = useQuery({
    queryKey: queryKeys.blogPosts(),
    queryFn: () => blogService.listPublished({ limit: 100 }),
  });

  const allPosts = blogData?.data || [];

  // Filter by category, tag, and search
  let posts = allPosts;

  if (categoryFilter) {
    posts = posts.filter(post => post.category?.toLowerCase() === categoryFilter.toLowerCase());
  }

  if (tagFilter) {
    posts = posts.filter(post => post.tags?.some(t => t.toLowerCase() === tagFilter.toLowerCase()));
  }

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    posts = posts.filter(post =>
      post.title.toLowerCase().includes(query) ||
      post.excerpt?.toLowerCase().includes(query)
    );
  }

  // Pagination
  const totalFilteredPosts = posts.length;
  const featuredPosts = posts.slice(0, 2);
  const allRegularPosts = posts.slice(2);
  const regularPosts = allRegularPosts.slice(0, Math.max(0, displayLimit - 2));
  const hasMorePosts = displayLimit < totalFilteredPosts;

  const loadMore = () => {
    setDisplayLimit(prev => prev + POSTS_PER_PAGE);
  };

  // Get unique categories and tags from actual posts
  const availableCategories = [...new Set(allPosts.map(p => p.category?.toLowerCase()).filter(Boolean))];
  const availableTags = [...new Set(allPosts.flatMap(p => p.tags || []))].slice(0, 10);

  const categoryInfo = categoryFilter ? CATEGORY_CONFIG[categoryFilter] : null;

  const clearFilters = () => {
    setSearchParams({});
    setSearchQuery('');
    setDisplayLimit(POSTS_PER_PAGE);
  };

  return (
    <div className="min-h-screen bg-white">
      <DocsMobileHeader />

      {/* Desktop Navigation */}
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

      <SEO
        title={categoryInfo ? `${categoryInfo.label} - SpannerWork Blog` : "SpannerWork Blog - Tool Rental Tips, Mechanic Guides & Workshop Advice"}
        description="Expert advice for DIY mechanics and automotive professionals. Learn about tool rentals, workshop space, pricing your services, and growing your mechanic business in the UK."
        keywords="mechanic blog, DIY car repair tips, tool rental guide, workshop space UK, mobile mechanic business, automotive tools guide"
      />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-brand-800 via-brand-900 to-[#A52A14] py-12 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {(categoryFilter && categoryInfo) || tagFilter ? (
            <>
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-2 text-brand-200 hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                All Articles
              </button>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                {categoryInfo?.label || `Tagged: ${tagFilter}`}
              </h1>
            </>
          ) : (
            <>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                SpannerWork Blog
              </h1>
              <p className="text-lg md:text-xl text-brand-100 max-w-2xl mx-auto mb-8">
                Expert guides, tips, and insights for DIY mechanics and automotive professionals
              </p>
            </>
          )}

          {/* Search Bar */}
          <div className="max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-10 py-3 h-12 bg-white/95 border-0 shadow-lg text-gray-900 placeholder:text-gray-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Popular Tags */}
          {availableTags.length > 0 && !categoryFilter && !tagFilter && (
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <span className="text-brand-200 text-sm flex items-center gap-1">
                <Tag className="w-3 h-3" /> Popular:
              </span>
              {availableTags.slice(0, 5).map(tag => (
                <Link
                  key={tag}
                  to={`/blog?tag=${encodeURIComponent(tag)}`}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white text-sm rounded-full transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Loading State */}
      {isLoading && (
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {[1, 2].map((i) => (
                <Card key={i} className="border-none shadow-xl overflow-hidden">
                  <div className="h-2 bg-gray-200" />
                  <CardContent className="p-8">
                    <Skeleton className="h-12 w-12 rounded-xl mb-4" />
                    <Skeleton className="h-8 w-3/4 mb-3" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Error State */}
      {error && (
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to load blog posts</h2>
            <p className="text-gray-600">Please try again later.</p>
          </div>
        </section>
      )}

      {/* Empty State - No posts at all */}
      {!isLoading && !error && allPosts.length === 0 && (
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Blog Coming Soon</h2>
            <p className="text-gray-600 mb-8">
              We're working on helpful guides for tool rentals, workshop tips, and mechanic advice.
              In the meantime, check out the listings on SpannerWork.
            </p>
            <Button asChild size="lg" className="bg-brand-800 hover:bg-brand-900">
              <Link to="/feed">Browse Listings</Link>
            </Button>
          </div>
        </section>
      )}

      {/* Empty State - Category has no posts */}
      {!isLoading && !error && allPosts.length > 0 && posts.length === 0 && categoryFilter && (
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">No articles in this category yet</h2>
            <p className="text-gray-600 mb-8">
              Check back soon or browse our other articles.
            </p>
            <Button asChild variant="outline" size="lg">
              <Link to="/blog">View All Articles</Link>
            </Button>
          </div>
        </section>
      )}

      {/* Featured Posts */}
      {!isLoading && !error && featuredPosts.length > 0 && (
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              {categoryFilter || tagFilter ? 'Articles' : 'Featured Articles'}
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {featuredPosts.map((post) => {
                const catConfig = CATEGORY_CONFIG[post.category?.toLowerCase()] || { icon: FileText, color: 'text-gray-600' };
                const CategoryIcon = catConfig.icon;
                return (
                  <Card key={post.slug} className="border-none shadow-xl hover:shadow-2xl transition-shadow overflow-hidden group">
                    {/* Featured Image or Gradient */}
                    {post.featuredImage ? (
                      <Link to={`/blog/${post.slug}`} className="block aspect-[2/1] overflow-hidden">
                        <img
                          src={post.featuredImage}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </Link>
                    ) : (
                      <div className="h-2 bg-gradient-to-r from-brand-800 to-[#FFC107]" />
                    )}
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <Link
                          to={`/blog?category=${post.category?.toLowerCase()}`}
                          className="flex items-center gap-2"
                        >
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-800 to-brand-900 flex items-center justify-center">
                            <CategoryIcon className="w-5 h-5 text-white" />
                          </div>
                          <Badge variant="outline" className="text-brand-800 border-brand-800 hover:bg-brand-800/10">
                            {post.category}
                          </Badge>
                        </Link>
                      </div>
                      <Link to={`/blog/${post.slug}`}>
                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-brand-800 transition-colors line-clamp-2">
                          {post.title}
                        </h3>
                      </Link>
                      <p className="text-gray-600 mb-4 leading-relaxed text-sm line-clamp-2">
                        {post.excerpt}
                      </p>
                      {/* Tags */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-4">
                          {post.tags.slice(0, 3).map(tag => (
                            <Link
                              key={tag}
                              to={`/blog?tag=${encodeURIComponent(tag)}`}
                              className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors"
                            >
                              {tag}
                            </Link>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {post.readTime} min
                          </span>
                          {post.publishedAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(post.publishedAt).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <Link to={`/blog/${post.slug}`} className="text-brand-800 hover:text-brand-900 font-semibold flex items-center gap-1 text-sm">
                          Read <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* All Posts */}
      {!isLoading && !error && regularPosts.length > 0 && (
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Latest Articles</h2>
              {totalFilteredPosts > 2 && (
                <span className="text-sm text-gray-500">
                  Showing {Math.min(displayLimit, totalFilteredPosts)} of {totalFilteredPosts} articles
                </span>
              )}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularPosts.map((post) => {
                const catConfig = CATEGORY_CONFIG[post.category?.toLowerCase()] || { icon: FileText, color: 'text-gray-600' };
                const CategoryIcon = catConfig.icon;
                return (
                  <Card key={post.slug} className="border-none shadow-lg hover:shadow-xl transition-shadow group overflow-hidden">
                    {/* Featured Image */}
                    {post.featuredImage ? (
                      <Link to={`/blog/${post.slug}`} className="block aspect-[16/9] overflow-hidden">
                        <img
                          src={post.featuredImage}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </Link>
                    ) : (
                      <div className="h-1 bg-gradient-to-r from-brand-800 to-[#FFC107]" />
                    )}
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Link
                          to={`/blog?category=${post.category?.toLowerCase()}`}
                          className="flex items-center gap-2 hover:opacity-80"
                        >
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <CategoryIcon className="w-4 h-4 text-brand-800" />
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {post.category}
                          </Badge>
                        </Link>
                      </div>
                      <Link to={`/blog/${post.slug}`}>
                        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-brand-800 transition-colors line-clamp-2">
                          {post.title}
                        </h3>
                      </Link>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {post.excerpt}
                      </p>
                      {/* Tags */}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {post.tags.slice(0, 2).map(tag => (
                            <Link
                              key={tag}
                              to={`/blog?tag=${encodeURIComponent(tag)}`}
                              className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors"
                            >
                              {tag}
                            </Link>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {post.readTime} min
                        </span>
                        <Link to={`/blog/${post.slug}`} className="text-brand-800 hover:text-brand-900 font-medium">
                          Read →
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Load More Button */}
            {hasMorePosts && (
              <div className="mt-12 text-center">
                <Button
                  onClick={loadMore}
                  variant="outline"
                  size="lg"
                  className="min-w-[200px]"
                >
                  Load More Articles
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Categories - Only show if there are posts with categories */}
      {!isLoading && !error && availableCategories.length > 0 && !categoryFilter && (
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">Browse by Category</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {availableCategories.map((cat) => {
                const config = CATEGORY_CONFIG[cat] || { label: cat, icon: FileText, color: 'text-gray-600' };
                const Icon = config.icon;
                const postCount = allPosts.filter(p => p.category?.toLowerCase() === cat).length;
                return (
                  <Link key={cat} to={`/blog?category=${cat}`} className="block">
                    <Card className="border-none shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
                      <CardContent className="p-6 text-center">
                        <Icon className={`w-10 h-10 ${config.color} mx-auto mb-3`} />
                        <h3 className="font-bold text-gray-900">{config.label}</h3>
                        <p className="text-sm text-gray-500 mt-1">{postCount} article{postCount !== 1 ? 's' : ''}</p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* CTA - Only show if there are posts */}
      {!isLoading && !error && allPosts.length > 0 && (
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-brand-800 to-brand-900">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-brand-100 mb-8">
              Join SpannerWork and access tools, mechanics, and workshop space near you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-brand-800 hover:bg-brand-50">
                <Link to="/feed">Browse Listings</Link>
              </Button>
              <Button asChild size="lg" className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-gray-900">
                <Link to="/profile">Sign Up Free</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      <MarketingFooter />
    </div>
  );
}
