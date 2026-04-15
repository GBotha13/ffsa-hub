"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProgramRow = {
  id: string;
  name: string;
  code: string;
  credit_hours: number;
  status: string;
  created_at: string;
  courses?: { id: string }[];
};

export function ProgramsTable({ programs }: { programs: ProgramRow[] }) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Program</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Credit Hours</TableHead>
            <TableHead>Courses</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {programs.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center text-muted-foreground py-8"
              >
                No programs yet. Create your first program to get started.
              </TableCell>
            </TableRow>
          ) : (
            programs.map((program) => (
              <TableRow key={program.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/schools/${program.id}`}
                    className="hover:underline text-primary"
                  >
                    {program.name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {program.code}
                </TableCell>
                <TableCell>{program.credit_hours}</TableCell>
                <TableCell>{program.courses?.length ?? 0}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      program.status === "active" ? "default" : "secondary"
                    }
                  >
                    {program.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(program.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
