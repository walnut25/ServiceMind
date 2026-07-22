import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Layout,
  Menu,
  Button,
  Dropdown,
  Drawer,
  Grid,
  theme,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  FileTextOutlined,
  PlusCircleOutlined,
  BookOutlined,
  RobotOutlined,
  UserOutlined,
  TeamOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { useQueryClient } from "@tanstack/react-query";
import type { UserRole } from "@/types/domain";
import type { MenuProps } from "antd";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
  roles: UserRole[];
}

const allNavItems: NavItem[] = [
  {
    key: "dashboard",
    icon: <DashboardOutlined />,
    label: "工作台",
    path: "/dashboard",
    roles: ["ADMIN", "AGENT", "REQUESTER"],
  },
  {
    key: "tickets",
    icon: <FileTextOutlined />,
    label: "工单中心",
    path: "/tickets",
    roles: ["ADMIN", "AGENT"],
  },
  {
    key: "my-tickets",
    icon: <FileTextOutlined />,
    label: "我的工单",
    path: "/tickets",
    roles: ["REQUESTER"],
  },
  {
    key: "new-ticket",
    icon: <PlusCircleOutlined />,
    label: "新建工单",
    path: "/tickets/new",
    roles: ["ADMIN", "AGENT", "REQUESTER"],
  },
  {
    key: "knowledge",
    icon: <BookOutlined />,
    label: "知识库",
    path: "/knowledge",
    roles: ["ADMIN", "AGENT", "REQUESTER"],
  },
  {
    key: "new-article",
    icon: <PlusCircleOutlined />,
    label: "新建知识文章",
    path: "/knowledge/new",
    roles: ["ADMIN", "AGENT"],
  },
  {
    key: "assistant",
    icon: <RobotOutlined />,
    label: "AI 助手",
    path: "/assistant",
    roles: ["ADMIN", "AGENT", "REQUESTER"],
  },
  {
    key: "users",
    icon: <TeamOutlined />,
    label: "用户管理",
    path: "/admin/users",
    roles: ["ADMIN"],
  },
];

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const screens = useBreakpoint();
  const { username, roles, logout } = useAuthStore();
  const { token: themeToken } = theme.useToken();

  const isMobile = !screens.lg;

  const visibleNavItems = allNavItems.filter((item) =>
    item.roles.some((role) => roles.includes(role))
  );

  const selectedKey =
    visibleNavItems.find((item) => location.pathname === item.path)
      ?.key ?? "";

  const menuItems: MenuProps["items"] = visibleNavItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    onClick: () => {
      navigate(item.path);
      setMobileDrawerOpen(false);
    },
  }));

  const userMenuItems: MenuProps["items"] = [
    {
      key: "username",
      label: username,
      disabled: true,
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "退出登录",
      danger: true,
      onClick: () => {
        logout();
        queryClient.clear();
        navigate("/login");
      },
    },
  ];

  const sidebarContent = (
    <>
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
        }}
      >
        <span
          style={{
            color: themeToken.colorPrimary,
            fontSize: collapsed && !isMobile ? 18 : 20,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {collapsed && !isMobile ? "SM" : "ServiceMind"}
        </span>
      </div>
      <Menu
        mode="inline"
        selectedKeys={selectedKey ? [selectedKey] : []}
        items={menuItems}
        style={{ borderInlineEnd: "none" }}
      />
    </>
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          breakpoint="lg"
          style={{
            overflow: "auto",
            height: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
          }}
        >
          {sidebarContent}
        </Sider>
      )}

      <Drawer
        placement="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        styles={{ body: { padding: 0 } }}
        width={256}
      >
        {sidebarContent}
      </Drawer>

      <Layout
        style={{
          marginLeft: isMobile ? 0 : collapsed ? 80 : 200,
          transition: "margin-left 0.2s",
        }}
      >
        <Header
          style={{
            padding: "0 24px",
            background: themeToken.colorBgContainer,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: `1px solid ${themeToken.colorBorderSecondary}`,
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <Button
            type="text"
            icon={
              isMobile ? (
                <MenuFoldOutlined />
              ) : collapsed ? (
                <MenuUnfoldOutlined />
              ) : null
            }
            onClick={() => {
              if (isMobile) {
                setMobileDrawerOpen(true);
              } else {
                setCollapsed(!collapsed);
              }
            }}
            style={{ fontSize: 16, width: 48, height: 48 }}
          />

          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button type="text" icon={<UserOutlined />}>
              {username}
            </Button>
          </Dropdown>
        </Header>

        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
