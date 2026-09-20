"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormMessage } from "@/components/auth/auth-card";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignRole,
  createRoleCertification,
  removeRoleAssignment,
} from "@/lib/employees/role-actions";
import type { ProfileRole } from "@/lib/employees/queries";
import type { RoleCertification } from "@/lib/scheduling/queries";

const PICK = "__pick__";

export function RoleManager({
  employeeId,
  roles,
  catalog,
  canManage,
}: {
  employeeId: string;
  roles: ProfileRole[];
  catalog: RoleCertification[];
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = React.useTransition();
  const [selected, setSelected] = React.useState<string>(PICK);
  const [expiresAt, setExpiresAt] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const assigned = new Set(roles.map((r) => r.roleCertificationId));
  const available = catalog.filter((c) => !assigned.has(c.id));

  function add() {
    if (selected === PICK) return;
    setError(null);
    start(async () => {
      const res = await assignRole({ employeeId, roleCertificationId: selected, expiresAt });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.add({ title: "Roles", description: "Role assigned." });
      setSelected(PICK);
      setExpiresAt("");
      router.refresh();
    });
  }

  function remove(assignmentId: string) {
    start(async () => {
      const res = await removeRoleAssignment(assignmentId, employeeId);
      if (!res.ok) {
        toast.add({ title: "Couldn't remove", description: res.message });
        return;
      }
      toast.add({ title: "Roles", description: "Role removed." });
      router.refresh();
    });
  }

  return (
    <section className="bg-card space-y-4 border p-5">
      <h2 className="text-sm font-medium">Role certifications</h2>

      {roles.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <li key={r.assignmentId}>
              <Badge
                variant={r.kind === "certification" ? "info" : "secondary"}
                className="gap-1.5"
              >
                {r.name}
                {r.expiresAt ? <span className="opacity-70">· exp {r.expiresAt}</span> : null}
                {canManage ? (
                  <button
                    type="button"
                    aria-label={`Remove ${r.name}`}
                    onClick={() => remove(r.assignmentId)}
                    disabled={pending}
                    className="hover:text-destructive ml-0.5"
                  >
                    <Trash2 className="size-3" />
                  </button>
                ) : null}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">No roles or certifications assigned yet.</p>
      )}

      {canManage ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Assign a role/cert</span>
            <Select value={selected} onValueChange={(v) => setSelected(v ?? PICK)}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Pick a role…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PICK}>Pick a role…</SelectItem>
                {available.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Expires (optional)</span>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-40"
            />
          </label>
          <Button type="button" onClick={add} disabled={pending || selected === PICK}>
            <Plus className="size-4" /> Assign
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setCreating(true)}
            disabled={pending}
          >
            New role/cert
          </Button>
        </div>
      ) : null}

      {error ? <FormMessage>{error}</FormMessage> : null}

      {creating ? (
        <CreateRoleDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      ) : null}
    </section>
  );
}

function CreateRoleDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [pending, start] = React.useTransition();
  const [name, setName] = React.useState("");
  const [kind, setKind] = React.useState<"role" | "certification">("role");
  const [error, setError] = React.useState<string | null>(null);

  function create() {
    setError(null);
    start(async () => {
      const res = await createRoleCertification({ name, kind });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      toast.add({ title: "Catalog", description: `${name} added.` });
      onCreated();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New role or certification</DialogTitle>
          <DialogDescription>
            Add it to your org catalog, then assign it from the dropdown.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shift Lead, Food Handler"
              maxLength={80}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-muted-foreground text-xs font-medium">Type</span>
            <Select
              value={kind}
              onValueChange={(v) => setKind((v as "role" | "certification") ?? "role")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role">Role</SelectItem>
                <SelectItem value="certification">Certification</SelectItem>
              </SelectContent>
            </Select>
          </label>
          {error ? <FormMessage>{error}</FormMessage> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={create} disabled={pending || name.trim().length === 0}>
            {pending ? "Adding…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
