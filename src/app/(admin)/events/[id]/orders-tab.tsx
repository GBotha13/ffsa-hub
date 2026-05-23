"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Order = {
  id: string;
  status: string;
  buyer_first_name: string;
  buyer_last_name: string;
  buyer_email: string;
  total_cents: number;
  refund_cents: number;
  paid_at: string | null;
  created_at: string;
  contact_resolution: string;
};

function rands(cents: number): string {
  return `R${(cents / 100).toFixed(2)}`;
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  paid: "default",
  expired: "secondary",
  cancelled: "destructive",
  refunded: "destructive",
  partially_refunded: "destructive",
};

export function OrdersTab({
  eventId,
  orders,
}: {
  eventId: string;
  orders: Order[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const paid = orders.filter((o) => o.status === "paid");
  const refunded = orders.filter(
    (o) => o.status === "refunded" || o.status === "partially_refunded"
  );
  const totalRevenueCents = paid.reduce((s, o) => s + o.total_cents, 0);
  const totalRefundedCents = refunded.reduce((s, o) => s + o.refund_cents, 0);
  const netCents = totalRevenueCents - totalRefundedCents;

  async function refund(order: Order) {
    if (
      !confirm(
        `Refund order #${order.id.slice(0, 8)} for ${rands(order.total_cents)} to ${order.buyer_email}?\n\n` +
          `This marks the order refunded, voids its tickets, and releases the inventory. ` +
          `You must process the actual money refund in PayFast separately.`
      )
    )
      return;
    setBusyId(order.id);
    setErr(null);
    const res = await fetch(
      `/api/events/${eventId}/orders/${order.id}/refund`,
      { method: "POST" }
    );
    setBusyId(null);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(data.error ?? "Refund failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Paid orders" value={paid.length.toString()} />
        <StatCard label="Revenue" value={rands(totalRevenueCents)} />
        <StatCard
          label="Net (after refunds)"
          value={rands(netCents)}
          sub={
            totalRefundedCents > 0
              ? `${rands(totalRefundedCents)} refunded`
              : null
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              No orders yet.
            </p>
          ) : (
            <>
              {err && <p className="text-xs text-red-600 mb-2">{err}</p>}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">
                        {o.id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {o.buyer_first_name} {o.buyer_last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {o.buyer_email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{rands(o.total_cents)}</div>
                        {o.refund_cents > 0 && (
                          <div className="text-xs text-muted-foreground">
                            − {rands(o.refund_cents)} refunded
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={STATUS_VARIANTS[o.status]}
                          className="capitalize"
                        >
                          {o.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {o.paid_at
                          ? new Date(o.paid_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {o.status === "paid" && (
                          <button
                            type="button"
                            onClick={() => refund(o)}
                            disabled={busyId === o.id}
                            className="text-xs text-red-600 hover:underline disabled:text-gray-300 disabled:no-underline"
                          >
                            {busyId === o.id ? "Refunding…" : "Refund"}
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
