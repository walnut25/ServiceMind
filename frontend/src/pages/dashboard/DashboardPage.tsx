import { useNavigate } from "react-router-dom";
import { Typography, Card, Row, Col, List, Tag, Button, Skeleton } from "antd";
import {
  FileTextOutlined,
  PlusCircleOutlined,
  BookOutlined,
  RobotOutlined,
  TeamOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { useTicketList } from "@/hooks/useTickets";
import { ticketPriorityLabels, ticketStatusLabels } from "@/utils/enums";
import type { UserRole, TicketStatus, TicketPriority } from "@/types/domain";
import type { TicketResponse } from "@/types/ticket";

const { Title, Paragraph, Text } = Typography;

interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  roles: UserRole[];
}

const quickActions: QuickAction[] = [
  {
    title: "查看工单",
    description: "浏览和跟踪工单状态",
    icon: <FileTextOutlined style={{ fontSize: 32, color: "#2563EB" }} />,
    path: "/tickets",
    roles: ["ADMIN", "AGENT", "REQUESTER"],
  },
  {
    title: "新建工单",
    description: "提交新的支持请求",
    icon: <PlusCircleOutlined style={{ fontSize: 32, color: "#16A34A" }} />,
    path: "/tickets/new",
    roles: ["ADMIN", "AGENT", "REQUESTER"],
  },
  {
    title: "知识库",
    description: "查阅和搜索知识文章",
    icon: <BookOutlined style={{ fontSize: 32, color: "#F59E0B" }} />,
    path: "/knowledge",
    roles: ["ADMIN", "AGENT", "REQUESTER"],
  },
  {
    title: "AI 助手",
    description: "智能问答获取帮助",
    icon: <RobotOutlined style={{ fontSize: 32, color: "#7C3AED" }} />,
    path: "/assistant",
    roles: ["ADMIN", "AGENT", "REQUESTER"],
  },
  {
    title: "用户管理",
    description: "管理系统用户账号",
    icon: <TeamOutlined style={{ fontSize: 32, color: "#DC2626" }} />,
    path: "/admin/users",
    roles: ["ADMIN"],
  },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.roles);
  const username = useAuthStore((s) => s.username);

  const roleSet = new Set(roles);
  const isRequester = roleSet.has("REQUESTER") && !roleSet.has("ADMIN") && !roleSet.has("AGENT");

  const visibleActions = quickActions.filter((action) =>
    action.roles.some((role) => roleSet.has(role))
  );

  // Recent tickets: small first page for a quick glance, not a full count
  const recentTickets = useTicketList({
    page: 0,
    size: 5,
    sort: "updatedAt,desc",
  });

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>
        工作台
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        欢迎回来，{username}
      </Paragraph>

      <Title level={5} style={{ marginBottom: 12 }}>
        快捷入口
      </Title>
      <Row gutter={[16, 16]}>
        {visibleActions.map((action) => (
          <Col xs={24} sm={12} lg={6} key={action.title}>
            <Card
              hoverable
              onClick={() => navigate(action.path)}
              style={{ height: "100%" }}
            >
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                {action.icon}
                <Title level={5} style={{ marginTop: 12, marginBottom: 4 }}>
                  {action.title}
                </Title>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {action.description}
                </Paragraph>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ marginTop: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>
            {isRequester ? "我的最近工单" : "最近工单"}
          </Title>
          <Button type="link" onClick={() => navigate("/tickets")}>
            查看全部 <RightOutlined />
          </Button>
        </div>

        {recentTickets.isLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : recentTickets.isError ? (
          <Text type="secondary">加载失败，请刷新页面重试</Text>
        ) : recentTickets.data && recentTickets.data.content.length > 0 ? (
          <List
            dataSource={recentTickets.data.content}
            renderItem={(ticket: TicketResponse) => (
              <List.Item
                key={ticket.id}
                style={{ cursor: "pointer", padding: "12px 16px" }}
                onClick={() => navigate("/tickets/" + ticket.id)}
              >
                <List.Item.Meta
                  title={
                    <span>
                      <Text style={{ marginRight: 8 }}>#{ticket.id}</Text>
                      {ticket.title}
                    </span>
                  }
                  description={
                    <span>
                      <Tag color={ticket.priority === "P1" ? "red" : ticket.priority === "P2" ? "orange" : ticket.priority === "P3" ? "blue" : "default"}>
                        {ticketPriorityLabels[ticket.priority as TicketPriority]}
                      </Tag>
                      <Tag>{ticketStatusLabels[ticket.status as TicketStatus]}</Tag>
                      {ticket.updatedAt && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {new Date(ticket.updatedAt).toLocaleDateString("zh-CN")}
                        </Text>
                      )}
                    </span>
                  }
                />
              </List.Item>
            )}
            style={{ background: "#fff", borderRadius: 8 }}
            bordered
          />
        ) : (
          <Card>
            <div style={{ textAlign: "center", padding: 24 }}>
              <Text type="secondary">暂无工单</Text>
              <div style={{ marginTop: 8 }}>
                <Button type="primary" onClick={() => navigate("/tickets/new")}>
                  新建工单
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
