import { lazy, Suspense, type LazyExoticComponent, type ComponentType } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';
import Layout from "./Layout";
import RequireAuth from "../components/RequireAuth";
import RequireAdmin from "../components/RequireAdmin";
import { RouteErrorBoundaryClass } from "../components/RouteErrorBoundary";
import RouteNormalizer from "../components/RouteNormalizer";
import { mapPathToPageName } from "@/utils";
import { Skeleton } from "@/components/ui/skeleton";
import PageErrorBoundary from "../components/PageErrorBoundary";

// Eagerly loaded pages (critical path)
import Home from "./Home";
import Profile from "./Profile";
import NotFound from "./NotFound";

// Type for lazy loaded components
type LazyComponent = LazyExoticComponent<ComponentType<unknown>>;

// Lazy loaded pages for code splitting
const Feed: LazyComponent = lazy(() => import("./Feed"));
const CreateRequest: LazyComponent = lazy(() => import("./Create")); // Unified create page
const Messages: LazyComponent = lazy(() => import("./Messages"));
const RequestDetail: LazyComponent = lazy(() => import("./RequestDetail"));
const MapView: LazyComponent = lazy(() => import("./MapView"));
const Chat: LazyComponent = lazy(() => import("./Chat"));
const StartTransaction: LazyComponent = lazy(() => import("./StartTransaction"));
const TransactionDetail: LazyComponent = lazy(() => import("./TransactionDetail"));
const HowItWorks: LazyComponent = lazy(() => import("./HowItWorks"));
const Pricing: LazyComponent = lazy(() => import("./Pricing"));
const Safety: LazyComponent = lazy(() => import("./Safety"));
const StartEarning: LazyComponent = lazy(() => import("./StartEarning"));
const SuccessStories: LazyComponent = lazy(() => import("./SuccessStories"));
const Resources: LazyComponent = lazy(() => import("./Resources"));
const About: LazyComponent = lazy(() => import("./About"));
const Contact: LazyComponent = lazy(() => import("./Contact"));
const Terms: LazyComponent = lazy(() => import("./Terms"));
const Privacy: LazyComponent = lazy(() => import("./Privacy"));
const Cookies: LazyComponent = lazy(() => import("./Cookies"));
const Payment: LazyComponent = lazy(() => import("./Payment"));
const Verification: LazyComponent = lazy(() => import("./Verification"));
const ResetPassword: LazyComponent = lazy(() => import("./ResetPassword"));
const DisputeResolution: LazyComponent = lazy(() => import("./DisputeResolution"));
const Admin: LazyComponent = lazy(() => import("./Admin"));
const Calendar: LazyComponent = lazy(() => import("./Calendar"));
const SavedSearches: LazyComponent = lazy(() => import("./SavedSearches"));
const Referrals: LazyComponent = lazy(() => import("./Referrals"));
const Analytics: LazyComponent = lazy(() => import("./Analytics"));
const RefundPolicy: LazyComponent = lazy(() => import("./RefundPolicy"));
const ToolDetail: LazyComponent = lazy(() => import("./ToolDetail"));
const SpaceDetail: LazyComponent = lazy(() => import("./SpaceDetail"));
const ServiceDetail: LazyComponent = lazy(() => import("./ServiceDetail"));
const ProviderDashboard: LazyComponent = lazy(() => import("./ProviderDashboard"));
const ToolWizard: LazyComponent = lazy(() => import("../components/listing/ToolWizard"));
const AdminAnalytics: LazyComponent = lazy(() => import("./AdminAnalytics"));
const AdminInsurance: LazyComponent = lazy(() => import("./AdminInsurance"));

// Guide pages
const ProviderGuide: LazyComponent = lazy(() => import("./guides/ProviderGuide"));
const RenterGuide: LazyComponent = lazy(() => import("./guides/RenterGuide"));
const SafetyGuide: LazyComponent = lazy(() => import("./guides/SafetyGuide"));
const PricingGuide: LazyComponent = lazy(() => import("./guides/PricingGuide"));

// Loading fallback component
function PageLoader(): JSX.Element {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <Skeleton className="h-48 w-full rounded-xl mb-6" />
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        </div>
    );
}

// Page name mapping for layout
const PAGE_NAMES: readonly string[] = [
    'Feed', 'CreateRequest', 'Profile', 'Messages', 'RequestDetail', 'MapView',
    'Chat', 'StartTransaction', 'TransactionDetail', 'Home', 'HowItWorks',
    'Pricing', 'Safety', 'StartEarning', 'SuccessStories', 'Resources', 'About',
    'Contact', 'Terms', 'Privacy', 'Cookies', 'Payment', 'Verification',
    'DisputeResolution', 'Admin', 'Calendar', 'SavedSearches', 'Referrals',
    'Analytics', 'CreateOffer', 'RefundPolicy', 'ToolDetail', 'SpaceDetail',
    'ServiceDetail', 'ResetPassword', 'ProviderDashboard', 'AdminAnalytics', 'AdminInsurance'
] as const;

