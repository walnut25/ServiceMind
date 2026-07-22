import { useParams, useNavigate } from "react-router-dom";
import {
  Typography,
  Card,
  Descriptions,
  Tag,
  Button,
  Skeleton,
  Alert,
  Result,
  Space,
  Divider,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useTicket } from "@/hooks/useTickets";
import { ticketStatusLabels, ticketPriorityLabels } from "@/utils/enums";
import type { TicketStatus, TicketPriority } from "@/types/domain";

const { Title, Paragraph } = Typography;

const priorityColors: Record<TicketPriority, string> = {
  P1: "red",
  P2: "orange",
  P3: "blue",
  P4: "default",
};

const statusColors: Record<TicketStatus, string> = {
  OPEN: "blue",
  IN_PROGRESS: "processing",
  RESOLVED: "success",
  CLOSED: "default",
};

export function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const id = Number(ticketId);

  const { data: ticket, isLoading, isError, error, refetch } = useTicket(id);

  if (isLoading) {
    return (
      <div>
        <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 16 }} />
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (isError) {
    const axiosError = error as { response?: { status: number } } | undefined;
    if (axiosError?.response?.status === 404) {
      return (
        <Result
          status="404"
          title="工单不存在或你无权访问"
          subTitle="该工单可能已被删除，或者你没有查看权限。"
          extra={
            <Button type="primary" onClick={() => navigate("/tickets")}>
              返回工单列表
            </Button>
          }
        />
      );
    }

    return (
      <Alert
        type="error"
        message="加载失败"
        description="无法加载工单详情，请稍后重试。"
        action={
          <Button size="small" onClick={() => refetch()}>
            重试
          </Button>
        }
      />
    );
  }

  if (!ticket) return null;

  return (
    <div>
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/tickets")}
        style={{ marginBottom: 16 }}
      >
        返回工单列表
      </Button>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* Main content */}
        <div style={{ flex: "1 1 500px", minWidth: 0 }}>
          <Card>
            <Title level={4} style={{ marginTop: 0 }}>
              {ticket.title}
            </Title>

            <Space style={{ marginBottom: 16 }}>
              <Tag color={priorityColors[ticket.priority]}>
                {ticketPriorityLabels[ticket.priority]}
              </Tag>
              <Tag color={statusColors[ticket.status]}>
                {ticketStatusLabels[ticket.status]}
              </Tag>
            </Space>

            <Divider />

            <Paragraph
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {ticket.description}
            </Paragraph>
          </Card>

          {/* Comment placeholder */}
          <Card style={{ marginTop: 16 }}>
            <Paragraph type="secondary" style={{ textAlign: "center", margin: 0 }}>
              评论功能将在后续阶段实现
            </Paragraph>
          </Card>
        </div>

        {/* Sidebar */}
        <div style={{ flex: "0 0 280px" }}>
          <Card title="工单信息" size="small">
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label="编号">
                #{ticket.id}
              </Descriptions.Item>
              <Descriptions.Item label="提交人">
                {ticket.requesterUsername}
              </Descriptions.Item>
              <Descriptions.Item label="负责人">
                {ticket.assigneeUsername || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {new Date(ticket.createdAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {new Date(ticket.updatedAt).toLocaleString("zh-CN")}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </div>
      </div>
    </div>
  );
}