import type { ReactNode } from "react";

import {
  APPLICATION_IDENTITIES,
  ApplicationIcon,
} from "@/components/application-identity";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AuthPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background bg-dot-pattern px-4 py-10 text-foreground">
      <div className="w-full max-w-xs">
        <div className="mb-8 flex items-center justify-center gap-2.5 text-xl font-semibold">
          <ApplicationIcon application="momentum" />
          {APPLICATION_IDENTITIES.momentum.label}
        </div>

        <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </main>
  );
}
