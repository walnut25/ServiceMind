import { Result, Typography } from "antd";

const { Paragraph } = Typography;

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <Result
      status="info"
      title={title}
      subTitle={
        description ?? "此功能将在后续阶段实现，敬请期待。"
      }
    >
      <Paragraph type="secondary">
        该页面尚未开发，标记为将在后续阶段实现。
      </Paragraph>
    </Result>
  );
}
