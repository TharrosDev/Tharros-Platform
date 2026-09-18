import Link from "next/link";
import { Workflow } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Automations are not shipped yet. The dashboard must not present a control
 * that pretends to create one, so this action navigates to the transparent
 * roadmap surface instead of firing a fake success/coming-soon toast.
 */
function NewAutomationButton() {
  return (
    <Link
      href="/automations"
      className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
    >
      <Workflow />
      Automation roadmap
    </Link>
  );
}

export { NewAutomationButton };
