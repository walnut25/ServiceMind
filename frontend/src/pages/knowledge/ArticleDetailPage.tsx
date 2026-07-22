import { useParams, useNavigate } from "react-router-dom";
import {
  Typography,
  Card,
  Tag,
  Button,
  Skeleton,
  Alert,
  Result,
  Space,
  Divider,
  Descriptions,
  Popconfirm,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  EditOutlined,
  SendOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import {
  useArticle,
  usePublishArticle,
  useArchiveArticle,
} from "@/hooks/useKnowledge";
import { useAuthStore } from "@/stores/auth";
import { articleStatusLabels } from "@/utils/enums";
import type { ApiError } from "@/types/error";

const { Title, Paragraph } = Typography;

export function ArticleDetailPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const id = Number(articleId);
  const roles = useAuthStore((s) => s.roles);
  const canManage = roles.includes("ADMIN") || roles.includes("AGENT");

  const { data: article, isLoading, isError, error, refetch } = useArticle(id);
  const publishMutation = usePublishArticle(id);
  const archiveMutation = useArchiveArticle(id);

  const handlePublish = async () => {
    try {
      await publishMutation.mutateAsync();
      message.success("文章已发布");
    } catch (err) {
      const detail = (err as ApiError)?.response?.data?.detail ?? "发布失败";
      message.error(detail);
    }
  };

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync();
      message.success("文章已归档");
    } catch (err) {
      const detail = (err as ApiError)?.response?.data?.detail ?? "归档失败";
      message.error(detail);
    }
  };

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;

  if (isError) {
    const axiosErr = error as { response?: { status: number } } | null;
    if (axiosErr?.response?.status === 404) {
      return (
        <Result
          status="404"
          title="文章不存在或你无权访问"
          extra={
            <Button type="primary" onClick={() => navigate("/knowledge")}>
              返回知识库
            </Button>
          }
        />
      );
    }
    return (
      <Alert type="error" message="加载失败"
        action={<Button onClick={() => refetch()}>重试</Button>} />
    );
  }

  if (!article) return null;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <Button type="text" icon={<ArrowLeftOutlined />}
        onClick={() => navigate("/knowledge")} style={{ marginBottom: 16 }}>
        返回知识库
      </Button>

      <Card>
        <Title level={3} style={{ marginTop: 0 }}>{article.title}</Title>

        <Space style={{ marginBottom: 16 }} wrap>
          <Tag>{article.category}</Tag>
          <Tag color={article.status === "PUBLISHED" ? "green" : article.status === "DRAFT" ? "default" : "orange"}>
            {articleStatusLabels[article.status]}
          </Tag>
          {article.publishedAt && (
            <Tag color="blue">发布于 {new Date(article.publishedAt).toLocaleDateString("zh-CN")}</Tag>
          )}
        </Space>

        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {article.summary}
        </Paragraph>

        <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="作者">{article.createdBy}</Descriptions.Item>
          <Descriptions.Item label="更新者">{article.updatedBy}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{new Date(article.createdAt).toLocaleString("zh-CN")}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{new Date(article.updatedAt).toLocaleString("zh-CN")}</Descriptions.Item>
        </Descriptions>

        {canManage && (
          <Space style={{ marginBottom: 16 }}>
            <Button icon={<EditOutlined />}
              onClick={() => navigate("/knowledge/" + article.id + "/edit")}>
              编辑
            </Button>
            {article.status === "DRAFT" && (
              <Button type="primary" icon={<SendOutlined />}
                loading={publishMutation.isPending}
                onClick={handlePublish}>
                发布
              </Button>
            )}
            {article.status !== "ARCHIVED" && (
              <Popconfirm
                title="确定要归档此文章吗？"
                description="归档后普通用户将无法查看。"
                onConfirm={handleArchive}
                okText="确定归档"
                cancelText="取消"
              >
                <Button icon={<InboxOutlined />}
                  loading={archiveMutation.isPending}>
                  归档
                </Button>
              </Popconfirm>
            )}
          </Space>
        )}

        <Divider />

        <div style={{ lineHeight: 1.8 }}>
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {article.content}
          </Markdown>
        </div>
      </Card>
    </div>
  );
}
