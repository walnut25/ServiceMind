import { useMutation } from "@tanstack/react-query";
import { askQuestion } from "@/api/assistant";

export function useAskQuestion() {
  return useMutation({
    mutationFn: (question: string) => askQuestion({ question }),
  });
}
