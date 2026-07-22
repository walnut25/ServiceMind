import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/login/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ForbiddenPage } from "@/pages/errors/ForbiddenPage";
import { NotFoundPage } from "@/pages/errors/NotFoundPage";
import { TicketListPage } from "@/pages/tickets/TicketListPage";
import { NewTicketPage } from "@/pages/tickets/NewTicketPage";
import { TicketDetailPage } from "@/pages/tickets/TicketDetailPage";
import { ArticleListPage } from "@/pages/knowledge/ArticleListPage";
import { ArticleDetailPage } from "@/pages/knowledge/ArticleDetailPage";
import { ArticleEditPage } from "@/pages/knowledge/ArticleEditPage";
import { AssistantPage } from "@/pages/assistant/AssistantPage";
import { PlaceholderPage } from "@/components/common/PlaceholderPage";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthGuard } from "./AuthGuard";
import { RoleGuard } from "./RoleGuard";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403" element={<ForbiddenPage />} />

      <Route
        element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/tickets" element={<TicketListPage />} />
        <Route path="/tickets/new" element={<NewTicketPage />} />
        <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />

        <Route path="/knowledge" element={<ArticleListPage />} />
        <Route
          path="/knowledge/new"
          element={
            <RoleGuard roles={["ADMIN", "AGENT"]}>
              <ArticleEditPage />
            </RoleGuard>
          }
        />
        <Route path="/knowledge/:articleId" element={<ArticleDetailPage />} />
        <Route
          path="/knowledge/:articleId/edit"
          element={
            <RoleGuard roles={["ADMIN", "AGENT"]}>
              <ArticleEditPage />
            </RoleGuard>
          }
        />

        <Route path="/assistant" element={<AssistantPage />} />

        <Route
          path="/admin/users"
          element={
            <RoleGuard roles={["ADMIN"]}>
              <PlaceholderPage title="\u7528\u6237\u7ba1\u7406" />
            </RoleGuard>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
