import { Sparkles } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function AssistantPage() {
  return (
    <>
      <PageHeader
        title="AI Assistant"
        description="Answers your customers in plain language, day or night."
      />
      <ComingSoon
        icon={Sparkles}
        message="Your AI Assistant will live here. Train it on your business and let it handle enquiries around the clock. Landing in a later phase."
      />
    </>
  );
}
