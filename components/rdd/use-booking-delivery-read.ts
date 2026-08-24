"use client";

import { useCallback, useEffect, useState } from "react";
import type { BookingDeliveryRecord } from "@/lib/types";

export function useBookingDeliveryRead() {
  const [records, setRecords] = useState<BookingDeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/booking-delivery?scope=all", { cache: "no-store", method: "GET" });
      const data = (await response.json()) as { records?: BookingDeliveryRecord[]; revision?: string; error?: string; warning?: string };
      if (!response.ok) throw new Error(data.error || data.warning || "โหลด Booking Delivery ไม่สำเร็จ");
      setRecords(Array.isArray(data.records) ? data.records : []);
      setRevision(String(data.revision || ""));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลด Booking Delivery ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replaceRecord = useCallback((record: BookingDeliveryRecord, nextRevision: string) => {
    setRecords((current) => current.map((item) => item.id === record.id ? record : item));
    setRevision(nextRevision);
  }, []);

  return { records, revision, loading, error, retry: load, replaceRecord };
}
