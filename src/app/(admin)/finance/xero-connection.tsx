"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type RegionStatus =
  | { connected: false }
  | { connected: true; tenantName: string | null; expiresAt: string };

type XeroStatusResponse = {
  za: RegionStatus;
  us: RegionStatus;
};

const REGION_CONFIG = {
  za: { label: "South Africa", flag: "🇿🇦", currency: "ZAR" },
  us: { label: "United States", flag: "🇺🇸", currency: "USD" },
} as const;

type Region = keyof typeof REGION_CONFIG;

export function XeroConnection() {
  const [status, setStatus] = useState<XeroStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<Region | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const xero = searchParams.get("xero");
    if (xero === "connected") {
      const org = searchParams.get("org");
      const region = searchParams.get("region");
      toast.success(
        `Connected to Xero${region ? ` (${region})` : ""}${org ? ` — ${org}` : ""}`
      );
    } else if (xero === "error") {
      const msg = searchParams.get("message");
      toast.error(`Xero connection failed: ${msg || "Unknown error"}`);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/integrations/xero/status")
      .then((r) => r.json())
      .then((data) => setStatus(data))
      .catch(() => setStatus({ za: { connected: false }, us: { connected: false } }))
      .finally(() => setLoading(false));
  }, []);

  async function handleDisconnect(region: Region) {
    setDisconnecting(region);
    try {
      const res = await fetch("/api/integrations/xero/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region }),
      });
      if (res.ok) {
        toast.success(`Xero ${REGION_CONFIG[region].label} disconnected`);
        setStatus((prev) =>
          prev ? { ...prev, [region]: { connected: false } } : prev
        );
      } else {
        toast.error("Failed to disconnect");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setDisconnecting(null);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">
            Checking Xero connections...
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.41 14.59L7.17 13.17l1.41-1.41 2.01 2.01 5.84-5.84 1.41 1.41-7.25 7.25z"
              fill={
                status?.za.connected || status?.us.connected
                  ? "#13B5EA"
                  : "#94a3b8"
              }
            />
          </svg>
          Xero Integration
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          Connect your Xero accounts to automatically create and email invoices.
          American students are invoiced through the US account (USD), all others
          through the SA account (ZAR).
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {(["za", "us"] as const).map((region) => {
            const cfg = REGION_CONFIG[region];
            const regionStatus = status?.[region];
            const isConnected = regionStatus?.connected === true;

            return (
              <div
                key={region}
                className={`rounded-lg border p-4 ${
                  isConnected
                    ? "border-[#13B5EA]/30 bg-[#13B5EA]/5"
                    : "border-dashed"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    {cfg.flag} {cfg.label}
                  </span>
                  {isConnected ? (
                    <Badge className="bg-[#13B5EA] text-white text-xs">
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Not Connected
                    </Badge>
                  )}
                </div>

                {isConnected && regionStatus.connected ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {regionStatus.tenantName ?? "Xero Organization"} •{" "}
                      {cfg.currency}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => handleDisconnect(region)}
                      disabled={disconnecting === region}
                    >
                      {disconnecting === region
                        ? "Disconnecting..."
                        : "Disconnect"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Invoices in {cfg.currency}
                    </p>
                    <Button asChild size="sm" className="w-full">
                      <a href={`/api/integrations/xero/connect?region=${region}`}>
                        Connect {cfg.label} Account
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
