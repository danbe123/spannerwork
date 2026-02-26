import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Review } from "@/types";

interface MyReviewsProps {
  reviews: Review[];
}

export default function MyReviews({ reviews }: MyReviewsProps) {
  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <p>No reviews yet. Complete services to receive reviews!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => {
        const reviewerName = review.reviewer?.name || 'Anonymous';
        const reviewerInitial = reviewerName[0]?.toUpperCase() || 'A';

        return (
          <Card key={review.id} className="p-4">
            <div className="flex items-start gap-4">
              <Avatar>
                <AvatarFallback className="bg-brand-100 text-brand-800">
                  {reviewerInitial}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-semibold text-gray-900">{reviewerName}</p>
                  <div className="flex">
                    {Array(5).fill(0).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-4 h-4 ${
                          i < review.rating
                            ? 'fill-[#FFC107] text-[#FFC107]'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(review.createdDate), { addSuffix: true })}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-gray-700">{review.comment}</p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
