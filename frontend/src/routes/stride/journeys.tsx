import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Layout route for /stride/journeys.
 * Renders child routes via <Outlet />:
 *   /stride/journeys          → journeys/index.tsx (list)
 *   /stride/journeys/new      → journeys/new.tsx (creation form)
 *   /stride/journeys/:id      → journeys/$journeyId.tsx (detail)
 *
 * The Journeys nav item in the sidebar is correctly active for all these paths.
 */
export const Route = createFileRoute("/stride/journeys")({
  component: JourneysLayout,
});

function JourneysLayout() {
  return <Outlet />;
}
