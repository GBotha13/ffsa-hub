import type { Database, Json } from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

export async function createAuditLog(
  supabase: Client,
  data: {
    action: string;
    resource_type: string;
    resource_id: string;
    changes?: Record<string, unknown> | null;
  }
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return supabase.from("audit_logs").insert({
    user_id: user?.id ?? null,
    action: data.action,
    resource_type: data.resource_type,
    resource_id: data.resource_id,
    changes: (data.changes as Json) ?? null,
  });
}

export async function getAuditLogs(
  supabase: Client,
  options?: {
    resource_type?: string;
    resource_id?: string;
    limit?: number;
    offset?: number;
  }
) {
  let query = supabase
    .from("audit_logs")
    .select("*, users(display_name, first_name, last_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (options?.resource_type) {
    query = query.eq("resource_type", options.resource_type);
  }

  if (options?.resource_id) {
    query = query.eq("resource_id", options.resource_id);
  }

  if (options?.limit) {
    const from = options.offset ?? 0;
    query = query.range(from, from + options.limit - 1);
  }

  return query;
}
