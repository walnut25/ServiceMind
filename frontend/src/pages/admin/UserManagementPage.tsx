import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Table,
  Button,
  Modal,
  Select,
  Input,
  Tag,
  Space,
  Typography,
  App,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useUserList, useCreateUser, useChangeUserEnabled } from "@/hooks/useUsers";
import { useAuthStore } from "@/stores/auth";
import { roleLabel } from "@/utils/enums";
import type { UserRole } from "@/types/domain";
import type { CreateUserRequest } from "@/types/users";
import type { ApiError } from "@/types/error";
import type { ColumnsType } from "antd/es/table";

const { Title, Text } = Typography;

interface UserRow {
  id: number;
  username: string;
  enabled: boolean;
  roles: UserRole[];
  createdAt: string;
}

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: "REQUESTER", value: "REQUESTER" },
  { label: "AGENT", value: "AGENT" },
  { label: "ADMIN", value: "ADMIN" },
];

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "用户名至少 3 个字符")
    .max(100, "用户名最多 100 个字符")
    .regex(/^[A-Za-z0-9._-]+$/, "只能包含字母、数字、点、下划线和连字符"),
  password: z
    .string()
    .min(12, "密码至少 12 个字符")
    .max(72, "密码最多 72 个字符"),
  roles: z
    .array(z.enum(["ADMIN", "AGENT", "REQUESTER"]))
    .min(1, "至少选择一个角色"),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

export function UserManagementPage() {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const currentUsername = useAuthStore((s) => s.username);
  const { message } = App.useApp();

  const userList = useUserList(page, size);
  const createMutation = useCreateUser();
  const changeEnabledMutation = useChangeUserEnabled();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: "", password: "", roles: ["REQUESTER"] },
  });

  const openModal = () => {
    reset({ username: "", password: "", roles: ["REQUESTER"] });
    setModalOpen(true);
  };

  const handleCreate = async (data: CreateUserForm) => {
    try {
      await createMutation.mutateAsync(data as CreateUserRequest);
      message.success("用户创建成功");
      setModalOpen(false);
      setPage(0);
    } catch (err) {
      const apiErr = err as ApiError;
      const detail =
        apiErr?.response?.data?.detail ?? "创建失败，请重试";
      message.error(detail);
    }
  };

  const handleToggleEnabled = async (user: UserRow) => {
    try {
      await changeEnabledMutation.mutateAsync({
        id: user.id,
        enabled: !user.enabled,
      });
      message.success(user.enabled ? "用户已禁用" : "用户已启用");
    } catch (err) {
      const apiErr = err as ApiError;
      const detail =
        apiErr?.response?.data?.detail ?? "操作失败";
      message.error(detail);
    }
  };

  const columns: ColumnsType<UserRow> = [
    { title: "ID", dataIndex: "id", key: "id", width: 60 },
    { title: "用户名", dataIndex: "username", key: "username" },
    {
      title: "角色",
      dataIndex: "roles",
      key: "roles",
      render: (roles: UserRole[]) => (
        <Space size={4}>
          {roles.map((r) => (
            <Tag key={r} color={r === "ADMIN" ? "red" : r === "AGENT" ? "blue" : "default"}>
              {roleLabel(r)}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      width: 80,
      render: (enabled: boolean) =>
        enabled ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>,
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => v?.split("T")[0],
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      render: (_, user) => {
        const isSelf = user.username === currentUsername;
        return (
          <Popconfirm
            title={
              user.enabled
                ? "禁用\u540e\uff0c\u8be5\u7528\u6237\u5c06\u65e0\u6cd5\u767b\u5f55\u3002确定\u8981禁用\u5417\uff1f"
                : "确定\u8981启用\u8be5\u7528\u6237\u5417\uff1f"
            }
            onConfirm={() => handleToggleEnabled(user)}
            okText="确定"
            cancelText="取消"
            disabled={isSelf && user.enabled}
          >
            <Button
              type="link"
              danger={user.enabled}
              disabled={isSelf && user.enabled}
            >
              {user.enabled ? "禁用" : "启用"}
            </Button>
          </Popconfirm>
        );
      },
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
            用户管理
          </Title>
          <Text type="secondary">管理系统的所有用户账号</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => userList.refetch()}
            loading={userList.isFetching}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openModal}
          >
            创建用户
          </Button>
        </Space>
      </div>

      <Table<UserRow>
        columns={columns}
        dataSource={userList.data?.content ?? []}
        rowKey="id"
        loading={userList.isLoading}
        pagination={{
          current: page + 1,
          pageSize: size,
          total: userList.data?.page?.totalElements ?? 0,
          showSizeChanger: true,
          showTotal: (t) => "共 " + t + " 条",
          onChange: (p, s) => {
            setPage(p - 1);
            setSize(s);
          },
        }}
        locale={{ emptyText: "暂无用户数据" }}
        scroll={{ x: 600 }}
      />

      <Modal
        title="创建用户"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit(handleCreate)}
        confirmLoading={isSubmitting}
        maskClosable={false}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text>用户名</Text>
            <Controller
              name="username"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  maxLength={100}
                  showCount
                  placeholder="例如 agent-one"
                  status={errors.username ? "error" : undefined}
                />
              )}
            />
            {errors.username && (
              <Text type="danger" style={{ fontSize: 12 }}>
                {errors.username.message}
              </Text>
            )}
          </div>

          <div>
            <Text>密码</Text>
            <Controller
              name="password"
              control={control}
              render={({ field }) => (
                <Input.Password
                  {...field}
                  maxLength={72}
                  placeholder="至少 12 个字符"
                  status={errors.password ? "error" : undefined}
                />
              )}
            />
            {errors.password && (
              <Text type="danger" style={{ fontSize: 12 }}>
                {errors.password.message}
              </Text>
            )}
          </div>

          <div>
            <Text>角色</Text>
            <Controller
              name="roles"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  mode="multiple"
                  style={{ width: "100%" }}
                  placeholder="\u9009\u62e9角色"
                  options={ROLE_OPTIONS}
                  status={errors.roles ? "error" : undefined}
                />
              )}
            />
            {errors.roles && (
              <Text type="danger" style={{ fontSize: 12 }}>
                {errors.roles.message}
              </Text>
            )}
          </div>
        </Space>
      </Modal>
    </div>
  );
}
