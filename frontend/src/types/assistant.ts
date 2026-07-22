export interface AskRequest {
  question: string;
}

export interface SourceResponse {
  articleId: number;
  title: string;
}

export interface AskResponse {
  answer: string;
  grounded: boolean;
  sources: SourceResponse[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  grounded?: boolean;
  sources?: SourceResponse[];
  timestamp: number;
}
