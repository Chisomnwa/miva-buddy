export type GeminiReservationDenial = "user_daily_limit" | "app_daily_limit" | "in_flight_limit" | "unavailable";

export class GeminiUsageProtectionError extends Error {
  constructor(readonly reason: GeminiReservationDenial) {
    super("Gemini usage reservation was not available");
    this.name = "GeminiUsageProtectionError";
  }
}
