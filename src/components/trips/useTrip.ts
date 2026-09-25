"use client";

import useSWR from "swr";
import type { Trip, TripDetailResponse } from "@/lib/trips/types";
import { fetcher, send } from "@/components/trips/shared";

/**
 * One trip + its days, with a save helper for the planner lists: updates
 * the screen immediately, PATCHes the changed fields, and re-syncs.
 */
export function useTrip(id: string) {
  const swr = useSWR<TripDetailResponse>(`/api/trips/${id}`, fetcher);
  const saveTrip = async (patch: Partial<Trip>) => {
    if (swr.data) await swr.mutate({ ...swr.data, trip: { ...swr.data.trip, ...patch } }, false);
    try {
      await send(`/api/trips/${id}`, "PATCH", patch);
    } finally {
      await swr.mutate();
    }
  };
  return { ...swr, saveTrip };
}
