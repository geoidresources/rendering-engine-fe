import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/http";
import type { UserRecord } from "@/types/api";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await apiClient.get<UserRecord[]>("/api/v1/users");
      return res.data;
    },
  });
}
