import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntApp } from "antd";
import { AssistantPage } from "@/pages/assistant/AssistantPage";

function renderPage(route = "/assistant") {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ConfigProvider>
      <AntApp>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={[route]}>
            <AssistantPage />
          </MemoryRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

describe("AssistantPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("shows recommended questions when empty", () => {
    renderPage();
    expect(
      screen.getByText("VPN 无法连接怎么办？")
    ).toBeDefined();
  });

  it("send button is disabled when input is empty", () => {
    renderPage();
    const sendBtn = screen.getByRole("button", { name: /发送/ });
    expect(sendBtn).toBeDisabled();
  });

  it("enables send button when text entered", async () => {
    renderPage();
    const input = screen.getByPlaceholderText(
      "输入你的问题..."
    );
    await userEvent.type(input, "test question");
    const sendBtn = screen.getByRole("button", { name: /发送/ });
    await waitFor(() => {
    expect(sendBtn).not.toBeDisabled();
    });
  });

  it("prefills question from URL search params", async () => {
    renderPage("/assistant?q=prefilled");
    await waitFor(() => {
      const input = screen.getByPlaceholderText(
        "输入你的问题..."
      ) as HTMLTextAreaElement;
      expect(input.value).toBe("prefilled");
    });
  });

  it("restores session from sessionStorage", () => {
    sessionStorage.setItem(
      "assistant_chat_history",
      JSON.stringify([
        {
          id: "abc",
          role: "user",
          content: "hello",
          timestamp: Date.now(),
        },
      ])
    );
    renderPage();
    expect(screen.getByText("hello")).toBeDefined();
  });

  it("clicking recommendation fills and sends question", async () => {
    renderPage();
    const tag = screen.getByText("VPN 无法连接怎么办？");
    await userEvent.click(tag);
    expect(
      screen.getByText("VPN 无法连接怎么办？")
    ).toBeDefined();
  });

  it("Enter key sends the message", async () => {
    renderPage();
    const input = screen.getByPlaceholderText(
      "输入你的问题..."
    );
    await userEvent.type(input, "hello{Enter}");
    expect(screen.getByText("hello")).toBeDefined();
  });
});
