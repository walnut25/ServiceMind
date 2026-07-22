import { useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Typography,
  Card,
  Input,
  Row,
  Col,
  Skeleton,
  Alert,
  Empty,
  Button,
  Tag,
  Pagination,
  Space,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";
import { useArticleList, useArticleSearch } from "@/hooks/useKnowledge";
import { articleStatusLabels } from "@/utils/enums";
import type { ArticleResponse } from "@/types/knowledge";

const { Title, Paragraph, Text } = Typography;
const { Search } = Input;

export function ArticleListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roles = useAuthStore((s) => s.roles);
  const canManage = roles.includes("ADMIN") || roles.includes("AGENT");

  const query = searchParams.get("q") || "";
  const page = Number(searchParams.get("page") || "0");
  const size = 12;

  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
  } = useArticleList(page, size);
  const {
    data: searchData,
    isLoading: searchLoading,
    isError: searchError,
  } = useArticleSearch(query, page, size);

  const data = query ? searchData : listData;
  const isLoading = query ? searchLoading : listLoading;
  const isError = query ? searchError : listError;

  const handleSearch = useCallback(
    (value: string) => {
      const next = new URLSearchParams();
      if (value.trim()) next.set("q", value.trim());
      next.set("page", "0");
      setSearchParams(next);
    },
    [setSearchParams]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(newPage - 1));
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>知识库</Title>
          <Text type="secondary">查阅团队知识文章</Text>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Search
            placeholder="搜索文章..."
            allowClear
            defaultValue={query}
            onSearch={handleSearch}
            style={{ width: 280 }}
            prefix={<SearchOutlined />}
          />
          {canManage && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/knowledge/new")}
            >
              新建文章
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Row gutter={[16, 16]}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Col xs={24} sm={12} lg={8} key={i}>
              <Card><Skeleton active /></Card>
            </Col>
          ))}
        </Row>
      ) : isError ? (
        <Alert type="error" message="加载失败" description="无法加载文章列表" />
      ) : !data || data.content.length === 0 ? (
        query ? (
          <Empty description={"未找到与\"" + query + "\"相关的文章"}>
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={() =>
                navigate("/assistant?q=" + encodeURIComponent(query))
              }
            >
              向 AI 助手提问
            </Button>
          </Empty>
        ) : (
          <Empty description="暂无文章">
            {canManage && (
              <Button type="primary" onClick={() => navigate("/knowledge/new")}>
                创建第一篇文章
              </Button>
            )}
          </Empty>
        )
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {data.content.map((article: ArticleResponse) => (
              <Col xs={24} sm={12} lg={8} key={article.id}>
                <Card
                  hoverable
                  onClick={() => navigate("/knowledge/" + article.id)}
                  style={{ height: "100%" }}
                >
                  <Title level={5} ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                    {article.title}
                  </Title>
                  <Paragraph
                    type="secondary"
                    ellipsis={{ rows: 2 }}
                    style={{ marginBottom: 12, minHeight: 44 }}
                  >
                    {article.summary}
                  </Paragraph>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Space size={4} wrap>
                      <Tag>{article.category}</Tag>
                      <Tag color={article.status === "PUBLISHED" ? "green" : article.status === "DRAFT" ? "default" : "orange"}>
                        {articleStatusLabels[article.status]}
                      </Tag>
                    </Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(article.updatedAt).toLocaleDateString("zh-CN")}
                    </Text>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          {data.page.totalPages > 1 && (
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <Pagination
                current={data.page.number + 1}
                pageSize={data.page.size}
                total={data.page.totalElements}
                onChange={handlePageChange}
                showTotal={(t) => "共 " + t + " 篇"}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
