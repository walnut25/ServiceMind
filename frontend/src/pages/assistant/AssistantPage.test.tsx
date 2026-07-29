import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntApp } from "antd";
import { AssistantPage } from "@/pages/assistant/AssistantPage";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const server = setupServer(
  http.post("/api/v1/ai/answers", () =>
    HttpResponse.json({
      answer: "No grounded answer is available.",
      grounded: false,
      sources: [],
    })
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

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

  afterAll(() => server.close());

  it("shows recommended questions when empty", () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: "VPN 无法连接怎么办？" })
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
    const recommendation = screen.getByRole("button", {
      name: "VPN 无法连接怎么办？",
    });
    await userEvent.click(recommendation);
    expect(
      screen.getByText("VPN 无法连接怎么办？")
    ).toBeDefined();
  });

  it("renders knowledge sources as semantic buttons", () => {
    sessionStorage.setItem(
      "assistant_chat_history",
      JSON.stringify([
        {
          id: "answer-with-source",
          role: "assistant",
          content: "answer",
          grounded: true,
          sources: [{ articleId: 7, title: "VPN guide" }],
          timestamp: Date.now(),
        },
      ])
    );

    renderPage();

    expect(screen.getByRole("button", { name: /VPN guide/ })).toBeDefined();
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
