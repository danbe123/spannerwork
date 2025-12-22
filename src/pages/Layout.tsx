/**
 * Layout - Premium App Shell
 * 
 * A completely redesigned navigation experience:
 * - Desktop: Rich sidebar with user context, stats, visual depth
 * - Mobile: Contextual header + floating bottom nav with FAB
 * - Smooth animations and micro-interactions throughout
 */

import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wrench, 
  Home, 
  Plus, 
  MessageSquare, 
  User, 
  Menu, 
  Bell, 
  Shield,
  Search,
  X,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Settings,
  LogOut,
  HelpCircle,
  LucideIcon
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import CookieConsent from "@/components/CookieConsent";
import { Toaster } from "@/components/ui/sonner";
import NotificationManager from "@/components/NotificationManager";
import { toast } from "sonner";
import useAuth from "@/hooks/use-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authService, gamificationService, messagesService } from "@/api/services";
import { User as UserType, Conversation } from "@/types";
import BackToTopFab from "@/components/BackToTopFab";
import { queryKeys } from "@/lib/queryKeys";

// Types
interface UserStats {
  totalTransactions: number;
  totalListings: number;
}

interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
  shortTitle: string;
  badge?: number;
}

// Page title mapping
const PAGE_TITLES: Record<string, string> = {
  '/feed': 'Find Jobs',
  '/create': 'Create',
  '/messages': 'Messages',
  '/profile': 'Profile',
  '/resources': 'Resources',
  '/admin': 'Admin',
  '/provider-dashboard': 'Dashboard',
  '/saved-searches': 'Saved Searches',
  '/calendar': 'Calendar',
  '/analytics': 'Analytics',
};

// Marketing pages that don't show app navigation
const MARKETING_PATHS = [
  '/',
  '/home',
  '/how-it-works',
  '/pricing',
  '/safety',
  '/start-earning',
  '/success-stories',
  '/resources',
  '/about',
  '/contact',
  '/terms',
  '/privacy',
  '/cookies',
  '/refund-policy',
  '/dispute-resolution',
  '/verification',
  '/map',
  '/reset-password',
  '/guides/provider',
  '/guides/renter',
  '/guides/safety',
  '/guides/pricing',
];

const MARKETING_PREFIXES = [
  '/request/',
  '/tool/',
  '/space/',
  '/service/',
  '/resources/',
];

function isMarketingRoute(pathname: string): boolean {
  const original = pathname || '';
  const trimmed = original !== '/' ? original.replace(/\/+$/, '') : original;
  const normalized = (trimmed || '').toLowerCase();

  if (MARKETING_PATHS.includes(normalized)) return true;
  if (MARKETING_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;

  return false;
}

// Navigation items generator
const getNavigationItems = (userRole: string | undefined, unreadMessages: number): NavigationItem[] => {
  const items: NavigationItem[] = [
    { title: "Feed", url: "/feed", icon: Home, shortTitle: "Feed" },
    { title: "Create", url: "/create", icon: Plus, shortTitle: "Post" },
    { title: "Messages", url: "/messages", icon: MessageSquare, shortTitle: "Chat", badge: unreadMessages },
    { title: "Resources", url: "/resources", icon: HelpCircle, shortTitle: "Help" },
    { title: "Profile", url: "/profile", icon: User, shortTitle: "Me" },
  ];

  if (userRole === 'ADMIN') {
    items.push({ title: "Admin", url: "/admin", icon: Shield, shortTitle: "Admin" });
  }

  return items;
};

// Scroll restoration
function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType === 'POP') return;
    try {
      if (pathname.toLowerCase() === '/feed' && sessionStorage.getItem('spannerwork_feed_restore_hint_v1') === '1') {
        return;
      }
    } catch {
      // ignore
    }
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);
  return null;
}

interface DesktopSidebarProps {
  items: NavigationItem[];
  currentPath: string;
  currentUser?: UserType;
  onLogout: () => void;
  userStats?: UserStats;
}

