import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertPairingRequest } from "@shared/schema";
import { z } from "zod";

export function useRequestPairing() {
  return useMutation({
    mutationFn: async (data: InsertPairingRequest) => {
      // Validate input before sending using schema
      const validated = api.pairing.request.input.parse(data);
      
      const res = await fetch(api.pairing.request.path, {
        method: api.pairing.request.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.pairing.request.responses[400].parse(json);
          throw new Error(error.message);
        }
        if (res.status === 500) {
          const error = api.pairing.request.responses[500].parse(json);
          throw new Error(error.message);
        }
        throw new Error("Failed to request pairing code");
      }

      return api.pairing.request.responses[200].parse(json);
    },
  });
}

export function usePairingStatus(phone: string | null) {
  return useQuery({
    queryKey: [api.pairing.status.path, phone],
    queryFn: async () => {
      if (!phone) throw new Error("Phone number required");
      
      const url = buildUrl(api.pairing.status.path, { phone });
      const res = await fetch(url);
      
      if (!res.ok) throw new Error("Failed to fetch pairing status");
      
      const json = await res.json();
      return api.pairing.status.responses[200].parse(json);
    },
    // Only run query if we have a phone number
    enabled: !!phone,
    // Poll every 3 seconds to check connection status
    refetchInterval: (query) => {
      // Stop polling once connected or failed
      const status = query.state.data?.status;
      if (status === "connected" || status === "failed") {
        return false;
      }
      return 3000;
    },
  });
}
