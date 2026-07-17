package dev.smartservice.ai.application;

public class AiNotConfiguredException extends RuntimeException {
    public AiNotConfiguredException() {
        super("AI chat is disabled or AI_API_KEY is not configured");
    }
}
