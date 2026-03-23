import useSWR from "swr";
import { fetcher } from "../lib/api";

/** Poll an API endpoint every `intervalMs` milliseconds */
export function usePolling<T>(url: string, intervalMs = 30000) {
  const { data, error, isLoading, mutate } = useSWR<T>(url, fetcher, {
    refreshInterval: intervalMs,
    revalidateOnFocus: true,
  });
  return { data, error, isLoading, refresh: mutate };
}
