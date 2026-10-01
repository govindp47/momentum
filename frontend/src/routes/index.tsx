import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MomentumDashboard } from "@/components/dashboard/momentum-dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Momentum" },
      {
        name: "description",
        content:
          "Your personal Momentum dashboard — commitments, journeys, and today's activity.",
      },
      { property: "og:title", content: "Momentum" },
      {
        property: "og:description",
        content:
          "Your personal Momentum dashboard — commitments, journeys, and today's activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppShell subApp="dashboard">
      <MomentumDashboard />
    </AppShell>
  );
}
