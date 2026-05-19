"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import type { Tables } from "@/types/database";
import { getLabelColors } from "@/lib/label-color";
type PersonType = Tables<"person_types">;

interface ContactsListProps {
  contacts: Array<{
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    marketing_status?: string | null;
    date_of_birth?: string | null;
    marital_status?: string | null;
    gender?: string | null;
    nationality?: string | null;
    city?: string | null;
    country?: string | null;
    preferred_language?: string | null;
    source?: string | null;
    last_interaction_at?: string | null;
    person_type_assignments?: Array<{
      person_types: { name: string } | null;
    }>;
    contact_labels?: Array<{
      labels: { id: string; slug: string; name: string; color: string | null } | null;
    }>;
  }>;
  personTypes: PersonType[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  searchQuery?: string;
  statusFilter: string;
}

export function ContactsList({
  contacts,
  totalCount,
  currentPage,
  pageSize,
  searchQuery,
  statusFilter,
}: ContactsListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchQuery ?? "");

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search) {
      params.set("search", search);
    } else {
      params.delete("search");
    }
    params.delete("page");
    router.push(`/contacts?${params.toString()}`);
  }

  function handleStatusFilter(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", status);
    params.delete("page");
    router.push(`/contacts?${params.toString()}`);
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  function displayName(contact: ContactsListProps["contacts"][0]) {
    if (contact.preferred_name) {
      return `${contact.preferred_name} ${contact.last_name}`;
    }
    return `${contact.first_name} ${contact.last_name}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <form onSubmit={handleSearch} className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-1">
          {["active", "inactive", "archived"].map((status) => (
            <Button
              key={status}
              variant={statusFilter === status ? "default" : "ghost"}
              size="sm"
              onClick={() => handleStatusFilter(status)}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>

        <Link href="/contacts/new">
          <Button size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        </Link>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Name</TableHead>
              <TableHead className="whitespace-nowrap">Email</TableHead>
              <TableHead className="whitespace-nowrap">Phone</TableHead>
              <TableHead className="whitespace-nowrap">Labels</TableHead>
              <TableHead className="whitespace-nowrap">DOB</TableHead>
              <TableHead className="whitespace-nowrap">Marital</TableHead>
              <TableHead className="whitespace-nowrap">City</TableHead>
              <TableHead className="whitespace-nowrap">Country</TableHead>
              <TableHead className="whitespace-nowrap">Nationality</TableHead>
              <TableHead className="whitespace-nowrap">Marketing</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="whitespace-nowrap">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium hover:underline"
                    >
                      {displayName(contact)}
                    </Link>
                    {contact.preferred_name && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({contact.first_name})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {contact.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {contact.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap min-w-[140px]">
                      {contact.contact_labels?.slice(0, 4).map((cl) => {
                        if (!cl.labels) return null;
                        const colors = getLabelColors(cl.labels);
                        return (
                          <span
                            key={cl.labels.id}
                            className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-full border font-medium whitespace-nowrap"
                            style={{
                              backgroundColor: colors.bg,
                              color: colors.text,
                              borderColor: colors.border,
                            }}
                          >
                            {cl.labels.name}
                          </span>
                        );
                      })}
                      {(contact.contact_labels?.length ?? 0) > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{(contact.contact_labels?.length ?? 0) - 4}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {contact.date_of_birth
                      ? new Date(contact.date_of_birth).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize whitespace-nowrap">
                    {contact.marital_status ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {contact.city ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {contact.country ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {contact.nationality ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <MarketingChip status={contact.marketing_status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant={contact.status === "active" ? "default" : "outline"}
                      className="capitalize"
                    >
                      {contact.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={`/contacts?${new URLSearchParams({
                  ...Object.fromEntries(searchParams.entries()),
                  page: String(currentPage - 1),
                }).toString()}`}
              >
                <Button variant="outline" size="sm">
                  Previous
                </Button>
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/contacts?${new URLSearchParams({
                  ...Object.fromEntries(searchParams.entries()),
                  page: String(currentPage + 1),
                }).toString()}`}
              >
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketingChip({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const cls =
    status === "subscribed"
      ? "bg-green-100 text-green-800 border-green-300"
      : status === "unsubscribed_all"
      ? "bg-red-100 text-red-800 border-red-300"
      : status === "bounced"
      ? "bg-orange-100 text-orange-800 border-orange-300"
      : "bg-gray-100 text-gray-700 border-gray-300";
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border ${cls}`}>
      {status.replace("_", " ")}
    </span>
  );
}
