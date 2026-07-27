import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
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

const workflowSteps = ["提交需求", "智能分派", "协同处理", "沉淀知识"];

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
    return <Navigate to="/dashboard" replace />;
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
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            top: -160,
            right: -120,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 220,
            height: 220,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.12)",
            bottom: 72,
            left: -110,
          }}
        />
        <div style={{ width: "100%", maxWidth: 640, position: "relative", zIndex: 1 }}>
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
            marginBottom: 32,
            display: "block",
          }}
        >
          智能服务管理平台 — 让每一次服务都值得信赖
        </Text>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {features.map((feature) => (
            <div
              key={feature.title}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "14px 18px",
                backdropFilter: "blur(8px)",
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
            marginTop: 20,
            padding: "18px 20px",
            borderRadius: 14,
            background: "rgba(15, 23, 42, 0.2)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: 600 }}>服务流转概览</Text>
            <span
              style={{
                padding: "3px 9px",
                borderRadius: 999,
                background: "rgba(52, 211, 153, 0.16)",
                color: "#A7F3D0",
                fontSize: 12,
              }}
            >
              全流程可追踪
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            {workflowSteps.map((step, index) => (
              <div key={step} style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      flex: "0 0 24px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      background:
                        index === workflowSteps.length - 1
                          ? "#34D399"
                          : "rgba(255,255,255,0.16)",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}
                  </span>
                  {index < workflowSteps.length - 1 && (
                    <span
                      style={{
                        height: 1,
                        flex: 1,
                        background: "rgba(255,255,255,0.22)",
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    color: "rgba(255,255,255,0.82)",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                >
                  {step}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            opacity: 0.55,
            fontSize: 12,
            paddingTop: 24,
          }}
        >
          <Text style={{ color: "inherit", fontSize: "inherit" }}>
            &copy; {new Date().getFullYear()} ServiceMind. 企业内部客服与 IT
            支持平台。
          </Text>
        </div>
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
