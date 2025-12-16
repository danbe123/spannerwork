import { describe, it, expect } from 'vitest';

describe('Booking Conflict Detection', () => {
  describe('Date Range Overlap Logic', () => {
    function datesOverlap(s1: Date, e1: Date, s2: Date, e2: Date): boolean {
      return s1 <= e2 && e1 >= s2;
    }

    it('should detect exact same dates as overlap', () => {
      const start = new Date('2024-03-01');
      const end = new Date('2024-03-05');
      expect(datesOverlap(start, end, start, end)).toBe(true);
    });

    it('should detect partial overlap', () => {
      const existing = { s: new Date('2024-03-01'), e: new Date('2024-03-10') };
      const booking = { s: new Date('2024-03-05'), e: new Date('2024-03-15') };
      expect(datesOverlap(existing.s, existing.e, booking.s, booking.e)).toBe(true);
    });

    it('should allow non-overlapping dates', () => {
      const existing = { s: new Date('2024-03-10'), e: new Date('2024-03-15') };
      const booking = { s: new Date('2024-03-01'), e: new Date('2024-03-05') };
      expect(datesOverlap(existing.s, existing.e, booking.s, booking.e)).toBe(false);
    });
  });

  describe('Platform Fee Calculation', () => {
    const feePercent = 10;
    const calcFee = (amt: number) => Math.round(amt * (feePercent / 100));

    it('should calculate 10% platform fee', () => {
      expect(calcFee(10000)).toBe(1000);
      expect(calcFee(2500)).toBe(250);
    });
  });

  describe('Rental Fee Calculation', () => {
    function calcDays(s: Date, e: Date): number {
      return Math.max(1, Math.ceil(Math.abs(e.getTime() - s.getTime()) / 86400000));
    }

    function calcFee(s: Date, e: Date, daily: number, weekly?: number): number {
      const days = calcDays(s, e);
      if (days >= 7 && weekly) return Math.ceil(days / 7) * weekly;
      return days * daily;
    }

    it('should calculate daily rate for short bookings', () => {
      expect(calcFee(new Date('2024-03-01'), new Date('2024-03-04'), 2500, 15000)).toBe(7500);
    });

    it('should use weekly rate for 7+ day bookings', () => {
      expect(calcFee(new Date('2024-03-01'), new Date('2024-03-08'), 2500, 15000)).toBe(15000);
    });
  });
});
