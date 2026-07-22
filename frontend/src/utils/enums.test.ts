import { describe, it, expect } from "vitest";
import {
  ticketStatusLabels,
  ticketPriorityLabels,
  articleStatusLabels,
} from "@/utils/enums";

describe("enum labels", () => {
  it("maps all ticket statuses", () => {
    expect(ticketStatusLabels.OPEN).toBe("待处理");
    expect(ticketStatusLabels.IN_PROGRESS).toBe("处理中");
    expect(ticketStatusLabels.RESOLVED).toBe("已解决");
    expect(ticketStatusLabels.CLOSED).toBe("已关闭");
    expect(Object.keys(ticketStatusLabels)).toHaveLength(4);
  });

  it("maps all ticket priorities", () => {
    expect(ticketPriorityLabels.P1).toBe("紧急");
    expect(ticketPriorityLabels.P2).toBe("高");
    expect(ticketPriorityLabels.P3).toBe("中");
    expect(ticketPriorityLabels.P4).toBe("低");
    expect(Object.keys(ticketPriorityLabels)).toHaveLength(4);
  });

  it("maps all article statuses", () => {
    expect(articleStatusLabels.DRAFT).toBe("草稿");
    expect(articleStatusLabels.PUBLISHED).toBe("已发布");
    expect(articleStatusLabels.ARCHIVED).toBe("已归档");
    expect(Object.keys(articleStatusLabels)).toHaveLength(3);
  });
});
