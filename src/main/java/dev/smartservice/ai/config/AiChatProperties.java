package dev.smartservice.ai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

@ConfigurationProperties(prefix = "ai.chat")
public record AiChatProperties(boolean enabled, String baseUrl, String apiKey, String model,
                               Duration timeout, int maxContextArticles) {
}
