import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getBudgetCategories,
  upsertTeamBudget,
} from "@/services/outreach-finance";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
};

/**
 * 3-pass header matching:
 * 1. Exact match (case-insensitive)
 * 2. Slug match
 * 3. Fuzzy match (contains/startsWith)
 */
function matchCategory(
  header: string,
  categories: CategoryRow[]
): CategoryRow | null {
  const headerLower = header.toLowerCase().trim();
  const headerSlug = slugify(header);

  // Pass 1: exact match
  for (const cat of categories) {
    if (cat.name.toLowerCase() === headerLower) return cat;
  }

  // Pass 2: slug match
  for (const cat of categories) {
    if (cat.slug === headerSlug) return cat;
  }

  // Pass 3: fuzzy match (header contains category name or vice versa)
  for (const cat of categories) {
    const catLower = cat.name.toLowerCase();
    if (headerLower.includes(catLower) || catLower.includes(headerLower)) {
      return cat;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { team_id, rows } = body as {
    team_id: string;
    rows: { category_name: string; category_id?: string; amount: number; people_count?: number | null }[];
  };

  if (!team_id || !rows || !Array.isArray(rows)) {
    return NextResponse.json(
      { error: "team_id and rows array are required" },
      { status: 400 }
    );
  }

  const { data: categories } = await getBudgetCategories(supabase);
  if (!categories) {
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 500 }
    );
  }

  const results: { matched: number; unmatched: string[]; errors: string[] } = {
    matched: 0,
    unmatched: [],
    errors: [],
  };

  for (const row of rows) {
    // If category_id was explicitly provided (from manual mapping), use it
    let categoryId = row.category_id;

    if (!categoryId) {
      const matched = matchCategory(row.category_name, categories);
      if (!matched) {
        results.unmatched.push(row.category_name);
        continue;
      }
      categoryId = matched.id;
    }

    const { error } = await upsertTeamBudget(supabase, {
      team_id,
      category_id: categoryId,
      budget_amount_zar: Number(row.amount),
      people_count: row.people_count ?? null,
    });

    if (error) {
      results.errors.push(`${row.category_name}: ${error.message}`);
    } else {
      results.matched++;
    }
  }

  return NextResponse.json({ success: true, results });
}
