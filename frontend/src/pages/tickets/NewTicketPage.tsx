import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  Input,
  Button,
  Select,
  Typography,
  Card,
  message,
  Space,
} from "antd";
import { useCreateTicket } from "@/hooks/useTickets";
import { ticketPriorityLabels } from "@/utils/enums";
import type { TicketPriority } from "@/types/domain";
import type { ApiError } from "@/types/error";
import { useEffect } from "react";

const { Title } = Typography;
const { TextArea } = Input;

const ticketSchema = z.object({
  title: z
    .string()
    .min(1, "请输入工单标题")
    .max(200, "标题不能超过 200 个字符"),
  description: z
    .string()
    .min(1, "请输入工单描述")
    .max(10000, "描述不能超过 10000 个字符"),
  priority: z.enum(["P1", "P2", "P3", "P4"] as const),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

const priorityOptions: { value: TicketPriority; label: string }[] = (
  Object.entries(ticketPriorityLabels) as [TicketPriority, string][]
).map(([value, label]) => ({ value, label }));

export function NewTicketPage() {
  const navigate = useNavigate();
  const createMutation = useCreateTicket();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setError,
    watch,
  } = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "P3",
    },
  });

  const titleValue = watch("title");

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const onSubmit = async (values: TicketFormValues) => {
    try {
      const ticket = await createMutation.mutateAsync(values);
      message.success("工单创建成功");
      navigate(`/tickets/${ticket.id}`, { replace: true });
    } catch (err) {
      const apiError = err as ApiError;
      const detail =
        apiError?.response?.data?.detail ?? "创建失败，请稍后重试";
      setError("root", { message: detail });
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Title level={4}>新建工单</Title>

      <Card>
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
              }}
            >
              {errors.root.message}
            </div>
          )}

          <Form.Item
            label="标题"
            validateStatus={errors.title ? "error" : ""}
            help={errors.title?.message}
            extra={`${titleValue.length}/200`}
          >
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <Input {...field} placeholder="简要描述问题" maxLength={200} />
              )}
            />
          </Form.Item>

          <Form.Item
            label="描述"
            validateStatus={errors.description ? "error" : ""}
            help={errors.description?.message}
          >
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <TextArea
                  {...field}
                  rows={6}
                  placeholder="详细描述问题，包括复现步骤、环境信息等"
                  maxLength={10000}
                  showCount
                />
              )}
            />
          </Form.Item>

          <Form.Item
            label="优先级"
            validateStatus={errors.priority ? "error" : ""}
            help={errors.priority?.message}
          >
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <Select
                  {...field}
                  options={priorityOptions}
                  style={{ width: 200 }}
                />
              )}
            />
          </Form.Item>

          <Space>
            <Button
              type="primary"
              htmlType="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              提交工单
            </Button>
            <Button onClick={() => navigate("/tickets")}>取消</Button>
          </Space>
        </form>
      </Card>
    </div>
  );
}