import { useState, useCallback } from "react";
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
  Tabs,
  Input,
  Modal,
  List,
  Timeline,
  Select,
  message,
  Popconfirm,
} from "antd";
import { ArrowLeftOutlined, SendOutlined, UserSwitchOutlined } from "@ant-design/icons";
import {
  useTicket,
  useComments,
  useAddComment,
  useAuditEvents,
  useTransitionTicket,
  useAssignTicket,
  useUsers,
} from "@/hooks/useTickets";
import { useAuthStore } from "@/stores/auth";
import { ticketStatusLabels, ticketPriorityLabels } from "@/utils/enums";
import { getAllowedTransitions, transitionLabels } from "@/utils/ticketTransitions";
import { formatAuditEvent } from "@/utils/auditFormat";
import type { TicketStatus, TicketPriority } from "@/types/domain";
import type { ApiError } from "@/types/error";

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

const priorityColors: Record<TicketPriority, string> = {
  P1: "red", P2: "orange", P3: "blue", P4: "default",
};
const statusColors: Record<TicketStatus, string> = {
  OPEN: "blue", IN_PROGRESS: "processing", RESOLVED: "success", CLOSED: "default",
};

export function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const id = Number(ticketId);
  const roles = useAuthStore((s) => s.roles);
  const canManage = roles.includes("ADMIN") || roles.includes("AGENT");
  const isAdmin = roles.includes("ADMIN");

  const { data: ticket, isLoading, isError, refetch } = useTicket(id);
  const { data: commentsData, isLoading: commentsLoading } = useComments(id);
  const { data: auditData, isLoading: auditLoading } = useAuditEvents(id);
  const addCommentMutation = useAddComment(id);
  const transitionMutation = useTransitionTicket(id);
  const assignMutation = useAssignTicket(id);
  const { data: usersData } = useUsers();

  const [commentText, setCommentText] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  const handleCommentSubmit = useCallback(async () => {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    try {
      await addCommentMutation.mutateAsync(trimmed);
      setCommentText("");
      message.success("评论已添加");
    } catch (err) {
      const detail = (err as ApiError)?.response?.data?.detail ?? "评论失败";
      message.error(detail);
    }
  }, [commentText, addCommentMutation]);

  const handleStatusTransition = useCallback(
    async (status: TicketStatus) => {
      try {
        await transitionMutation.mutateAsync(status);
        message.success("状态已更新");
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr?.response?.status === 409) {
          message.warning("该工单已被其他用户修改，请刷新后重试");
          refetch();
        } else {
          message.error(apiErr?.response?.data?.detail ?? "操作失败");
        }
      }
    },
    [transitionMutation, refetch]
  );

  const handleAssign = useCallback(
    async (username: string) => {
      try {
        await assignMutation.mutateAsync(username);
        setAssignModalOpen(false);
        message.success("负责人已更新");
      } catch (err) {
        const apiErr = err as ApiError;
        if (apiErr?.response?.status === 409) {
          message.warning("该工单已被其他用户修改，请刷新后重试");
          refetch();
          setAssignModalOpen(false);
        } else {
          message.error(apiErr?.response?.data?.detail ?? "分配失败");
        }
      }
    },
    [assignMutation, refetch]
  );

  if (isLoading) {
    return (
      <div>
        <Skeleton active paragraph={{ rows: 2 }} style={{ marginBottom: 16 }} />
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (isError) {
    const axiosErr = (isError as unknown as { response?: { status: number } });
    if (axiosErr?.response?.status === 404) {
      return (
        <Result
          status="404"
          title="工单不存在或你无权访问"
          extra={<Button type="primary" onClick={() => navigate("/tickets")}>返回工单列表</Button>}
        />
      );
    }
    return (
      <Alert type="error" message="加载失败" description="请稍后重试"
        action={<Button size="small" onClick={() => refetch()}>重试</Button>} />
    );
  }

  if (!ticket) return null;

  const allowedTransitions = getAllowedTransitions(ticket.status);
  const availableAssignees = usersData?.content.filter(
    (u) => u.enabled && (u.roles.includes("AGENT") || u.roles.includes("ADMIN"))
  ) ?? [];

  // --- Comment tab ---
  const commentPanel = (
    <div>
      {commentsLoading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : commentsData && commentsData.content.length > 0 ? (
        <List
          dataSource={commentsData.content}
          locale={{ emptyText: "暂无评论" }}
          split
          style={{ marginBottom: 16 }}
          renderItem={(c) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{c.authorUsername}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(c.createdAt).toLocaleString("zh-CN")}
                    </Text>
                  </Space>
                }
                description={
                  <Paragraph style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
                    {c.content}
                  </Paragraph>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <Paragraph type="secondary" style={{ textAlign: "center", padding: 24 }}>
          暂无评论
        </Paragraph>
      )}
      <Space.Compact style={{ width: "100%" }}>
        <TextArea
          rows={3}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="输入评论..."
          maxLength={10000}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleCommentSubmit();
            }
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={addCommentMutation.isPending}
          disabled={!commentText.trim() || addCommentMutation.isPending}
          onClick={handleCommentSubmit}
          style={{ height: "auto" }}
        >
          发送
        </Button>
      </Space.Compact>
    </div>
  );

  // --- Audit tab ---
  const auditItems = auditData?.content.map((a) => ({
    color: a.eventType === "TICKET_CREATED" ? "green"
         : a.eventType === "STATUS_CHANGED" ? "blue"
         : a.eventType === "ASSIGNEE_CHANGED" ? "orange"
         : "gray",
    children: (
      <div>
        <Text>{formatAuditEvent(a.eventType, a.details)}</Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {a.actorUsername} · {new Date(a.createdAt).toLocaleString("zh-CN")}
        </Text>
      </div>
    ),
  })) ?? [];

  const auditPanel = (
    <Timeline
      pending={auditLoading ? "加载中..." : undefined}
      items={auditItems.length > 0 ? auditItems : [{ children: <Text type="secondary">暂无审计记录</Text> }]}
    />
  );

  // --- Tabs ---
  const tabItems = [
    { key: "comments", label: "评论", children: commentPanel },
  ];
  if (canManage) {
    tabItems.push({ key: "audit", label: "审计记录", children: auditPanel });
  }

  return (
    <div>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/tickets")}
        style={{ marginBottom: 16 }}>
        返回工单列表
      </Button>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* Left */}
        <div style={{ flex: "1 1 500px", minWidth: 0 }}>
          <Card>
            <Title level={4} style={{ marginTop: 0 }}>{ticket.title}</Title>
            <Space style={{ marginBottom: 16 }}>
              <Tag color={priorityColors[ticket.priority]}>{ticketPriorityLabels[ticket.priority]}</Tag>
              <Tag color={statusColors[ticket.status]}>{ticketStatusLabels[ticket.status]}</Tag>
            </Space>
            <Divider />
            <Paragraph style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {ticket.description}
            </Paragraph>
          </Card>

          <Card style={{ marginTop: 16 }} styles={{ body: { padding: 16 } }}>
            <Tabs items={tabItems} />
          </Card>
        </div>

        {/* Right sidebar */}
        <div style={{ flex: "0 0 280px" }}>
          <Card title="工单信息" size="small">
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label="编号">#{ticket.id}</Descriptions.Item>
              <Descriptions.Item label="提交人">{ticket.requesterUsername}</Descriptions.Item>
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

          {canManage && (
            <Card title="操作" size="small" style={{ marginTop: 16 }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                {/* Status transitions */}
                {allowedTransitions.map((target) =>
                  target === "CLOSED" ? (
                    <Popconfirm
                      key={target}
                      title="确定要关闭此工单吗？"
                      description="关闭后无法再修改状态。"
                      onConfirm={() => handleStatusTransition(target)}
                      okText="确定关闭"
                      cancelText="取消"
                    >
                      <Button
                        danger
                        block
                        loading={transitionMutation.isPending}
                      >
                        {transitionLabels[target]}
                      </Button>
                    </Popconfirm>
                  ) : (
                    <Button
                      key={target}
                      block
                      loading={transitionMutation.isPending}
                      onClick={() => handleStatusTransition(target)}
                    >
                      {transitionLabels[target]}
                    </Button>
                  )
                )}

                {allowedTransitions.length === 0 && ticket.status === "CLOSED" && (
                  <Text type="secondary">工单已关闭，无可用操作</Text>
                )}

                <Divider style={{ margin: "4px 0" }} />

                {/* Assign button */}
                {isAdmin ? (
                  <Button
                    icon={<UserSwitchOutlined />}
                    block
                    onClick={() => setAssignModalOpen(true)}
                  >
                    分配负责人
                  </Button>
                ) : (
                  <Button icon={<UserSwitchOutlined />} block disabled>
                    分配负责人
                    <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
                      (用户列表仅 ADMIN 可用)
                    </Text>
                  </Button>
                )}
              </Space>
            </Card>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      <Modal
        title="分配负责人"
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        footer={null}
      >
        {availableAssignees.length === 0 ? (
          <Text type="secondary">暂无可分配的用户</Text>
        ) : (
          <Select
            style={{ width: "100%" }}
            placeholder="选择负责人"
            value={ticket.assigneeUsername ?? undefined}
            onChange={(val) => handleAssign(val)}
            loading={assignMutation.isPending}
            options={availableAssignees.map((u) => ({
              value: u.username,
              label: `${u.username} (${u.roles.join(", ")})`,
            }))}
          />
        )}
      </Modal>
    </div>
  );
}