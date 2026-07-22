import { describe, it, expect } from "vitest";
import { formatAuditEvent } from "@/utils/auditFormat";

describe("formatAuditEvent", () => {
  it("formats TICKET_CREATED", () => {
    expect(formatAuditEvent("TICKET_CREATED", "test")).toBe("创建工单");
  });

  it("formats STATUS_CHANGED with details", () => {
    expect(formatAuditEvent("STATUS_CHANGED", "OPEN -> IN_PROGRESS")).toContain("状态变更");
    expect(formatAuditEvent("STATUS_CHANGED", "OPEN -> IN_PROGRESS")).toContain("OPEN -> IN_PROGRESS");
  });

  it("formats ASSIGNEE_CHANGED with details", () => {
    expect(formatAuditEvent("ASSIGNEE_CHANGED", "user1 -> user2")).toContain("变更负责人");
  });

  it("formats COMMENT_ADDED", () => {
    expect(formatAuditEvent("COMMENT_ADDED", "")).toBe("添加评论");
  });

  it("falls back for unknown event type", () => {
    expect(formatAuditEvent("UNKNOWN_TYPE", "something")).toBe("something");
  });

  it("falls back for empty", () => {
    expect(formatAuditEvent("", "fallback")).toBe("fallback");
  });
});