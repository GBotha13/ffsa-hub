// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = any;

// ────────────────────────────────────────────────────────────
// OUTREACH TEAMS
// ────────────────────────────────────────────────────────────

export async function getOutreachTeams(
  supabase: Client,
  options?: { programId?: string; status?: string; search?: string }
) {
  let query = supabase
    .from("outreach_teams")
    .select("*, programs(id, name, code)")
    .order("created_at", { ascending: false });

  if (options?.programId) {
    query = query.eq("program_id", options.programId);
  }
  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.search) {
    query = query.or(
      `team_name.ilike.%${options.search}%,location.ilike.%${options.search}%`
    );
  }

  return query;
}

export async function getOutreachTeamById(supabase: Client, teamId: string) {
  return supabase
    .from("outreach_teams")
    .select("*, programs(id, name, code)")
    .eq("id", teamId)
    .single();
}

export async function createOutreachTeam(
  supabase: Client,
  data: {
    program_id: string;
    team_name: string;
    location?: string | null;
    country?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    people_count?: number;
    total_budget_zar?: number;
    currency?: string;
    notes?: string | null;
    drive_folder_url?: string | null;
    created_by: string;
  }
) {
  return supabase.from("outreach_teams").insert(data).select().single();
}

export async function updateOutreachTeam(
  supabase: Client,
  teamId: string,
  data: Record<string, unknown>
) {
  return supabase
    .from("outreach_teams")
    .update(data)
    .eq("id", teamId)
    .select()
    .single();
}

// ────────────────────────────────────────────────────────────
// TEAM MEMBERS
// ────────────────────────────────────────────────────────────

export async function getTeamMembers(supabase: Client, teamId: string) {
  return supabase
    .from("outreach_team_members")
    .select(
      "*, users!outreach_team_members_user_id_fkey(id, first_name, last_name, preferred_name, email)"
    )
    .eq("team_id", teamId)
    .order("role", { ascending: true });
}

export async function addTeamMember(
  supabase: Client,
  data: { team_id: string; user_id: string; role: string }
) {
  return supabase
    .from("outreach_team_members")
    .insert(data)
    .select()
    .single();
}

export async function updateTeamMemberRole(
  supabase: Client,
  id: string,
  role: string
) {
  return supabase
    .from("outreach_team_members")
    .update({ role })
    .eq("id", id)
    .select()
    .single();
}

export async function removeTeamMember(supabase: Client, id: string) {
  return supabase.from("outreach_team_members").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// BUDGET CATEGORIES
// ────────────────────────────────────────────────────────────

export async function getBudgetCategories(supabase: Client) {
  return supabase
    .from("outreach_budget_categories")
    .select("*")
    .order("sort_order", { ascending: true });
}

// ────────────────────────────────────────────────────────────
// TEAM BUDGETS
// ────────────────────────────────────────────────────────────

export async function getTeamBudgets(supabase: Client, teamId: string) {
  return supabase
    .from("outreach_team_budgets")
    .select("*, outreach_budget_categories(id, name, slug, sort_order)")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });
}

export async function upsertTeamBudget(
  supabase: Client,
  data: {
    team_id: string;
    category_id: string;
    budget_amount_zar: number;
    people_count?: number | null;
    notes?: string | null;
  }
) {
  return supabase
    .from("outreach_team_budgets")
    .upsert(data, { onConflict: "team_id,category_id" })
    .select()
    .single();
}

