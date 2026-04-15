import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database";

// The Supabase client type that matches what createServerClient<Database> returns
export type TypedSupabaseClient = ReturnType<typeof createClient<Database>>;
