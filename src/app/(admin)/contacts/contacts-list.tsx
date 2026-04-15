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
import type { PersonType } from "@/types/database";

interface ContactsListProps {
  contacts: Array<{
    id: string;
    first_name: string;
    last_name: string;
    preferred_name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
    person_type_assignments?: Array<{
      person_types: { name: string } | null;
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

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Types</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
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
                  <TableCell className="text-muted-foreground">
                    {contact.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contact.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {contact.person_type_assignments?.map((pta) =>
                        pta.person_types ? (
                          <Badge
                            key={pta.person_types.name}
                            variant="secondary"
                            className="text-xs capitalize"
                          >
                            {pta.person_types.name}
                          </Badge>
                        ) : null
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
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
