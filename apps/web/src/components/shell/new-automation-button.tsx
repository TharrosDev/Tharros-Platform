"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/**
 * Dashboard primary action. For now it just demonstrates the toast primitive —
 * the real automation builder lands in a later phase.
 */
function NewAutomationButton() {
  const toast = useToast();

  return (
    <Button
      size="lg"
      onClick={() =>
        toast.add({
          title: "Coming soon",
          description: "Building automations lands in a later phase.",
        })
      }
    >
      <Plus />
      New automation
    </Button>
  );
}

export { NewAutomationButton };
