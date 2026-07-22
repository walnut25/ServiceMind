import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  Input,
  Button,
  Typography,
  Card,
  Tag,
  message,
} from "antd";
import {
  UserOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  BookOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { loginApi } from "@/api/auth";
import { useAuthStore } from "@/stores/auth";
import type { ApiError } from "@/types/error";

const { Title, Text } = Typography;

const loginSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const features = [
  {
    icon: <SafetyCertificateOutlined />,
    title: "工单协作",
    description: "高效创建、分配和跟踪工单",
  },
  {
    icon: <BookOutlined />,
    title: "知识库",
    description: "沉淀团队经验，快速查找解决方案",
  },
  {
    icon: <RobotOutlined />,
    title: "AI 辅助",
    description: "智能问答，即时获取知识支持",
  },
];

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  if (isAuthenticated) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const onSubmit = async (values: LoginFormValues) => {
    try {
      const response = await loginApi(values);
      login(response.accessToken);
      const redirect = searchParams.get("redirect") ?? "/dashboard";
      navigate(redirect, { replace: true });
    } catch (err) {
      const apiError = err as ApiError;
      const detail =
        apiError?.response?.data?.detail ?? "登录失败，请检查用户名和密码";
      const status = apiError?.response?.status;

      if (status === 401) {
        setError("root", { message: "用户名或密码错误" });
      } else if (status === 503 || status === 502) {
        message.error("服务暂时不可用，请稍后重试");
      } else {
        setError("root", { message: detail });
      }
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
      }}
    >
      {/* Left panel */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 64px",
          color: "#fff",
        }}
      >
        <Title
          level={1}
          style={{
            color: "#fff",
            fontSize: 36,
            marginBottom: 12,
            fontWeight: 700,
          }}
        >
          ServiceMind
        </Title>
        <Text
          style={{
            color: "rgba(255,255,255,0.85)",
            fontSize: 16,
            marginBottom: 40,
            display: "block",
          }}
        >
          智能服务管理平台 — 让每一次服务都值得信赖
        </Text>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {features.map((feature) => (
            <div
              key={feature.title}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                background: "rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "16px 20px",
              }}
            >
              <span style={{ fontSize: 24, opacity: 0.9 }}>
                {feature.icon}
              </span>
              <div>
                <div
                  style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}
                >
                  {feature.title}
                </div>
                <div style={{ opacity: 0.75, fontSize: 14 }}>
                  {feature.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: "auto",
            opacity: 0.5,
            fontSize: 12,
            paddingTop: 48,
          }}
        >
          <Text style={{ color: "inherit", fontSize: "inherit" }}>
            &copy; {new Date().getFullYear()} ServiceMind. 企业内部客服与 IT
            支持平台。
          </Text>
        </div>
      </div>

      {/* Right panel */}
      <div
        style={{
          width: 480,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff",
          padding: 48,
        }}
      >
        <Card
          style={{ width: "100%", maxWidth: 400, boxShadow: "none" }}
          styles={{ body: { padding: 0 } }}
          variant="borderless"
        >
          <Title
            level={3}
            style={{ marginBottom: 8, textAlign: "center", fontWeight: 600 }}
          >
            欢迎回来
          </Title>
          <Text
            type="secondary"
            style={{
              display: "block",
              textAlign: "center",
              marginBottom: 32,
            }}
          >
            请使用您的账号登录
          </Text>

          <form onSubmit={handleSubmit(onSubmit)}>
            {errors.root && (
              <div
                style={{
                  color: "#DC2626",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 8,
                  padding: "8px 16px",
                  marginBottom: 16,
                  fontSize: 14,
                }}
              >
                {errors.root.message}
              </div>
            )}

            <Form.Item
              validateStatus={errors.username ? "error" : ""}
              help={errors.username?.message}
            >
              <Controller
                name="username"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    size="large"
                    prefix={<UserOutlined />}
                    placeholder="用户名"
                    autoComplete="username"
                  />
                )}
              />
            </Form.Item>

            <Form.Item
              validateStatus={errors.password ? "error" : ""}
              help={errors.password?.message}
            >
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    size="large"
                    prefix={<LockOutlined />}
                    placeholder="密码"
                    autoComplete="current-password"
                  />
                )}
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={isSubmitting}
              disabled={isSubmitting}
              block
              style={{ marginTop: 8 }}
            >
              登录
            </Button>
          </form>

          <div
            style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 8 }}
          >
            <Tag>REQUESTER</Tag>
            <Tag color="blue">AGENT</Tag>
            <Tag color="gold">ADMIN</Tag>
          </div>
          <Text
            type="secondary"
            style={{
              display: "block",
              textAlign: "center",
              marginTop: 12,
              fontSize: 12,
            }}
          >
            默认管理员: admin / Admin123!
          </Text>
        </Card>
      </div>
    </div>
  );
}
