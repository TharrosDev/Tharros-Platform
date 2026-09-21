import { X } from "lucide-react";

import type { KnowledgeGaps } from "@/lib/assistant/insights";
import type { Collection, Location } from "@/lib/enterprise/queries";
import {
  createCollection,
  deleteCollection,
  setDocumentCollection,
} from "@/lib/enterprise/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const ROLE_LABEL = { member: "Everyone", admin: "Admins and owners", owner: "Owners only" };

/** Owner/admin view of what the assistant couldn't answer or got marked unhelpful. */
export function KnowledgeGapsCard({ gaps }: { gaps: KnowledgeGaps }) {
  if (gaps.misses.length === 0 && gaps.unhelpful.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge gaps</CardTitle>
        <CardDescription>
          From the last 30 days. Upload documents that cover these so the assistant can answer.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">Searches with no answer</h3>
          {gaps.misses.length ? (
            <ul className="text-muted-foreground space-y-1.5 text-sm">
              {gaps.misses.map((m) => (
                <li key={m.query + m.at}>&ldquo;{m.query}&rdquo;</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">None.</p>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Answers marked unhelpful</h3>
          {gaps.unhelpful.length ? (
            <ul className="text-muted-foreground space-y-2 text-sm">
              {gaps.unhelpful.map((u) => (
                <li key={u.at} className="line-clamp-2">
                  {u.answer}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">None.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Enterprise: collections restrict who can read a document (by role and location). */
export function CollectionsCard({
  collections,
  locations,
  documents,
}: {
  collections: Collection[];
  locations: Location[];
  documents: { id: string; filename: string; collectionId: string | null }[];
}) {
  const locationName = new Map(locations.map((l) => [l.id, l.name]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Collections</CardTitle>
        <CardDescription>
          Documents outside a collection are readable by everyone in the organization. Put a
          document in a collection to limit it by role or location. This applies to the
          assistant&apos;s answers too.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {collections.length ? (
          <ul className="divide-y text-sm">
            {collections.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {ROLE_LABEL[c.minRole]}
                  {c.locationId ? ` · ${locationName.get(c.locationId) ?? "location"}` : ""}
                </span>
                <span className="text-muted-foreground ml-auto">
                  {documents.filter((d) => d.collectionId === c.id).length} docs
                </span>
                <form action={deleteCollection}>
                  <input type="hidden" name="id" value={c.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${c.name}`}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <X className="size-4" />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}

        <form action={createCollection} className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label htmlFor="collection-name" className="mb-1 block text-xs font-medium">
              New collection
            </label>
            <Input id="collection-name" name="name" placeholder="e.g. HR policies" required />
          </div>
          <NativeSelect name="minRole" aria-label="Who can read it" className="w-48">
            <option value="member">{ROLE_LABEL.member}</option>
            <option value="admin">{ROLE_LABEL.admin}</option>
            <option value="owner">{ROLE_LABEL.owner}</option>
          </NativeSelect>
          <NativeSelect name="locationId" aria-label="Location" className="w-48">
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline">
            Create
          </Button>
        </form>

        {collections.length && documents.length ? (
          <form action={setDocumentCollection} className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <label htmlFor="assign-doc" className="mb-1 block text-xs font-medium">
                Move a document
              </label>
              <NativeSelect id="assign-doc" name="documentId">
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <NativeSelect name="collectionId" aria-label="Collection" className="w-48">
              <option value="">No collection (everyone)</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" variant="outline">
              Move
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
