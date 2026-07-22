import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/login/LoginPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { ForbiddenPage } from "@/pages/errors/ForbiddenPage";
import { NotFoundPage } from "@/pages/errors/NotFoundPage";
import { TicketListPage } from "@/pages/tickets/TicketListPage";
import { NewTicketPage } from "@/pages/tickets/NewTicketPage";
import { TicketDetailPage } from "@/pages/tickets/TicketDetailPage";
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

        <Route
          path="/knowledge"
          element={<PlaceholderPage title="知识库" />}
        />
        <Route
          path="/knowledge/new"
          element={
            <RoleGuard roles={["ADMIN", "AGENT"]}>
              <PlaceholderPage title="新建知识文章" />
            </RoleGuard>
          }
        />
        <Route
          path="/knowledge/:articleId"
          element={<PlaceholderPage title="知识文章详情" />}
        />
        <Route
          path="/knowledge/:articleId/edit"
          element={
            <RoleGuard roles={["ADMIN", "AGENT"]}>
              <PlaceholderPage title="编辑知识文章" />
            </RoleGuard>
          }
        />

        <Route
          path="/assistant"
          element={<PlaceholderPage title="AI 助手" />}
        />

        <Route
          path="/admin/users"
          element={
            <RoleGuard roles={["ADMIN"]}>
              <PlaceholderPage title="用户管理" />
            </RoleGuard>
          }
        />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}