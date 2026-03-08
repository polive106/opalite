import { QueryClient } from "@tanstack/react-query";

/**
 * Creates a QueryClient configured for testing.
 *
 * Key differences from production:
 * - retry: false — tests should fail immediately, not retry
 * - staleTime: 0 — no implicit caching unless explicitly tested
 * - gcTime: Infinity — prevent garbage collection during test assertions
 *
 * Usage:
 *   const queryClient = createTestQueryClient();
 *   // ... use in QueryClientProvider or call queryClient.fetchQuery() directly
 *   // Clean up after test: queryClient.clear();
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
