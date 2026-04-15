// `/api/v1/users` wraps rows in the `{data, pagination}` envelope. Unwrap
// via the shared helper so the /users page's table sees a plain array.

import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrapList } from "@/lib/http";
import type { ListEnvelope, UserRecord } from "@/types/api";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await apiClient.get<ListEnvelope<UserRecord>>(
        "/api/v1/users",
      );
      return unwrapList<UserRecord>(res.data);
    },
  });
}
