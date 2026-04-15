import { NextResponse } from "next/server";

// In-memory cache: key = "FROM-TO-DATE", value = rate
const rateCache = new Map<string, number>();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get("from") || "").toUpperCase();
  const to = (searchParams.get("to") || "ZAR").toUpperCase();

  if (!from || !to) {
    return NextResponse.json(
      { error: "from and to currency codes are required" },
      { status: 400 }
    );
  }

  if (from === to) {
    return NextResponse.json({ rate: 1, from, to, date: today() });
  }

  const dateStr = today();
  const cacheKey = `${from}-${to}-${dateStr}`;

  const cached = rateCache.get(cacheKey);
  if (cached !== undefined) {
    return NextResponse.json({ rate: cached, from, to, date: dateStr });
  }

  try {
    // Fetch rates with base = from currency
    const res = await fetch(
      `https://open.er-api.com/v6/latest/${from}`,
      { next: { revalidate: 86400 } } // cache for 24 hours
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch exchange rate" },
        { status: 502 }
      );
    }

    const data = await res.json();

    if (data.result !== "success" || !data.rates?.[to]) {
      return NextResponse.json(
        { error: `Rate not found for ${from} → ${to}` },
        { status: 404 }
      );
    }

    // Rate = 1 unit of FROM = X units of TO
    const rate = data.rates[to];
    rateCache.set(cacheKey, rate);

    return NextResponse.json({ rate, from, to, date: dateStr });
  } catch {
    return NextResponse.json(
      { error: "Exchange rate service unavailable" },
      { status: 502 }
    );
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
