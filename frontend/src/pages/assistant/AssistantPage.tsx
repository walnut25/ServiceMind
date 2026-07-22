import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Typography,
  Input,
  Button,
  Card,
  Space,
  Tag,
  Skeleton,
} from "antd";
import {
  SendOutlined,
  SearchOutlined,
  PlusCircleOutlined,
  RobotOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { useAskQuestion } from "@/hooks/useAssistant";
import type { ChatMessage, SourceResponse } from "@/types/assistant";
import type { ApiError } from "@/types/error";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const questionSchema = z.object({
  question: z
    .string()
    .min(1, "\u8bf7\u8f93\u5165\u95ee\u9898")
    .max(2000, "\u95ee\u9898\u4e0d\u8d85\u8fc72000\u5b57\u7b26"),
});

type QuestionForm = z.infer<typeof questionSchema>;

const RECOMMENDED_QUESTIONS = [
  "VPN \u65e0\u6cd5\u8fde\u63a5\u600e\u4e48\u529e\uff1f",
  "\u5982\u4f55\u5904\u7406\u8d26\u53f7\u767b\u5f55\u95ee\u9898\uff1f",
  "\u5de5\u5355\u4f18\u5148\u7ea7\u5982\u4f55\u9009\u62e9\uff1f",
  "\u5e38\u89c1\u7f51\u7edc\u6545\u969c\u5982\u4f55\u6392\u67e5\uff1f",
];

const SESSION_KEY = "assistant_chat_history";

function loadSession(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSession(messages: ChatMessage[]) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
  } catch {
    // ignore quota errors
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function AssistantPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(loadSession);
  const askMutation = useAskQuestion();

  const queryFromUrl = searchParams.get("q") || "";

  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    setValue,
    watch,
    reset,
  } = useForm<QuestionForm>({
    resolver: zodResolver(questionSchema),
    defaultValues: { question: queryFromUrl },
  });

  const questionValue = watch("question");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    saveSession(messages);
  }, [messages]);

  const onSend = useCallback(
    async (data: QuestionForm) => {
      const trimmed = data.question.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      reset({ question: "" });

      try {
        const response = await askMutation.mutateAsync(trimmed);

        const dedupedSources = response.sources
          ? response.sources.filter(
              (s: SourceResponse, i: number, arr: SourceResponse[]) =>
                arr.findIndex((x) => x.articleId === s.articleId) === i
            )
          : [];

        const aiMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: response.answer,
          grounded: response.grounded,
          sources: dedupedSources,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        const apiErr = err as ApiError;
        const status = apiErr?.response?.status;
        const detail =
          apiErr?.response?.data?.detail ?? "\u8bf7\u6c42\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5";

        let errorContent: string;
        if (status === 503) {
          errorContent =
            "AI \u670d\u52a1\u5f53\u524d\u672a\u542f\u7528\u3002\u4f60\u4ecd\u7136\u53ef\u4ee5\u641c\u7d22\u77e5\u8bc6\u5e93\u6216\u63d0\u4ea4\u5de5\u5355\u3002";
        } else if (status === 502) {
          errorContent =
            "AI \u670d\u52a1\u6682\u65f6\u54cd\u5e94\u5f02\u5e38\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002";
        } else {
          errorContent = detail;
        }

        const errorMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: errorContent,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    },
    [askMutation, reset]
  );

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    if (lastUserMsg) {
      setValue("question", lastUserMsg.content);
      onSend({ question: lastUserMsg.content });
    }
  }, [messages, setValue, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isSubmitting && questionValue?.trim()) {
          handleSubmit(onSend)();
        }
      }
    },
    [isSubmitting, questionValue, handleSubmit, onSend]
  );

  const handleRecommend = useCallback(
    (q: string) => {
      setValue("question", q);
      handleSubmit(onSend)();
    },
    [setValue, handleSubmit, onSend]
  );

  const handleCreateTicket = useCallback(() => {
    const lastUserMsg = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    navigate("/tickets/new", {
      state: { description: lastUserMsg?.content ?? "" },
    });
  }, [messages, navigate]);

  const isLastMsgUngrounded = (() => {
    const last = messages[messages.length - 1];
    return last?.role === "assistant" && last.grounded === false;
  })();

  const isLastMsg503 = (() => {
    const last = messages[messages.length - 1];
    return (
      last?.role === "assistant" &&
      last.content?.includes("AI \u670d\u52a1\u5f53\u524d\u672a\u542f\u7528")
    );
  })();

  const isLastMsg502 = (() => {
    const last = messages[messages.length - 1];
    return (
      last?.role === "assistant" &&
      last.content?.includes("\u54cd\u5e94\u5f02\u5e38")
    );
  })();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 130px)",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      <div style={{ textAlign: "center", padding: "16px 0" }}>
        <Title level={4} style={{ margin: 0 }}>
          <RobotOutlined style={{ marginRight: 8 }} />
          ServiceMind AI 助手
        </Title>
        <Text type="secondary">
          基于已发布知识文章回答问题
        </Text>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 0",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 40 }}>
            <RobotOutlined
              style={{ fontSize: 48, color: "#2563EB", marginBottom: 16 }}
            />
            <Paragraph type="secondary" style={{ marginBottom: 24 }}>
              尝试提问以下问题，或在下方输入你的问题
            </Paragraph>
            <Space wrap style={{ justifyContent: "center" }}>
              {RECOMMENDED_QUESTIONS.map((q) => (
                <Tag
                  key={q}
                  color="blue"
                  style={{ cursor: "pointer", padding: "4px 12px", fontSize: 13 }}
                  onClick={() => handleRecommend(q)}
                >
                  {q}
                </Tag>
              ))}
            </Space>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <Card
                size="small"
                style={{
                  maxWidth: "85%",
                  backgroundColor:
                    msg.role === "user" ? "#EFF6FF" : "#FFFFFF",
                  borderColor:
                    msg.role === "user" ? "#BFDBFE" : "#E5E7EB",
                }}
              >
                {msg.role === "assistant" && msg.content ? (
                  msg.grounded !== undefined && msg.grounded !== null ? (
                    msg.grounded ? (
                      <div style={{ lineHeight: 1.7 }}>
                        <Markdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeSanitize]}
                        >
                          {msg.content}
                        </Markdown>
                      </div>
                    ) : (
                      <div>
                        <Text type="secondary">{msg.content}</Text>
                      </div>
                    )
                  ) : (
                    <div style={{ whiteSpace: "pre-wrap" }}>
                      <Text>{msg.content}</Text>
                    </div>
                  )
                ) : (
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    <Text>{msg.content}</Text>
                  </div>
                )}

                {msg.role === "assistant" &&
                  msg.grounded !== undefined &&
                  msg.grounded && (
                    <Tag color="green" style={{ marginTop: 8 }}>
                      基于知识库
                    </Tag>
                  )}

                {msg.role === "assistant" &&
                  msg.sources &&
                  msg.sources.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        参考来源：
                      </Text>
                      <Space wrap style={{ marginTop: 4 }} size={[4, 4]}>
                        {msg.sources.map((src) => (
                          <Tag
                            key={src.articleId}
                            color="default"
                            style={{ cursor: "pointer" }}
                            onClick={() =>
                              navigate("/knowledge/" + src.articleId)
                            }
                          >
                            <FileTextOutlined style={{ marginRight: 4 }} />
                            {src.title}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  )}
              </Card>
              <Text
                type="secondary"
                style={{ fontSize: 11, marginTop: 2, marginLeft: 8, marginRight: 8 }}
              >
                {new Date(msg.timestamp).toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </div>
          ))
        )}

        {isLastMsgUngrounded && (
          <div style={{ textAlign: "center", padding: 16 }}>
            <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
              知识库中没有找到足够信息。你可以换一种描述，或提交人工工单。
            </Text>
            <Space>
              <Button
                icon={<SearchOutlined />}
                onClick={() =>
                  navigate(
                    "/knowledge?q=" +
                      encodeURIComponent(
                        messages
                          .filter((m) => m.role === "user")
                          .slice(-1)[0]
                          ?.content ?? ""
                      )
                  )
                }
              >
                搜索知识库
              </Button>
              <Button
                type="primary"
                icon={<PlusCircleOutlined />}
                onClick={handleCreateTicket}
              >
                创建工单
              </Button>
            </Space>
          </div>
        )}

        {isLastMsg503 && (
          <div style={{ textAlign: "center", padding: 16 }}>
            <Space>
              <Button
                icon={<SearchOutlined />}
                onClick={() => navigate("/knowledge")}
              >
                搜索知识库
              </Button>
              <Button
                type="primary"
                icon={<PlusCircleOutlined />}
                onClick={handleCreateTicket}
              >
                提交工单
              </Button>
            </Space>
          </div>
        )}

        {isLastMsg502 && (
          <div style={{ textAlign: "center", padding: 16 }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRetry}
            >
              重新发送
            </Button>
          </div>
        )}

        {askMutation.isPending && (
          <div style={{ padding: "0 16px" }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          padding: "12px 0",
          borderTop: "1px solid #E5E7EB",
          backgroundColor: "#FFFFFF",
        }}
      >
        {errors.question && (
          <Text type="danger" style={{ fontSize: 12, marginBottom: 4, display: "block" }}>
            {errors.question.message}
          </Text>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <Controller
            name="question"
            control={control}
            render={({ field }) => (
              <TextArea
                {...field}
                placeholder="输入你的问题..."
                rows={2}
                maxLength={2000}
                onKeyDown={handleKeyDown}
                autoFocus
                disabled={askMutation.isPending}
                style={{ flex: 1 }}
              />
            )}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={askMutation.isPending}
            disabled={!questionValue?.trim()}
            onClick={handleSubmit(onSend)}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
