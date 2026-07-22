import { describe, it, expect } from "vitest";
import { ticketKeys } from "@/hooks/useTickets";

describe("ticketKeys", () => {
  it("generates correct query keys", () => {
    expect(ticketKeys.all).toEqual(["tickets"]);
    expect(ticketKeys.lists()).toEqual(["tickets", "list"]);
    expect(ticketKeys.details()).toEqual(["tickets", "detail"]);
    expect(ticketKeys.detail(5)).toEqual(["tickets", "detail", 5]);
  });

  it("includes filter params in list key", () => {
    const key = ticketKeys.list({ page: 0, size: 20, status: "OPEN", sort: "createdAt,desc" });
    expect(key).toEqual(["tickets", "list", { page: 0, size: 20, status: "OPEN", sort: "createdAt,desc" }]);
  });
});