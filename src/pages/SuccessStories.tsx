/**
 * Success Stories Page
 * 
 * Showcases testimonials and success stories from SpannerWork users.
 */

import { Star, Quote, MapPin, Wrench, Building2, GraduationCap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SEO from "@/components/SEO";
import { Link } from "react-router-dom";

interface SuccessStory {
  id: string;
  name: string;
  location: string;
  avatar?: string;
  role: "provider" | "seeker";
  category: "tool" | "space" | "service";
  quote: string;
  earnings?: string;
  saved?: string;
  rating: number;
}

const successStories: SuccessStory[] = [
  {
    id: "1",
    name: "James Mitchell",
    location: "Manchester",
    role: "provider",
    category: "tool",
    quote: "I've earned over £2,000 in six months just renting out my power tools on weekends. They were sitting in my garage doing nothing before SpannerWork!",
    earnings: "£2,000+",
    rating: 5,
  },
  {
    id: "2",
    name: "Sarah Chen",
    location: "Birmingham",
    role: "seeker",
    category: "space",
    quote: "Found a brilliant workshop space for my furniture restoration hobby. Would have cost thousands to set up my own. Now I pay by the day when I need it.",
    saved: "£5,000",
    rating: 5,
  },
  {
    id: "3",
    name: "Mike O'Brien",
    location: "Leeds",
    role: "provider",
    category: "service",
    quote: "As a retired plumber, I still love helping people. SpannerWork lets me pick and choose jobs that interest me. Brilliant way to stay active and earn a bit extra.",
    earnings: "£800/month",
    rating: 5,
  },
  {
    id: "4",
    name: "Emma Williams",
    location: "Bristol",
    role: "seeker",
    category: "tool",
    quote: "Needed a pressure washer for one day. Rented one locally for £15 instead of buying one for £200. The owner even showed me how to use it properly!",
    saved: "£185",
    rating: 5,
  },
  {
    id: "5",
    name: "David Patel",
    location: "London",
    role: "provider",
    category: "space",
    quote: "My garage workshop is now fully booked most weekends. People come to work on their cars, do woodworking projects, or just need a proper workspace. It's a fantastic community.",
    earnings: "£1,200/month",
    rating: 5,
  },
  {
    id: "6",
    name: "Lisa Thompson",
    location: "Newcastle",
    role: "seeker",
    category: "service",
    quote: "Found a brilliant local electrician within an hour of posting. Professional, reasonably priced, and the reviews were spot on. Will definitely use SpannerWork again.",
    rating: 5,
  },
];

function getCategoryIcon(category: string) {
  switch (category) {
    case "tool": return Wrench;
    case "space": return Building2;
    case "service": return GraduationCap;
    default: return Wrench;
  }
}

export default function SuccessStories(): JSX.Element {
  return (
    <>
      <SEO
        title="Success Stories | SpannerWork"
        description="Real stories from SpannerWork users who are earning money and saving on tools, spaces, and services."
      />
      
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-brand-800 to-brand-900 text-white py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="w-8 h-8 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Success Stories
            </h1>
            <p className="text-xl text-orange-100 max-w-2xl mx-auto">
              Real people, real results. See how our community is earning and saving with SpannerWork.
            </p>
          </div>
        </div>

        {/* Stories Grid */}
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {successStories.map((story) => {
              const CategoryIcon = getCategoryIcon(story.category);
              return (
                <Card key={story.id} className="shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <Quote className="w-8 h-8 text-gray-200 mb-4" />
                    
                    <p className="text-gray-700 mb-6 italic">"{story.quote}"</p>
                    
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar>
                        <AvatarImage src={story.avatar} />
                        <AvatarFallback className="bg-orange-100 text-brand-800">
                          {story.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{story.name}</p>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <MapPin className="w-3 h-3" />
                          {story.location}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${story.role === 'provider' ? 'bg-green-100' : 'bg-blue-100'}`}>
                          <CategoryIcon className={`w-4 h-4 ${story.role === 'provider' ? 'text-green-600' : 'text-blue-600'}`} />
                        </div>
                        <span className="text-sm text-gray-600 capitalize">{story.role}</span>
                      </div>
                      
                      {story.earnings && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Earned</p>
                          <p className="font-bold text-green-600">{story.earnings}</p>
                        </div>
                      )}
                      {story.saved && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Saved</p>
                          <p className="font-bold text-blue-600">{story.saved}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-0.5 mt-4">
                      {[...Array(story.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-white py-16">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Write Your Success Story?</h2>
            <p className="text-gray-600 mb-8">
              Join thousands of people who are already earning and saving with SpannerWork.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/create?intent=offer">
                <Button className="bg-brand-800 hover:bg-brand-900">
                  Start Earning
                </Button>
              </Link>
              <Link to="/feed">
                <Button variant="outline">
                  Find What You Need
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
