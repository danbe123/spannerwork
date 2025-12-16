import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, RefreshCw, Plus, Search, LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface Suggestion {
  icon: LucideIcon;
  text: string;
  action: string;
}

interface EmptyStateProps {
  category?: string;
  onReset: () => void;
}

export default function EmptyState({ category = 'all', onReset }: EmptyStateProps) {
  const suggestions: Suggestion[] = [
    {
      icon: Plus,
      text: "Post your own job",
      action: "post",
    },
    {
      icon: Search,
      text: "Try different filters",
      action: "filter",
    },
    {
      icon: RefreshCw,
      text: "Check back later",
      action: "later",
    },
  ];

  return (
    <Card className="border-none shadow-lg">
      <CardContent className="py-16 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Inbox className="w-10 h-10 text-gray-400" />
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          No Jobs Found
        </h3>
        
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          {category === 'all' 
            ? "No active jobs match your search criteria"
            : `No ${category} jobs available right now`
          }
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
          <Link to="/CreateRequest">
            <Button className="bg-brand-800 hover:bg-brand-900">
              <Plus className="w-4 h-4 mr-2" />
              Post a Job
            </Button>
          </Link>
          <Button variant="outline" onClick={onReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset Filters
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {suggestions.map((suggestion, index) => (
            <div key={index} className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <suggestion.icon className="w-5 h-5 text-brand-800" />
              </div>
              <p className="text-sm text-gray-700 font-medium text-left">{suggestion.text}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