// Desktop Sidebar Component
function DesktopSidebar({ items, currentPath, currentUser, onLogout, userStats }: DesktopSidebarProps) {

  return (
    <aside 
      className="hidden md:flex md:flex-col w-72 h-screen sticky top-0 self-start shrink-0 border-r border-gray-100 bg-gradient-to-b from-white via-white to-gray-50/50 relative overflow-hidden"
    >
      {/* Decorative gradient line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-800 via-brand-500 to-[#FFC107]" />
      
      {/* Logo Section */}
      <div className="p-6 pb-4">
        <Link to="/" className="flex items-center gap-3 group">
          <motion.div 
            className="w-11 h-11 bg-gradient-to-br from-brand-800 to-brand-900 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20"
            whileHover={{ scale: 1.05, rotate: -5 }}
            whileTap={{ scale: 0.95 }}
          >
            <Wrench className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <h2 className="font-bold text-xl text-gray-900 group-hover:text-brand-800 transition-colors">
              SpannerWork
            </h2>
            <p className="text-xs text-brand-800 font-semibold tracking-wide">
              Tools · Skills · Space
            </p>
          </div>
        </Link>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {/* Navigation */}
        <nav className="flex-1 min-h-0 px-3 py-2 overflow-y-auto">
          <div className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath.toLowerCase() === item.url.toLowerCase();
              
              return (
                <Link key={item.title} to={item.url}>
                  <motion.div
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative group
                      ${isActive 
                        ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/25' 
                        : 'hover:bg-orange-50 text-gray-700 hover:text-brand-800'
                      }
                    `}
                    whileHover={{ x: isActive ? 0 : 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                    <span className="font-medium flex-1">{item.title}</span>
                    {(item.badge || 0) > 0 && (
                      <Badge 
                        className={`
                          px-2 py-0.5 text-xs font-bold
                          ${isActive 
                            ? 'bg-white text-orange-600' 
                            : 'bg-brand-800 text-white'
                          }
                        `}
                      >
                        {(item.badge || 0) > 99 ? '99+' : item.badge}
                      </Badge>
                    )}
                    {!isActive && (
                      <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400" />
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Quick Stats */}
        {userStats && (
          <div className="px-4 pb-4">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-gray-700">Your Stats</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-brand-800">{userStats.totalTransactions || 0}</p>
                  <p className="text-xs text-gray-500">Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{userStats.totalListings || 0}</p>
                  <p className="text-xs text-gray-500">Listings</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto">
        {/* User Section - Above Help */}
        {currentUser && (
          <div className="px-4 pb-4">
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 ring-2 ring-white shadow-md">
                  <AvatarImage src={currentUser.avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-brand-800 to-brand-900 text-white font-semibold">
                    {currentUser.name?.charAt(0) || currentUser.email?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {currentUser.name || 'Welcome!'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{currentUser.email}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                      <Settings className="w-4 h-4 text-gray-500" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="flex items-center gap-2">
                        <User className="w-4 h-4" /> View Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/provider-dashboard" className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Provider Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onLogout} className="text-red-600">
                      <LogOut className="w-4 h-4 mr-2" /> Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}

        {/* Help Link */}
        <div className="p-4 border-t border-gray-100">
          <Link 
            to="/resources"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-800 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
            Help & Resources
          </Link>
        </div>
      </div>
    </aside>
  );
}

interface MobileHeaderProps {
  currentPath: string;
  onMenuOpen: () => void;
  unreadNotifications: number;
}

// Mobile Header Component
function MobileHeader({ currentPath, onMenuOpen, unreadNotifications }: MobileHeaderProps) {
  const [showSearch, setShowSearch] = useState(false);
  const pageTitle = PAGE_TITLES[currentPath.toLowerCase()] || 'SpannerWork';

  return (
    <header className="bg-white/80 backdrop-blur-lg border-b border-gray-100 px-4 py-3 md:hidden sticky top-0 z-30">
      <div className="flex items-center justify-between">
        {/* Left: Menu + Title */}
        <div className="flex items-center gap-3">
          <motion.button 
            onClick={onMenuOpen}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            whileTap={{ scale: 0.9 }}
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </motion.button>
          
          <AnimatePresence mode="wait">
            <motion.div
              key={pageTitle}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-brand-800 to-brand-900 rounded-lg flex items-center justify-center shadow-sm">
                <Wrench className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold text-gray-900">{pageTitle}</h1>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          <motion.button 
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowSearch(true)}
          >
            <Search className="w-5 h-5 text-gray-600" />
          </motion.button>
          
          <motion.button 
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors relative"
            whileTap={{ scale: 0.9 }}
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {unreadNotifications > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-brand-800 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg"
              >
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </motion.span>
            )}
          </motion.button>
        </div>
      </div>

      {/* Search Overlay */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute inset-x-0 top-0 bg-white p-4 shadow-lg z-50"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search jobs, tools, services..."
                  className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-800/20"
                  autoFocus
                />
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowSearch(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

interface MobileBottomNavProps {
  items: NavigationItem[];
  currentPath: string;
}

// Mobile Bottom Navigation with FAB
function MobileBottomNav({ items, currentPath }: MobileBottomNavProps) {
  // Split items to put Create in center as FAB
  const leftItems = items.filter(item => item.url !== '/create').slice(0, 2);
  const rightItems = items.filter(item => item.url !== '/create').slice(2);
  const createItem = items.find(item => item.url === '/create');

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe">
      {/* Background with blur */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-lg border-t border-gray-100 shadow-2xl shadow-black/10" />
      
      <div className="relative flex items-end justify-around px-2 py-2">
        {/* Left items */}
        {leftItems.map((item) => (
          <NavItem key={item.title} item={item} isActive={currentPath.toLowerCase() === item.url.toLowerCase()} />
        ))}

        {/* Center FAB for Create */}
        {createItem && (
          <Link to={createItem.url} className="relative -mt-6">
            <motion.div
              className="w-14 h-14 bg-gradient-to-br from-brand-800 to-brand-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/40"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className="w-7 h-7 text-white" />
            </motion.div>
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-brand-800">
              Post
            </span>
          </Link>
        )}

        {/* Right items */}
        {rightItems.map((item) => (
          <NavItem key={item.title} item={item} isActive={currentPath.toLowerCase() === item.url.toLowerCase()} />
        ))}
      </div>
    </nav>
  );
}

interface NavItemProps {
  item: NavigationItem;
  isActive: boolean;
}

// Individual nav item
function NavItem({ item, isActive }: NavItemProps) {
  const Icon = item.icon;
  
  return (
    <Link to={item.url} className="relative flex-1 max-w-[72px]">
      <motion.div
        className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-colors ${
          isActive ? 'text-brand-800' : 'text-gray-500'
        }`}
        whileTap={{ scale: 0.9 }}
      >
        <div className="relative">
          <Icon className="w-6 h-6" />
          {(item.badge || 0) > 0 && (
            <motion.span 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-brand-800 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
            >
              {(item.badge || 0) > 9 ? '9+' : item.badge}
            </motion.span>
          )}
        </div>
        <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''}`}>
          {item.shortTitle}
        </span>
        
        {/* Active indicator */}
        {isActive && (
          <motion.div
            layoutId="activeTab"
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-800 rounded-full"
          />
        )}
      </motion.div>
    </Link>
  );
}

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  items: NavigationItem[];
  currentPath: string;
  currentUser?: UserType;
  onLogout: () => void;
}

// Mobile Drawer
function MobileDrawer({ open, onClose, items, currentPath, currentUser, onLogout }: MobileDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="left" className="w-80 p-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-brand-800 to-brand-900 p-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Wrench className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-xl">SpannerWork</h2>
              <p className="text-orange-200 text-sm">Tools · Skills · Space</p>
            </div>
          </div>
          
          {currentUser && (
            <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
              <Avatar className="w-10 h-10 ring-2 ring-white/30">
                <AvatarImage src={currentUser.avatar || undefined} />
                <AvatarFallback className="bg-white/20 text-white">
                  {currentUser.name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{currentUser.name || 'Welcome!'}</p>
                <p className="text-xs text-orange-200 truncate">{currentUser.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="p-4">
          <div className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath.toLowerCase() === item.url.toLowerCase();
              
              return (
                <Link key={item.title} to={item.url} onClick={onClose}>
                  <div
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive 
                        ? 'bg-orange-50 text-brand-800 font-semibold' 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1">{item.title}</span>
                    {(item.badge || 0) > 0 && (
                      <Badge className="bg-brand-800 text-white">
                        {item.badge}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-gray-50">
          {currentUser ? (
            <Button 
              variant="ghost" 
              className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => { onLogout(); onClose(); }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          ) : (
            <Link to="/profile" onClick={onClose}>
              <Button className="w-full bg-brand-800 hover:bg-brand-900">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface LayoutProps {
  children: React.ReactNode;
  currentPageName?: string;
}

// Main Layout Component
export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get current user
  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
    enabled: isAuthenticated,
  });
  const currentUser = currentUserData?.user;

  // Get user stats from gamification service
  const { data: statsData } = useQuery({
    queryKey: queryKeys.myStats(),
    queryFn: () => gamificationService.getMyStats(),
    enabled: isAuthenticated,
  });
  const userStats = statsData?.stats as UserStats | undefined;

  // Get unread messages count from real API
  const { data: conversationsData } = useQuery({
    queryKey: queryKeys.conversations(),
    queryFn: () => messagesService.listConversations(),
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30s
  });
  const unreadMessages = conversationsData?.conversations?.reduce(
    (sum: number, conv: Conversation) => sum + (conv.unreadCount || 0), 0
  ) || 0;
  const unreadNotifications = 0; // Would need a notifications API

  const navigationItems = getNavigationItems(currentUser?.role, unreadMessages);

  // Handle logout
  const handleLogout = async () => {
    try {
      await authService.logout();
      // Clear user data from cache
      queryClient.setQueryData(queryKeys.currentUser(), null);
      queryClient.clear();
      toast.success('Signed out successfully');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Handle unauthorized events
  useEffect(() => {
    function handleUnauthorized() {
      if (typeof window === 'undefined') return;

      const path = window.location.pathname;
      const currentPath = path + window.location.search;

      const isProfilePage = path === '/Profile' || path === '/profile';
      const isMarketingPath = isMarketingRoute(path);

      if (isProfilePage || isMarketingPath) return;

      toast.error('Session expired', { description: 'Please sign in again.' });
      const params = new URLSearchParams();
      params.set('redirect', currentPath);
      navigate(`/profile?${params.toString()}`);
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]);

  // Check if marketing page
  const pathNameLower = location.pathname.toLowerCase();
  const isMarketingPage = isMarketingRoute(location.pathname);
  const isAuthLanding = pathNameLower === "/profile" && !isAuthenticated;

  // Marketing pages render without app shell
  if (isMarketingPage || isAuthLanding) {
    return (
      <>
        <ScrollToTop />
        {children}
        <BackToTopFab bottomClassName="bottom-6" />
        <CookieConsent />
        <Toaster position="top-right" />
      </>
    );
  }

  // App pages with full navigation
  return (
    <div className="min-h-screen flex flex-col w-full bg-[#FAFAF9]">
      <ScrollToTop />
      <NotificationManager />
      <Toaster position="top-right" />
      <CookieConsent />

      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <DesktopSidebar 
          items={navigationItems}
          currentPath={location.pathname}
          currentUser={currentUser}
          onLogout={handleLogout}
          userStats={userStats}
        />

        {/* Main Content Area */}
        <main className="flex-1 w-full overflow-x-hidden flex flex-col">
          {/* Mobile Header */}
          <MobileHeader 
            currentPath={location.pathname}
            onMenuOpen={() => setMobileMenuOpen(true)}
            unreadNotifications={unreadNotifications}
          />

          {/* Page Content */}
          <div className="flex-1 w-full pb-24 md:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="min-h-full"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mobile Bottom Navigation */}
          <MobileBottomNav 
            items={navigationItems}
            currentPath={location.pathname}
          />
        </main>

        {/* Mobile Drawer */}
        <MobileDrawer
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          items={navigationItems}
          currentPath={location.pathname}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      </div>

      <BackToTopFab bottomClassName="bottom-24" />
    </div>
  );
}
