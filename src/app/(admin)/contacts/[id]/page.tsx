import { createClient } from "@/lib/supabase/server";
import { getContactById } from "@/services/contacts";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact, error } = await getContactById(supabase, id);
  if (error || !contact) notFound();

  const personTypes =
    contact.person_type_assignments?.map(
      (pta: { person_types: { name: string; id: string } | null }) =>
        pta.person_types
    ) ?? [];

  const tags =
    contact.person_tags?.map(
      (pt: { tags: { name: string; id: string; category: string | null } | null }) =>
        pt.tags
    ) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {contact.preferred_name ?? contact.first_name} {contact.last_name}
          </h1>
          {contact.preferred_name && (
            <p className="text-sm text-muted-foreground">
              Legal name: {contact.first_name} {contact.last_name}
            </p>
          )}
        </div>
        <Badge
          variant={contact.status === "active" ? "default" : "outline"}
          className="capitalize"
        >
          {contact.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Email
                  </p>
                  <p className="text-sm">{contact.email ?? "Not provided"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Phone
                  </p>
                  <p className="text-sm">{contact.phone ?? "Not provided"}</p>
                </div>
              </div>

              {(contact.address_line_1 || contact.city || contact.country) && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Address
                  </p>
                  <p className="text-sm whitespace-pre-line">
                    {[
                      contact.address_line_1,
                      contact.address_line_2,
                      [contact.city, contact.province]
                        .filter(Boolean)
                        .join(", "),
                      contact.postal_code,
                      contact.country,
                    ]
                      .filter(Boolean)
                      .join("\n")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {contact.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Types</CardTitle>
            </CardHeader>
            <CardContent>
              {personTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No types assigned
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {personTypes.map(
                    (pt: { id: string; name: string } | null) =>
                      pt && (
                        <Badge
                          key={pt.id}
                          variant="secondary"
                          className="capitalize"
                        >
                          {pt.name}
                        </Badge>
                      )
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent>
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {tags.map(
                    (
                      tag: {
                        id: string;
                        name: string;
                        category: string | null;
                      } | null
                    ) =>
                      tag && (
                        <Badge key={tag.id} variant="outline">
                          {tag.name}
                        </Badge>
                      )
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
