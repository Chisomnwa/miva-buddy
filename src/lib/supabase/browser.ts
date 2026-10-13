"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseConfig } from "@/lib/config";

export function createBrowserSupabaseClient() {
  const config = getPublicSupabaseConfig();
  if (!config) throw new Error("supabase_client_unconfigured");
  return createBrowserClient(config.url, config.publishableKey);
}