export function getCurrentPageName(pathname: string): string {
    return mapPathToPageName(pathname, PAGE_NAMES);
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent(): JSX.Element {
    const location = useLocation();
    const currentPage = getCurrentPageName(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <RouteNormalizer />
            <RouteErrorBoundaryClass>
                <Suspense fallback={<PageLoader />}>
                    <Routes>            
                        {/* Home - eagerly loaded */}
                        <Route path="/" element={<Home />} />
                        <Route path="/home" element={<Navigate to="/" replace />} />
                        
                        {/* Profile - eagerly loaded (auth landing) */}
                        <Route path="/profile" element={<Profile />} />

                        {/* Protected Routes */}
                        <Route path="/feed" element={<RequireAuth><Feed /></RequireAuth>} />
                        {/* Legacy route - redirect to unified /create */}
                        <Route path="/create-request" element={<Navigate to="/create" replace />} />
                        <Route path="/create" element={<RequireAuth><CreateRequest /></RequireAuth>} />
                        <Route path="/messages" element={
                            <RequireAuth>
                                <PageErrorBoundary>
                                    <Messages />
                                </PageErrorBoundary>
                            </RequireAuth>
                        } />
                        <Route path="/chat" element={
                            <RequireAuth>
                                <PageErrorBoundary>
                                    <Chat />
                                </PageErrorBoundary>
                            </RequireAuth>
                        } />
                        {/* Note: Messages now has inline chat, /chat is kept for backwards compat */}
                        <Route path="/start-transaction" element={
                            <RequireAuth>
                                <PageErrorBoundary>
                                    <StartTransaction />
                                </PageErrorBoundary>
                            </RequireAuth>
                        } />
                        <Route path="/transaction/:id" element={
                            <RequireAuth>
                                <PageErrorBoundary>
                                    <TransactionDetail />
                                </PageErrorBoundary>
                            </RequireAuth>
                        } />
                        <Route path="/payment" element={
                            <RequireAuth>
                                <PageErrorBoundary>
                                    <Payment />
                                </PageErrorBoundary>
                            </RequireAuth>
                        } />
                        <Route path="/calendar" element={<RequireAuth><Calendar /></RequireAuth>} />
                        <Route path="/saved-searches" element={<RequireAuth><SavedSearches /></RequireAuth>} />
                        <Route path="/referrals" element={<RequireAuth><Referrals /></RequireAuth>} />
                        <Route path="/analytics" element={
                            <RequireAuth>
                                <PageErrorBoundary>
                                    <Analytics />
                                </PageErrorBoundary>
                            </RequireAuth>
                        } />
                        {/* Legacy route - redirect to unified /create with intent */}
                        <Route path="/create-offer" element={<Navigate to="/create?intent=offer" replace />} />
                        <Route path="/provider-dashboard" element={
                            <RequireAuth>
                                <PageErrorBoundary>
                                    <ProviderDashboard />
                                </PageErrorBoundary>
                            </RequireAuth>
                        } />
                        <Route path="/list-tool" element={<RequireAuth><ToolWizard /></RequireAuth>} />
                        
                        {/* Admin Only */}
                        <Route path="/admin" element={
                            <RequireAdmin>
                                <PageErrorBoundary>
                                    <Admin />
                                </PageErrorBoundary>
                            </RequireAdmin>
                        } />
                        <Route path="/admin/analytics" element={
                            <RequireAdmin>
                                <PageErrorBoundary>
                                    <AdminAnalytics />
                                </PageErrorBoundary>
                            </RequireAdmin>
                        } />
                        <Route path="/admin/insurance" element={
                            <RequireAdmin>
                                <PageErrorBoundary>
                                    <AdminInsurance />
                                </PageErrorBoundary>
                            </RequireAdmin>
                        } />
                        
                        {/* Public Detail Pages */}
                        <Route path="/request/:id" element={
                            <PageErrorBoundary>
                                <RequestDetail />
                            </PageErrorBoundary>
                        } />
                        <Route path="/tool/:id" element={
                            <PageErrorBoundary>
                                <ToolDetail />
                            </PageErrorBoundary>
                        } />
                        <Route path="/space/:id" element={
                            <PageErrorBoundary>
                                <SpaceDetail />
                            </PageErrorBoundary>
                        } />
                        <Route path="/service/:id" element={
                            <PageErrorBoundary>
                                <ServiceDetail />
                            </PageErrorBoundary>
                        } />
                        
                        {/* Public Pages */}
                        <Route path="/map" element={<MapView />} />
                        <Route path="/verification" element={<Verification />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/dispute-resolution" element={<DisputeResolution />} />
                        
                        {/* Marketing Pages */}
                        <Route path="/how-it-works" element={<HowItWorks />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/safety" element={<Safety />} />
                        <Route path="/start-earning" element={<Navigate to="/resources/start-earning" replace />} />
                        <Route path="/success-stories" element={<Navigate to="/resources/success-stories" replace />} />
                        <Route path="/resources" element={<Resources />} />
                        <Route path="/resources/start-earning" element={<StartEarning />} />
                        <Route path="/resources/success-stories" element={<SuccessStories />} />
                        
                        {/* Guide Pages */}
                        <Route path="/guides/provider" element={<ProviderGuide />} />
                        <Route path="/guides/renter" element={<RenterGuide />} />
                        <Route path="/guides/safety" element={<SafetyGuide />} />
                        <Route path="/guides/pricing" element={<PricingGuide />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/contact" element={<Contact />} />
                        
                        {/* Legal Pages */}
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/cookies" element={<Cookies />} />
                        <Route path="/refund-policy" element={<RefundPolicy />} />
                        
                        {/* 404 Catch-all - must be last */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </RouteErrorBoundaryClass>
        </Layout>
    );
}

export default function Pages(): JSX.Element {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}
