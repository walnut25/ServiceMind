import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Spin } from "antd";
import { AppLayout } from "@/layouts/AppLayout";
import { AuthGuard } from "./AuthGuard";
import { RoleGuard } from "./RoleGuard";

const LoginPage = lazy(() => import("@/pages/login/LoginPage").then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ForbiddenPage = lazy(() => import("@/pages/errors/ForbiddenPage").then((module) => ({ default: module.ForbiddenPage })));
const NotFoundPage = lazy(() => import("@/pages/errors/NotFoundPage").then((module) => ({ default: module.NotFoundPage })));
const TicketListPage = lazy(() => import("@/pages/tickets/TicketListPage").then((module) => ({ default: module.TicketListPage })));
const NewTicketPage = lazy(() => import("@/pages/tickets/NewTicketPage").then((module) => ({ default: module.NewTicketPage })));
const TicketDetailPage = lazy(() => import("@/pages/tickets/TicketDetailPage").then((module) => ({ default: module.TicketDetailPage })));
const ArticleListPage = lazy(() => import("@/pages/knowledge/ArticleListPage").then((module) => ({ default: module.ArticleListPage })));
const ArticleDetailPage = lazy(() => import("@/pages/knowledge/ArticleDetailPage").then((module) => ({ default: module.ArticleDetailPage })));
const ArticleEditPage = lazy(() => import("@/pages/knowledge/ArticleEditPage").then((module) => ({ default: module.ArticleEditPage })));
const AssistantPage = lazy(() => import("@/pages/assistant/AssistantPage").then((module) => ({ default: module.AssistantPage })));
const UserManagementPage = lazy(() => import("@/pages/admin/UserManagementPage").then((module) => ({ default: module.UserManagementPage })));

export function AppRouter() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <Spin size="large" />
        </div>
      }
    >
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
                <UserManagementPage />
              </RoleGuard>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
