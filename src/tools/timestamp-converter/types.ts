export interface TimestampConversionDetails {
  seconds: number;
  milliseconds: number;
  isoString: string;
  utcString: string;
  localString: string;
  relative: string;
  dayOfWeek: string;
  isPast: boolean;
}
