package dev.smartservice.ai.application;

public interface ChatModelGateway {
    String generate(String systemPrompt, String userPrompt);
}
