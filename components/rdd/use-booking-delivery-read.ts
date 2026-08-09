"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingDeliveryRecord } from "@/lib/types";

export function useBookingDeliveryRead() {
  const [records, setRecords] = useState<BookingDeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/booking-delivery?scope=all", { cache: "no-store", method: "GET" });
      const data = (await response.json()) as { records?: BookingDeliveryRecord[]; error?: string; warning?: string };
      if (!response.ok) throw new Error(data.error || data.warning || "โหลด Booking Delivery ไม่สำเร็จ");
      setRecords(Array.isArray(data.records) ? data.records : []);
    } catch (loadError) {
      setRecords([]);
      setError(loadError instanceof Error ? loadError.message : "โหลด Booking Delivery ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { records, loading, error, retry: load };
}
