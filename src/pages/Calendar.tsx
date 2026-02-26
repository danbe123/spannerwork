import { useState, useMemo } from "react";
import { authService, toolsService, transactionsService } from "@/api/services";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { queryKeys } from "@/lib/queryKeys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
  CheckCircle,
  X,
  ArrowRight
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  format,
  differenceInDays,
  isWithinInterval,
  isBefore,
  startOfDay
} from "date-fns";
import { Tool, Transaction, User } from "@/types";
import { toast } from "sonner";

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
  const toolIdKey = toolId ?? '';

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const { data: toolData, isLoading: loadingTool } = useQuery({
    queryKey: queryKeys.tool(toolIdKey),
    queryFn: () => toolsService.getById(toolIdKey),
    enabled: !!toolId,
  });

  const tool: Tool | undefined = toolData?.tool;

  // Bookings are managed through transactions - filter by toolId
  const { data: bookingsData } = useQuery({
    queryKey: queryKeys.bookingsByTool(toolIdKey),
    // @ts-expect-error - toolId filter works but type definition needs updating
    queryFn: () => transactionsService.list({ toolId }),
    enabled: !!toolId,
  });

  const bookings: Transaction[] = bookingsData?.data || [];

  const { data: currentUserData } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: () => authService.getCurrentUser(),
  });

  const currentUser: User | undefined = currentUserData?.user;

  const createBookingMutation = useMutation({
    mutationFn: async (bookingData: BookingData) => {
      if (!tool || !currentUser || !toolId) throw new Error("Missing required data");

      const result = await transactionsService.create({
        toolId,
        startDate: bookingData.startDate,
        endDate: bookingData.endDate,
        notes: bookingData.notes,
      });

      return result.transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bookingsByTool(toolIdKey) });
      queryClient.invalidateQueries({ queryKey: queryKeys.myListings() });
      setBookingSuccess(true);
      toast.success("Booking request sent! The owner will confirm within 24 hours.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create booking. Please try again.");
    },
  });

  // Calculate number of days selected
  const selectedDays = useMemo(() => {
    if (!startDate) return 0;
    if (!endDate) return 1;
    return differenceInDays(endDate, startDate) + 1;
  }, [startDate, endDate]);

  // Calculate total cost
  const totalCost = useMemo(() => {
    if (!tool || selectedDays === 0) return 0;

    const dailyRate = tool.dailyRate || 0;
    const weeklyRate = tool.weeklyRate || dailyRate * 7;

    // If booking is 7+ days, use weekly rate
    if (selectedDays >= 7) {
      const weeks = Math.floor(selectedDays / 7);
      const extraDays = selectedDays % 7;
      return (weeks * weeklyRate) + (extraDays * dailyRate);
    }

    return selectedDays * dailyRate;
  }, [tool, selectedDays]);

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
      const bookStart = startOfDay(new Date(booking.startDate));
      const bookEnd = startOfDay(new Date(booking.endDate));
      return isWithinInterval(startOfDay(date), { start: bookStart, end: bookEnd }) &&
             booking.status !== 'CANCELLED';
    });
  };

  // Check if any date in range is booked
  const hasBookedDatesInRange = (start: Date, end: Date): boolean => {
    const daysInRange = eachDayOfInterval({ start, end });
    return daysInRange.some(day => isDateBooked(day));
  };

  // Check if date is in selection range
  const isInSelectionRange = (date: Date): boolean => {
    if (!startDate) return false;

    const effectiveEnd = endDate || (hoverDate && !isBefore(hoverDate, startDate) ? hoverDate : startDate);
    if (!effectiveEnd) return isSameDay(date, startDate);

    const rangeStart = isBefore(startDate, effectiveEnd) ? startDate : effectiveEnd;
    const rangeEnd = isBefore(startDate, effectiveEnd) ? effectiveEnd : startDate;

    return isWithinInterval(date, { start: rangeStart, end: rangeEnd });
  };

  // Check if date is the start of selection
  const isStartDate = (date: Date): boolean => {
    return startDate ? isSameDay(date, startDate) : false;
  };

  // Check if date is the end of selection
  const isEndDate = (date: Date): boolean => {
    if (!endDate) return false;
    return isSameDay(date, endDate);
  };

  const handleDateClick = (date: Date) => {
    const today = startOfDay(new Date());
    if (isDateBooked(date) || isBefore(date, today)) return;

    // If no start date, set it
    if (!startDate) {
      setStartDate(date);
      setEndDate(null);
      return;
    }

    // If clicking on start date again, clear selection
    if (isSameDay(date, startDate)) {
      setStartDate(null);
      setEndDate(null);
      return;
    }

    // If we have a start date but no end date
    if (!endDate) {
      // If clicking before start date, make this the new start
      if (isBefore(date, startDate)) {
        // Check if range has booked dates
        if (hasBookedDatesInRange(date, startDate)) {
          toast.error("Selected range contains booked dates");
          return;
        }
        setEndDate(startDate);
        setStartDate(date);
      } else {
        // Check if range has booked dates
        if (hasBookedDatesInRange(startDate, date)) {
          toast.error("Selected range contains booked dates");
          return;
        }
        setEndDate(date);
      }
      return;
    }

    // If we have both dates, start a new selection
    setStartDate(date);
    setEndDate(null);
  };

  const handleDateHover = (date: Date) => {
    if (startDate && !endDate) {
      setHoverDate(date);
    }
  };

  const clearSelection = () => {
    setStartDate(null);
    setEndDate(null);
    setHoverDate(null);
  };

  const handleBooking = () => {
    if (!startDate || !tool) return;

    const bookingStartDate = new Date(startDate);
    bookingStartDate.setHours(9, 0, 0, 0);

    const bookingEndDate = new Date(endDate || startDate);
    bookingEndDate.setHours(17, 0, 0, 0);

    createBookingMutation.mutate({
      startDate: bookingStartDate.toISOString(),
      endDate: bookingEndDate.toISOString(),
      totalCost,
      durationDays: selectedDays,
    });
  };

  const handleNewBooking = () => {
    setBookingSuccess(false);
    clearSelection();
  };

  // Success view
  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-none shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Booking Request Sent!</h2>
              <p className="text-gray-600 mb-6">
                Your booking request for <strong>{tool.name}</strong> has been sent to the owner.
                They will confirm your booking within 24 hours.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold mb-3">Booking Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Dates:</span>
                    <span className="font-medium">
                      {startDate && format(startDate, 'PPP')}
                      {endDate && ` - ${format(endDate, 'PPP')}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium">{selectedDays} day{selectedDays > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-bold text-lg">£{totalCost.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleNewBooking}
                >
                  Book Another Date
                </Button>
                <Button
                  className="flex-1 bg-brand-800 hover:bg-brand-900"
                  onClick={() => navigate('/messages')}
                >
                  View Messages
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAFAF9] to-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Book {tool.name}</h1>
          <p className="text-gray-600">Select your dates to book this tool (click start date, then end date)</p>
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
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-1">
                  {days.map(day => {
                    const today = startOfDay(new Date());
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    const isBooked = isDateBooked(day);
                    const isPast = isBefore(day, today);
                    const isStart = isStartDate(day);
                    const isEnd = isEndDate(day);
                    const isInRange = isInSelectionRange(day);
                    const isToday = isSameDay(day, today);
                    const isDisabled = isBooked || isPast || !isCurrentMonth;

                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => !isDisabled && handleDateClick(day)}
                        onMouseEnter={() => !isDisabled && handleDateHover(day)}
                        onMouseLeave={() => setHoverDate(null)}
                        disabled={isDisabled}
                        className={`
                          aspect-square p-2 text-sm transition-all relative
                          ${!isCurrentMonth && 'text-gray-300'}
                          ${isCurrentMonth && !isBooked && !isPast && 'hover:bg-brand-50 cursor-pointer'}
                          ${isBooked && 'bg-red-100 text-red-800 cursor-not-allowed'}
                          ${isPast && isCurrentMonth && 'text-gray-400 cursor-not-allowed'}
                          ${isInRange && !isStart && !isEnd && 'bg-brand-100'}
                          ${isStart && 'bg-brand-800 text-white rounded-l-lg'}
                          ${isEnd && 'bg-brand-800 text-white rounded-r-lg'}
                          ${isStart && !endDate && 'rounded-lg'}
                          ${isToday && !isStart && !isEnd && !isInRange && 'border-2 border-brand-800 rounded-lg'}
                        `}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-6 text-sm">
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
                    <span className="text-gray-600">Start/End</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-brand-100 rounded" />
                    <span className="text-gray-600">Selected Range</span>
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

            {/* Booking Summary */}
            {startDate ? (
              <Card className="border-none shadow-lg border-2 border-brand-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Booking Summary</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearSelection}
                      className="h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Date Range Display */}
                  <div className="bg-brand-50 rounded-lg p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-center">
                        <p className="text-gray-500 text-xs mb-1">Start</p>
                        <p className="font-semibold">{format(startDate, 'MMM d')}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                      <div className="text-center">
                        <p className="text-gray-500 text-xs mb-1">End</p>
                        <p className="font-semibold">
                          {endDate ? format(endDate, 'MMM d') : format(startDate, 'MMM d')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Duration & Cost */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duration:</span>
                      <span className="font-medium">{selectedDays} day{selectedDays > 1 ? 's' : ''}</span>
                    </div>
                    {selectedDays >= 7 && (
                      <div className="flex justify-between text-green-600">
                        <span>Weekly discount applied!</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-medium">Total:</span>
                      <span className="font-bold text-lg">£{totalCost.toFixed(2)}</span>
                    </div>
                    {tool.deposit > 0 && (
                      <p className="text-xs text-gray-500">
                        + £{tool.deposit} refundable deposit
                      </p>
                    )}
                  </div>

                  {/* Book Button */}
                  <Button
                    onClick={handleBooking}
                    disabled={createBookingMutation.isPending || !currentUser}
                    className="w-full bg-brand-800 hover:bg-brand-900"
                  >
                    {createBookingMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4 mr-2" />
                    )}
                    {!currentUser ? 'Sign in to Book' : 'Request Booking'}
                  </Button>

                  <p className="text-xs text-gray-500 text-center">
                    Owner will confirm your booking within 24 hours
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-none shadow-lg">
                <CardContent className="p-6 text-center text-gray-500">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium mb-1">Select your dates</p>
                  <p className="text-sm">Click a start date, then click an end date to select a range</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
