import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Table,
  Button,
  Space,
  Tag,
  Select,
  Input,
  Row,
  Col,
  Typography,
  Alert,
  Empty,
  Skeleton,
} from "antd";
import { PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useAuthStore } from "@/stores/auth";
import { useTicketList } from "@/hooks/useTickets";
import { ticketStatusLabels, ticketPriorityLabels } from "@/utils/enums";
import type { TicketResponse } from "@/types/ticket";
import type { TicketStatus, TicketPriority } from "@/types/domain";

const { Title, Text } = Typography;

const statusOptions: { value: TicketStatus | ""; label: string }[] = [
  { value: "", label: "全部状态" },
  ...(Object.entries(ticketStatusLabels) as [TicketStatus, string][]).map(
    ([value, label]) => ({ value, label })
  ),
];

const priorityOptions: { value: TicketPriority | ""; label: string }[] = [
  { value: "", label: "全部优先级" },
  ...(Object.entries(ticketPriorityLabels) as [TicketPriority, string][]).map(
    ([value, label]) => ({ value, label })
  ),
];

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

export function TicketListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roles = useAuthStore((s) => s.roles);
  const isRequester = roles.length === 1 && roles[0] === "REQUESTER";

  const params = useMemo(() => {
    const status = (searchParams.get("status") || undefined) as
      | TicketStatus
      | undefined;
    const priority = (searchParams.get("priority") || undefined) as
      | TicketPriority
      | undefined;
    const assignee = searchParams.get("assignee") || undefined;
    const page = Number(searchParams.get("page") || "0");
    const size = Number(searchParams.get("size") || "20");
    return { status, priority, assignee, page, size, sort: "createdAt,desc" };
  }, [searchParams]);

  const { data, isLoading, isError, refetch } = useTicketList(params);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    next.set("page", "0");
    setSearchParams(next);
  };

  const columns: ColumnsType<TicketResponse> = [
    {
      title: "编号",
      dataIndex: "id",
      key: "id",
      width: 80,
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (text: string, record: TicketResponse) => (
        <a onClick={() => navigate(`/tickets/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: "优先级",
      dataIndex: "priority",
      key: "priority",
      width: 90,
      render: (p: TicketPriority) => (
        <Tag color={priorityColors[p]}>{ticketPriorityLabels[p]}</Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (s: TicketStatus) => (
        <Tag color={statusColors[s]}>{ticketStatusLabels[s]}</Tag>
      ),
    },
    ...(isRequester
      ? []
      : [
          {
            title: "提交人",
            dataIndex: "requesterUsername",
            key: "requesterUsername",
            width: 120,
            responsive: ["lg"] as ("lg")[],
          } as ColumnsType<TicketResponse>[number],
        ]),
    {
      title: "负责人",
      dataIndex: "assigneeUsername",
      key: "assigneeUsername",
      width: 120,
      responsive: ["lg"] as ("lg")[],
      render: (v: string | null) => v || "-",
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      responsive: ["lg"] as ("lg")[],
      render: (v: string) => new Date(v).toLocaleString("zh-CN"),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            工单中心
          </Title>
          <Text type="secondary">管理和跟踪所有支持工单</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/tickets/new")}
        >
          新建工单
        </Button>
      </div>

      <div
        style={{
          marginBottom: 16,
          padding: 16,
          background: "#fff",
          borderRadius: 8,
        }}
      >
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={6}>
            <Select
              value={params.status || ""}
              onChange={(v) => updateFilter("status", v)}
              options={statusOptions}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Select
              value={params.priority || ""}
              onChange={(v) => updateFilter("priority", v)}
              options={priorityOptions}
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={24} sm={6}>
            <Input
              placeholder="负责人"
              prefix={<SearchOutlined />}
              value={params.assignee || ""}
              onChange={(e) => updateFilter("assignee", e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={6}>
            <Space>
              <Button onClick={() => setSearchParams({})}>重置</Button>
              <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                刷新
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : isError ? (
        <Alert
          type="error"
          message="加载失败"
          description="无法加载工单列表，请检查网络后重试。"
          action={
            <Button size="small" onClick={() => refetch()}>
              重试
            </Button>
          }
        />
      ) : !data || data.content.length === 0 ? (
        <Empty description="暂无工单">
          <Button type="primary" onClick={() => navigate("/tickets/new")}>
            创建第一个工单
          </Button>
        </Empty>
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data.content}
          pagination={{
            current: data.page.number + 1,
            pageSize: data.page.size,
            total: data.page.totalElements,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, size) => {
              const next = new URLSearchParams(searchParams);
              next.set("page", String(page - 1));
              next.set("size", String(size));
              setSearchParams(next);
            },
          }}
          onRow={(record) => ({
            onClick: () => navigate(`/tickets/${record.id}`),
            style: { cursor: "pointer" },
          })}
        />
      )}
    </div>
  );
}