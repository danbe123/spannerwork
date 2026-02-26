import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";
import SEO from "@/components/SEO";

/**
 * 404 Not Found page
 * Displayed when users navigate to a non-existent route
 */
export default function NotFound(): JSX.Element {
  const handleGoBack = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    e.preventDefault();
    window.history.back();
  };

  return (
    <>
      <SEO
        title="Page Not Found - SpannerWork"
        description="The page you're looking for doesn't exist. Return to SpannerWork to find tools, mechanics, and workshop spaces near you."
      />
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="text-9xl font-bold text-brand-800 opacity-20">404</div>
          <div className="text-2xl font-semibold text-gray-900 -mt-8">
            Page Not Found
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-600 mb-8">
          Sorry, we couldn't find the page you're looking for. It might have been
          moved, deleted, or the URL might be incorrect.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            asChild
            variant="default"
            className="bg-brand-800 hover:bg-brand-900"
          >
            <Link to="/">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
          >
            <Link to="#" onClick={handleGoBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Link>
          </Button>

          <Button asChild variant="outline">
            <Link to="/feed">
              <Search className="w-4 h-4 mr-2" />
              Browse Feed
            </Link>
          </Button>
        </div>

        {/* Help Text */}
        <p className="text-sm text-gray-500 mt-8">
          Need help?{" "}
          <Link to="/contact" className="text-brand-800 hover:underline">
            Contact our support team
          </Link>
        </p>
      </div>
    </div>
    </>
  );
}
