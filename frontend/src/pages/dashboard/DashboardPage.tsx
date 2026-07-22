import { useNavigate } from "react-router-dom";
import { Typography, Card, Row, Col } from "antd";
import {
  FileTextOutlined,
  PlusCircleOutlined,
  BookOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import type { UserRole } from "@/types/domain";

const { Title, Paragraph } = Typography;

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
];

export function DashboardPage() {
  const navigate = useNavigate();
  const roles = useAuthStore((s) => s.roles);
  const username = useAuthStore((s) => s.username);

  const roleSet = new Set<string>(roles);
  const visibleActions = quickActions.filter((action) =>
    action.roles.some((role) => roleSet.has(role))
  );

  return (
    <div>
      <Title level={4} style={{ marginBottom: 4 }}>
        工作台
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        欢迎回来，{username}
      </Paragraph>

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
    </div>
  );
}
