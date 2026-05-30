import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tharros Platform</h1>
      <p className="text-muted-foreground max-w-md">
        The AI operating layer for small businesses. Keep it Local, Keep it Canadian.
      </p>
      <Button>Get started</Button>
    </main>
  );
}
