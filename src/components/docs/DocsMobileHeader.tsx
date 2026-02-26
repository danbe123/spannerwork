import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Wrench, Home, X, Plus, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DOCS_LINKS } from "./docsLinks";

export default function DocsMobileHeader(): JSX.Element {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname.toLowerCase();

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-100 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Menu + Title */}
        <div className="flex items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                aria-label="Open navigation menu"
              >
                <Menu className="w-6 h-6 text-gray-700" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[85vw] max-w-[360px] p-0 flex flex-col [&>button]:hidden"
            >
              <SheetHeader className="p-5 bg-gradient-to-br from-brand-800 to-brand-900 text-white text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <SheetTitle className="text-white text-lg font-bold leading-tight">
                        SpannerWork
                      </SheetTitle>
                      <p className="text-brand-100 text-xs font-medium truncate">
                        Tools. Skills. Space.
                      </p>
                    </div>
                  </div>

                  <SheetClose asChild>
                    <button
                      className="p-2 rounded-xl hover:bg-white/15 transition-colors"
                      aria-label="Close navigation menu"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </SheetClose>
                </div>
              </SheetHeader>

              <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                {/* Main App Navigation */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold tracking-wide text-gray-400 px-4">
                    QUICK LINKS
                  </p>
                  <div className="space-y-1">
                    <Link
                      to="/"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-brand-50 hover:text-brand-800 transition-colors"
                    >
                      <Home className="w-5 h-5" />
                      <span className="font-medium">Home</span>
                    </Link>
                    <Link
                      to="/feed"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-brand-50 hover:text-brand-800 transition-colors"
                    >
                      <Home className="w-5 h-5" />
                      <span className="font-medium">Feed</span>
                    </Link>
                    <Link
                      to="/create"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-brand-50 hover:text-brand-800 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="font-medium">Post a Job</span>
                    </Link>
                    <Link
                      to="/messages"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-brand-50 hover:text-brand-800 transition-colors"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span className="font-medium">Messages</span>
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-brand-50 hover:text-brand-800 transition-colors"
                    >
                      <User className="w-5 h-5" />
                      <span className="font-medium">Profile</span>
                    </Link>
                  </div>
                </div>

                {/* Compact Resources Navigation - Single Section */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold tracking-wide text-gray-400 px-4">
                    RESOURCES
                  </p>
                  <div className="space-y-1">
                    {DOCS_LINKS.map((link) => {
                      const isActive = currentPath === link.href.toLowerCase();
                      return (
                        <Link
                          key={link.href}
                          to={link.href}
                          onClick={() => setOpen(false)}
                          className={
                            "flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors " +
                            (isActive
                              ? "bg-brand-50 text-brand-800 font-semibold"
                              : "text-gray-700 hover:bg-gray-50 hover:text-brand-800")
                          }
                        >
                          <span className="truncate">{link.title}</span>
                          {isActive && (
                            <span className="text-[11px] text-gray-400 shrink-0">Current</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </nav>

              <div className="p-4 border-t border-gray-100 bg-gray-50">
                <Link to="/feed" onClick={() => setOpen(false)}>
                  <Button className="w-full bg-brand-800 hover:bg-brand-900">
                    Go to Feed
                  </Button>
                </Link>
                <p className="mt-2 text-[11px] text-gray-500 text-center">
                  Browse help articles or contact support.
                </p>
              </div>
            </SheetContent>
          </Sheet>

          {/* Title */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-800 to-brand-900 rounded-lg flex items-center justify-center shadow-sm">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0 max-w-[180px]">
              <h1 className="text-base font-bold text-gray-900 truncate leading-tight">
                SpannerWork
              </h1>
              <p className="text-[11px] text-gray-500 font-medium truncate leading-tight">
                Tools. Skills. Space.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Home link */}
        <Link
          to="/"
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          aria-label="Go to home"
        >
          <Home className="w-5 h-5 text-gray-600" />
        </Link>
      </div>
    </header>
  );
}
