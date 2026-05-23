"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type QueueItem = {
  id: string;
  match_reason: string;
  confidence: string;
  created_at: string;
  library_persons: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    date_of_birth: string | null;
    phone: string | null;
  } | null;
  users: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
};

export function MatchQueueList({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No pending matches. New uploads or signups will add items here.
      </p>
    );
  }

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setErrorMessage(null);
    const res = await fetch(`/api/records-library/match-queue/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusyId(null);
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorMessage(err.error ?? `Failed to ${action}`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {errorMessage && (
        <div className="border border-red-300 bg-red-50 text-red-800 rounded-md p-3 text-sm">
          {errorMessage}
        </div>
      )}
      {items.map((item) => {
        const personName = [item.library_persons?.first_name, item.library_persons?.last_name]
          .filter(Boolean)
          .join(" ");
        const userName = [item.users?.first_name, item.users?.last_name]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={item.id} className="border rounded-md p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 text-sm flex-1">
                <div>
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    Library record
                  </span>
                  <div className="font-medium">
                    {personName || "—"}
                    {item.library_persons?.email && (
                      <span className="text-gray-500"> ({item.library_persons.email})</span>
                    )}
                  </div>
                  {item.library_persons?.date_of_birth && (
                    <div className="text-xs text-gray-600">
                      DOB: {item.library_persons.date_of_birth}
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    User
                  </span>
                  <div className="font-medium">
                    {userName || item.users?.email || "—"}
                    {userName && item.users?.email && (
                      <span className="text-gray-500"> ({item.users.email})</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-gray-600">
                  <span
                    className={`inline-block px-2 py-0.5 rounded ${
                      item.confidence === "high"
                        ? "bg-green-100 text-green-800"
                        : item.confidence === "medium"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {item.confidence}
                  </span>{" "}
                  <span>{item.match_reason}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => act(item.id, "approve")}
                  disabled={busyId === item.id}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Approve link
                </button>
                <button
                  type="button"
                  onClick={() => act(item.id, "reject")}
                  disabled={busyId === item.id}
                  className="px-3 py-1.5 border text-sm rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
