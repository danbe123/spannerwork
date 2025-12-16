import { useState } from "react";
import { authService, toolsService, transactionsService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2, Clock, PoundSterling } from "lucide-react";
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, format } from "date-fns";
import { Tool, Transaction, User } from "@/types";

interface BookingData {
  startDate: string;
  endDate: string;
  depositAmount?: number;
  totalCost: number;
  durationDays?: number;
  notes?: string;
}

export default function Calendar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const urlParams = new URLSearchParams(window.location.search);
  const toolId = urlParams.get('toolId');
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: toolData, isLoading: loadingTool } = useQuery({
    queryKey: ['tool', toolId],
    queryFn: () => toolsService.getById(toolId!),
    enabled: !!toolId,
  });

  const tool: Tool | undefined = toolData?.tool;

  // Note: Bookings are managed through transactions
  const { data: bookingsData } = useQuery({
    queryKey: ['bookings', toolId],
    // @ts-expect-error - toolId filter may need to be added to API
    queryFn: () => transactionsService.list({ toolId }),
    enabled: !!toolId,
  });

  const bookings: Transaction[] = bookingsData?.data || [];

  const { data: currentUserData } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser: User | undefined = currentUserData?.user;

  const createBookingMutation = useMutation({
    mutationFn: async (bookingData: BookingData) => {
      if (!tool || !currentUser) throw new Error("Missing required data");
      
      const result = await transactionsService.create({
        toolId: toolId!,
        startDate: bookingData.startDate,
        endDate: bookingData.endDate,
        notes: bookingData.notes,
      });

      return result.transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', toolId] });
      queryClient.invalidateQueries({ queryKey: ['myListings'] });
      setSelectedDate(null);
    },
  });

  if (loadingTool) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-800" />
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gray-600 mb-4">Tool not found</p>
          <Button onClick={() => navigate(createPageUrl("Feed"))}>Back to Feed</Button>
        </div>
      </div>
    );
  }

  // Generate calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Check if date is booked
  const isDateBooked = (date: Date): boolean => {
    return bookings.some(booking => {
      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      return date >= start && date <= end && booking.status !== 'CANCELLED';
    });
  };

  const handleDateClick = (date: Date) => {
    if (isDateBooked(date) || date < new Date()) return;
    setSelectedDate(date);
  };

  const handleBooking = (duration: string, recurring = false) => {
    if (!selectedDate || !tool) return;

    const startDate = new Date(selectedDate);
    startDate.setHours(9, 0, 0, 0);
    
    const endDate = new Date(selectedDate);
    endDate.setHours(17, 0, 0, 0);

    let totalCost = tool.dailyRate || 0;
    if (recurring && duration === 'weekly') {
      totalCost = tool.weeklyRate || tool.dailyRate * 5;
    }

    createBookingMutation.mutate({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalCost,
      durationDays: 1,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Book {tool.name}</h1>
          <p className="text-gray-600">Select a date to book this tool</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="md:col-span-2">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-2">
                  {days.map(day => {
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isBooked = isDateBooked(day);
                    const isPast = day < new Date();
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, new Date());

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => handleDateClick(day)}
                        disabled={isBooked || isPast || !isCurrentMonth}
                        className={`
                          aspect-square p-2 rounded-lg text-sm transition-all
                          ${!isCurrentMonth && 'text-gray-300'}
                          ${isCurrentMonth && !isBooked && !isPast && 'hover:bg-orange-50 cursor-pointer'}
                          ${isBooked && 'bg-red-100 text-red-800 cursor-not-allowed'}
                          ${isPast && 'text-gray-400 cursor-not-allowed'}
                          ${isSelected && 'bg-brand-800 text-white'}
                          ${isToday && !isSelected && 'border-2 border-brand-800'}
                        `}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex gap-4 mt-6 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 rounded" />
                    <span className="text-gray-600">Booked</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-brand-800 rounded" />
                    <span className="text-gray-600">Today</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-brand-800 rounded" />
                    <span className="text-gray-600">Selected</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Booking Details */}
          <div className="space-y-6">
            {/* Tool Info */}
            <Card className="border-none shadow-lg">
              <CardContent className="p-6">
                {tool.photos?.[0] && (
                  <img
                    src={tool.photos[0]}
                    alt={tool.name}
                    className="w-full h-32 object-cover rounded-lg mb-4"
                  />
                )}
                <h3 className="font-bold text-lg mb-2">{tool.name}</h3>
                <Badge variant="outline" className="mb-3">{tool.category}</Badge>
                
                <div className="space-y-2 text-sm">
                  {tool.dailyRate > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Daily Rate:</span>
                      <span className="font-semibold">£{tool.dailyRate}/day</span>
                    </div>
                  )}
                  {tool.weeklyRate && tool.weeklyRate > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Weekly Rate:</span>
                      <span className="font-semibold text-green-600">£{tool.weeklyRate}/week</span>
                    </div>
                  )}
                  {tool.deposit > 0 && (
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-gray-600">Deposit:</span>
                      <span className="font-medium">£{tool.deposit}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Booking Options */}
            {selectedDate && (
              <Card className="border-none shadow-lg">
                <CardHeader>
                  <CardTitle className="text-lg">Book for {format(selectedDate, 'PPP')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => handleBooking('daily', false)}
                    disabled={createBookingMutation.isPending}
                    className="w-full bg-brand-800 hover:bg-brand-900"
                  >
                    {createBookingMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4 mr-2" />
                    )}
                    Book for 1 Day - £{tool.dailyRate}
                  </Button>

                  {tool.weeklyRate && tool.weeklyRate > 0 && (
                    <Button
                      onClick={() => handleBooking('weekly', true)}
                      disabled={createBookingMutation.isPending}
                      variant="outline"
                      className="w-full border-2"
                    >
                      <PoundSterling className="w-4 h-4 mr-2" />
                      Weekly Rental - £{tool.weeklyRate}/week
                      <Badge className="ml-2 bg-green-100 text-green-800">
                        Save {Math.round((1 - tool.weeklyRate / (tool.dailyRate * 7)) * 100)}%
                      </Badge>
                    </Button>
                  )}

                  <p className="text-xs text-gray-500 mt-3">
                    Owner will confirm your booking within 24 hours
                  </p>
                </CardContent>
              </Card>
            )}

            {!selectedDate && (
              <Card className="border-none shadow-lg">
                <CardContent className="p-6 text-center text-gray-500">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>Select a date to see booking options</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
