package dev.smartservice.ai.infrastructure;

import dev.smartservice.ai.application.AiNotConfiguredException;
import dev.smartservice.ai.application.AiProviderException;
import dev.smartservice.ai.application.ChatModelGateway;
import dev.smartservice.ai.config.AiChatProperties;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;

@Component
public class OpenAiCompatibleChatClient implements ChatModelGateway {

    private final RestClient restClient;
    private final AiChatProperties properties;

    public OpenAiCompatibleChatClient(RestClient aiRestClient, AiChatProperties properties) {
        this.restClient = aiRestClient;
        this.properties = properties;
    }

    @Override
    public String generate(String systemPrompt, String userPrompt) {
        if (!properties.enabled() || properties.apiKey() == null || properties.apiKey().isBlank()) {
            throw new AiNotConfiguredException();
        }
        ChatRequest request = new ChatRequest(properties.model(), List.of(
                new Message("system", systemPrompt),
                new Message("user", userPrompt)), 0.2);
        try {
            ChatResponse response = restClient.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .headers(headers -> headers.setBearerAuth(properties.apiKey()))
                    .body(request)
                    .retrieve()
                    .body(ChatResponse.class);
            if (response == null || response.choices() == null || response.choices().isEmpty()
                    || response.choices().getFirst().message() == null
                    || response.choices().getFirst().message().content() == null) {
                throw new AiProviderException("AI provider returned an empty response", null);
            }
            return response.choices().getFirst().message().content();
        } catch (RestClientException exception) {
            throw new AiProviderException("AI provider request failed", exception);
        }
    }

    record ChatRequest(String model, List<Message> messages, double temperature) {
    }

    record Message(String role, String content) {
    }

    record ChatResponse(List<Choice> choices) {
    }

    record Choice(Message message) {
    }
}
