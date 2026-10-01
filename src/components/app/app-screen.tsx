import { AppShell } from "./app-shell";
import type { ScreenId } from "./routes";
import { ClientQuoteScreen } from "./screens/client-quote";
import { DashboardScreen } from "./screens/dashboard";
import { EmployeeAppScreen } from "./screens/employee-app";
import { PaymentsScreen } from "./screens/payments";
import { PipelineScreen } from "./screens/pipeline";
import { ProjectBoardScreen } from "./screens/project-board";
import { QuoteBuilderScreen } from "./screens/quote-builder";
import { ServiceLibraryScreen } from "./screens/service-library";

/** Renders one app screen to fill its parent. Used by marketing screenshots. */
export function EmbeddedScreen({ screen }: { screen: ScreenId }) {
  switch (screen) {
    case "client":
      return <ClientQuoteScreen embedded />;
    case "mobile":
      return <EmployeeAppScreen />;
    default:
      return (
        <AppShell active={screen} embedded>
          {screen === "dashboard" && <DashboardScreen />}
          {screen === "quote" && <QuoteBuilderScreen />}
          {screen === "templates" && <ServiceLibraryScreen />}
          {screen === "board" && <ProjectBoardScreen />}
          {screen === "invoices" && <PaymentsScreen />}
          {screen === "crm" && <PipelineScreen />}
        </AppShell>
      );
  }
}
