import { useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Typography,
  Form,
  Input,
  Button,
  Space,
  Card,
  Tabs,
  Skeleton,
  Divider,
  message,
  Modal,
  Result,
  Grid,
} from "antd";
import {
  BoldOutlined,
  OrderedListOutlined,
  CodeOutlined,
  LinkOutlined,
  SendOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import {
  useArticle,
  useCreateArticle,
  useUpdateArticle,
  usePublishArticle,
} from "@/hooks/useKnowledge";
import { publishArticle } from "@/api/knowledge";
import type { ApiError } from "@/types/error";

const { Title } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

const articleSchema = z.object({
  title: z.string().min(1, "请输入标题").max(200, "标题不超过200字符"),
  summary: z.string().min(1, "请输入摘要").max(500, "摘要不超过500字符"),
  content: z.string().min(1, "请输入正文").max(100000, "正文不超过100000字符"),
  category: z.string().min(1, "请输入分类").max(100, "分类不超过100字符"),
});

type ArticleFormValues = z.infer<typeof articleSchema>;

const TOOLBAR_BUTTONS = [
  { label: "H2", insert: "## ", icon: null, hint: "标题" },
  { label: null, insert: "**", icon: <BoldOutlined />, hint: "加粗", wrap: true },
  { label: null, insert: "- ", icon: <OrderedListOutlined />, hint: "列表" },
  { label: null, insert: "> ", icon: null, hint: "引用" },
  { label: null, insert: "`\n\n`", icon: <CodeOutlined />, hint: "代码块" },
  { label: null, insert: "[text](url)", icon: <LinkOutlined />, hint: "链接" },
];

export function ArticleEditPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const isEdit = !!articleId;
  const id = Number(articleId);
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isSmall = !screens.md;

  const { data: article, isLoading: articleLoading } = useArticle(id);
  const createMutation = useCreateArticle();
  const updateMutation = useUpdateArticle(id);
  const publishMutation = usePublishArticle(id);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty, isSubmitting },
    setError,
    watch,
    setValue,
    getValues,
    reset,
  } = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: { title: "", summary: "", content: "", category: "" },
  });

  const contentValue = watch("content");

  useEffect(() => {
    if (article) {
      reset({
        title: article.title,
        summary: article.summary,
        content: article.content,
        category: article.category,
      });
    }
  }, [article, reset]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const navigateAway = useCallback((path: string) => {
    if (isDirty) {
      Modal.confirm({
        title: "未保存的更改",
        content: "离开此页面将丢失未保存的内容，确定要离开吗？",
        okText: "确定离开",
        cancelText: "继续编辑",
        onOk: () => navigate(path),
      });
    } else {
      navigate(path);
    }
  }, [isDirty, navigate]);

  const insertText = (before: string, after?: string, isWrap?: boolean) => {
    const textarea = document.querySelector("textarea");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = getValues("content").substring(start, end);

    if (isWrap) {
      const newText =
        getValues("content").substring(0, start) +
        before +
        (selected || "文本") +
        before +
        getValues("content").substring(end);
      setValue("content", newText, { shouldDirty: true });
    } else if (after !== undefined) {
      const newText =
        getValues("content").substring(0, start) +
        before +
        getValues("content").substring(end);
      setValue("content", newText, { shouldDirty: true });
    } else {
      const newText =
        getValues("content").substring(0, start) +
        before +
        getValues("content").substring(end);
      setValue("content", newText, { shouldDirty: true });
    }
  };

  const handleSave = async (data: ArticleFormValues, thenPublish = false) => {
    try {
      let savedArticle: { id: number };
      if (isEdit) {
        savedArticle = await updateMutation.mutateAsync(data);
      } else {
        savedArticle = await createMutation.mutateAsync(data);
      }

      if (thenPublish) {
        const publishId = isEdit ? id : savedArticle.id;
        try {
          await publishArticle(publishId);
          message.success("文章已保存并发布");
          reset(data);
          navigate("/knowledge/" + publishId);
        } catch {
          message.warning("文章已保存为草稿，但发布失败，请稍后手动发布。");
          reset(data);
          navigate("/knowledge/" + publishId);
        }
      } else {
        message.success(isEdit ? "文章已更新" : "草稿已保存");
        reset(data);
        navigate("/knowledge/" + (isEdit ? id : savedArticle.id));
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr?.response?.status === 409) {
        message.warning("文章已被其他人修改，请刷新后重试。本地编辑内容已保留。");
      } else {
        const detail = apiErr?.response?.data?.detail ?? "保存失败";
        setError("root", { message: detail });
      }
    }
  };

  if (isEdit && articleLoading) return <Skeleton active paragraph={{ rows: 8 }} />;

  if (isEdit && !article && !articleLoading) {
    return <Result status="404" title="文章不存在" />;
  }

  const editorContent = (
    <>
      {errors.root && (
        <div style={{
          color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA",
          borderRadius: 8, padding: "8px 16px", marginBottom: 16,
        }}>
          {errors.root.message}
        </div>
      )}

      <Form.Item
        label="标题"
        validateStatus={errors.title ? "error" : ""}
        help={errors.title?.message}
      >
        <Controller
          name="title" control={control}
          render={({ field }) => <Input {...field} placeholder="文章标题" maxLength={200} showCount />}
        />
      </Form.Item>

      <Form.Item
        label="摘要"
        validateStatus={errors.summary ? "error" : ""}
        help={errors.summary?.message}
      >
        <Controller
          name="summary" control={control}
          render={({ field }) => <TextArea {...field} rows={2} placeholder="简短摘要" maxLength={500} showCount />}
        />
      </Form.Item>

      <Form.Item
        label="分类"
        validateStatus={errors.category ? "error" : ""}
        help={errors.category?.message}
      >
        <Controller
          name="category" control={control}
          render={({ field }) => <Input {...field} placeholder="例如：网络、数据库" maxLength={100} />}
        />
      </Form.Item>

      <Divider style={{ margin: "8px 0" }} />

      <Space style={{ marginBottom: 8 }} wrap>
        {TOOLBAR_BUTTONS.map((btn, i) => (
          <Button
            key={i}
            size="small"
            icon={btn.icon}
            title={btn.hint}
            onClick={() => insertText(btn.insert, btn.label ? "" : undefined, (btn as { wrap?: boolean }).wrap)}
          >
            {btn.label || ""}
          </Button>
        ))}
      </Space>

      <Form.Item
        validateStatus={errors.content ? "error" : ""}
        help={errors.content?.message}
      >
        <Controller
          name="content" control={control}
          render={({ field }) => (
            <TextArea
              {...field}
              rows={16}
              placeholder="Markdown 正文"
              style={{ fontFamily: "monospace", fontSize: 14 }}
            />
          )}
        />
      </Form.Item>
    </>
  );

  const previewContent = (
    <Card title="预览" size="small" styles={{ body: { padding: 16 } }}>
      <div style={{ lineHeight: 1.8 }}>
        {contentValue ? (
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {contentValue}
          </Markdown>
        ) : (
          <Typography.Text type="secondary">在左侧输入 Markdown 内容即可预览</Typography.Text>
        )}
      </div>
    </Card>
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16, flexWrap: "wrap", gap: 8,
      }}>
        <Title level={4} style={{ margin: 0 }}>
          {isEdit ? "编辑文章" : "新建文章"}
        </Title>
        <Space>
          <Button onClick={() => navigateAway("/knowledge")}>取消</Button>
          <Button
            icon={<SaveOutlined />}
            loading={isSubmitting && !publishMutation.isPending}
            onClick={() => handleSubmit((d) => handleSave(d, false))()}
          >
            保存草稿
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={isSubmitting && publishMutation.isPending}
            onClick={() => handleSubmit((d) => handleSave(d, true))()}
          >
            保存并发布
          </Button>
        </Space>
      </div>

      {isSmall ? (
        <Tabs
          items={[
            { key: "edit", label: "编辑", children: editorContent },
            { key: "preview", label: "预览", children: previewContent },
          ]}
        />
      ) : (
        <div style={{ display: "flex", gap: 16, flexWrap: isSmall ? "wrap" : "nowrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>{editorContent}</div>
          <div style={{ flex: 1, minWidth: 0 }}>{previewContent}</div>
        </div>
      )}
    </div>
  );
}