export async function deleteTeamBudget(supabase: Client, id: string) {
  return supabase.from("outreach_team_budgets").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// EXPENSES
// ────────────────────────────────────────────────────────────

export async function getTeamExpenses(supabase: Client, teamId: string) {
  return supabase
    .from("outreach_expenses")
    .select("*, outreach_budget_categories(id, name, slug)")
    .eq("team_id", teamId)
    .order("expense_date", { ascending: false });
}

export async function createExpense(
  supabase: Client,
  data: {
    team_id: string;
    category_id: string;
    expense_date: string;
    receipt_code?: string | null;
    vendor?: string | null;
    description?: string | null;
    purchaser?: string | null;
    payment_method?: string;
    country?: string | null;
    local_currency?: string | null;
    local_amount?: number | null;
    zar_amount: number;
    exchange_rate?: number | null;
    cash_batch_id?: string | null;
    receipt_path?: string | null;
    notes?: string | null;
    created_by: string;
  }
) {
  return supabase.from("outreach_expenses").insert(data).select().single();
}

export async function updateExpense(
  supabase: Client,
  id: string,
  data: Record<string, unknown>
) {
  return supabase
    .from("outreach_expenses")
    .update(data)
    .eq("id", id)
    .select()
    .single();
}

export async function deleteExpense(supabase: Client, id: string) {
  return supabase.from("outreach_expenses").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// FUND RELEASES
// ────────────────────────────────────────────────────────────

export async function getTeamFundReleases(supabase: Client, teamId: string) {
  return supabase
    .from("outreach_fund_releases")
    .select("*")
    .eq("team_id", teamId)
    .order("release_date", { ascending: false });
}

export async function createFundRelease(
  supabase: Client,
  data: {
    team_id: string;
    label: string;
    release_date?: string | null;
    amount_zar: number;
    currency?: string;
    method?: string;
    recipient?: string | null;
    notes?: string | null;
    created_by: string;
  }
) {
  return supabase.from("outreach_fund_releases").insert(data).select().single();
}

export async function updateFundRelease(
  supabase: Client,
  id: string,
  data: Record<string, unknown>
) {
  return supabase
    .from("outreach_fund_releases")
    .update(data)
    .eq("id", id)
    .select()
    .single();
}

export async function deleteFundRelease(supabase: Client, id: string) {
  return supabase.from("outreach_fund_releases").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// CASH BATCHES
// ────────────────────────────────────────────────────────────

export async function getTeamCashBatches(supabase: Client, teamId: string) {
  return supabase
    .from("outreach_cash_batches")
    .select("*")
    .eq("team_id", teamId)
    .order("batch_date", { ascending: false });
}

export async function createCashBatch(
  supabase: Client,
  data: {
    team_id: string;
    batch_date: string;
    zar_withdrawn: number;
    bank_fee?: number;
    local_currency?: string | null;
    local_currency_received?: number | null;
    exchange_rate?: number | null;
    notes?: string | null;
    created_by: string;
  }
) {
  return supabase.from("outreach_cash_batches").insert(data).select().single();
}

export async function updateCashBatch(
  supabase: Client,
  id: string,
  data: Record<string, unknown>
) {
  return supabase
    .from("outreach_cash_batches")
    .update(data)
    .eq("id", id)
    .select()
    .single();
}

export async function deleteCashBatch(supabase: Client, id: string) {
  return supabase.from("outreach_cash_batches").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// RECEIPTS
// ────────────────────────────────────────────────────────────

export async function getExpenseReceipts(supabase: Client, expenseId: string) {
  return supabase
    .from("outreach_receipts")
    .select("*")
    .eq("expense_id", expenseId)
    .order("uploaded_at", { ascending: false });
}

export async function createReceipt(
  supabase: Client,
  data: {
    expense_id: string;
    file_path: string;
    file_name: string;
    file_size: number;
    mime_type: string;
    uploaded_by: string;
  }
) {
  return supabase.from("outreach_receipts").insert(data).select().single();
}

export async function deleteReceipt(supabase: Client, id: string) {
  return supabase.from("outreach_receipts").delete().eq("id", id);
}

// ────────────────────────────────────────────────────────────
// CLOSEOUTS
// ────────────────────────────────────────────────────────────

export async function getTeamCloseout(supabase: Client, teamId: string) {
  return supabase
    .from("outreach_closeouts")
    .select("*, users!outreach_closeouts_closed_by_fkey(id, first_name, last_name)")
    .eq("team_id", teamId)
    .maybeSingle();
}

export async function upsertCloseout(
  supabase: Client,
  data: {
    team_id: string;
    total_funds_sent: number;
    total_spent: number;
    cash_remaining: number;
    funds_returned: number;
    variance: number;
    variance_pct: number;
    status: string;
    admin_notes?: string | null;
    closed_by?: string | null;
    closed_at?: string | null;
  }
) {
  return supabase
    .from("outreach_closeouts")
    .upsert(data, { onConflict: "team_id" })
    .select()
    .single();
}

export async function updateCloseoutStatus(
  supabase: Client,
  teamId: string,
  data: {
    status: string;
    admin_notes?: string | null;
    closed_by?: string | null;
    closed_at?: string | null;
  }
) {
  return supabase
    .from("outreach_closeouts")
    .update(data)
    .eq("team_id", teamId)
    .select()
    .single();
}

// ────────────────────────────────────────────────────────────
// AGGREGATE FINANCIALS (for all-teams dashboard)
// ────────────────────────────────────────────────────────────

export async function getAggregateFinancials(supabase: Client) {
  const [
    { data: expenses },
    { data: releases },
    { data: budgets },
    { data: closeouts },
    { data: budgetDetails },
    { data: expenseDetails },
  ] = await Promise.all([
    supabase.from("outreach_expenses").select("team_id, zar_amount"),
    supabase.from("outreach_fund_releases").select("team_id, amount_zar"),
    supabase.from("outreach_team_budgets").select("team_id, budget_amount_zar"),
    supabase.from("outreach_closeouts").select("team_id, status"),
    supabase
      .from("outreach_team_budgets")
      .select(
        "team_id, category_id, budget_amount_zar, outreach_budget_categories(id, name, slug, sort_order)"
      ),
    supabase
      .from("outreach_expenses")
      .select("team_id, category_id, zar_amount"),
  ]);

  const sumByTeam = (
    rows: { team_id: string; [key: string]: unknown }[] | null,
    field: string
  ): Record<string, number> => {
    const map: Record<string, number> = {};
    if (!rows) return map;
    for (const row of rows) {
      const tid = row.team_id;
      map[tid] = (map[tid] || 0) + Number(row[field] || 0);
    }
    return map;
  };

  // Group budget details by team
  const budgetDetailsByTeam: Record<
    string,
    Array<{
      category_id: string;
      name: string;
      sort_order: number;
      budget_amount_zar: number;
    }>
  > = {};
  for (const row of budgetDetails ?? []) {
    const tid = row.team_id;
    if (!budgetDetailsByTeam[tid]) budgetDetailsByTeam[tid] = [];
    const cat = row.outreach_budget_categories as {
      id: string;
      name: string;
      slug: string;
      sort_order: number;
    } | null;
    budgetDetailsByTeam[tid].push({
      category_id: row.category_id,
      name: cat?.name ?? "Unknown",
      sort_order: cat?.sort_order ?? 0,
      budget_amount_zar: Number(row.budget_amount_zar),
    });
  }

  // Group expense details by team → category
  const expenseDetailsByTeam: Record<string, Record<string, number>> = {};
  for (const row of expenseDetails ?? []) {
    const tid = row.team_id;
    if (!expenseDetailsByTeam[tid]) expenseDetailsByTeam[tid] = {};
    expenseDetailsByTeam[tid][row.category_id] =
      (expenseDetailsByTeam[tid][row.category_id] || 0) +
      Number(row.zar_amount);
  }

  return {
    expensesByTeam: sumByTeam(expenses, "zar_amount"),
    releasesByTeam: sumByTeam(releases, "amount_zar"),
    budgetsByTeam: sumByTeam(budgets, "budget_amount_zar"),
    closeoutsByTeam: (closeouts ?? []).reduce(
      (acc: Record<string, string>, row: { team_id: string; status: string }) => {
        acc[row.team_id] = row.status;
        return acc;
      },
      {} as Record<string, string>
    ),
    budgetDetailsByTeam,
    expenseDetailsByTeam,
  };
}

// ────────────────────────────────────────────────────────────
// PORTAL — MY TEAMS
// ────────────────────────────────────────────────────────────

export async function getMyOutreachTeams(supabase: Client, userId: string) {
  return supabase
    .from("outreach_team_members")
    .select(
      "*, outreach_teams(*, programs(id, name, code))"
    )
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
}
