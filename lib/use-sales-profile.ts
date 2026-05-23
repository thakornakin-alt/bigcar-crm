"use client";

import { useEffect, useState } from "react";
import type { SalesUser } from "@/lib/types";

export function useSalesProfile() {
  const [user, setUser] = useState<SalesUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = (await response.json()) as { user?: SalesUser | null };
        if (alive) setUser(data.user || null);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  return { user, loading, setUser };
}
