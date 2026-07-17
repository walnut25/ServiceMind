package dev.smartservice.ai.api;

import dev.smartservice.ai.application.RagAnswerService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/ai")
@Tag(name = "AI Assistant", description = "Grounded answers from published knowledge articles")
public class AiAnswerController {

    private final RagAnswerService service;

    public AiAnswerController(RagAnswerService service) {
        this.service = service;
    }

    @PostMapping("/answers")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT', 'REQUESTER')")
    @Operation(summary = "Answer a question using retrieved knowledge articles")
    public AnswerResponse answer(@Valid @RequestBody AnswerRequest request) {
        RagAnswerService.Answer answer = service.answer(request.question());
        List<SourceResponse> sources = answer.sources().stream()
                .map(source -> new SourceResponse(source.articleId(), source.title()))
                .toList();
        return new AnswerResponse(answer.answer(), answer.grounded(), sources);
    }

    public record AnswerRequest(
            @Schema(example = "How do I troubleshoot a VPN connection failure?")
            @NotBlank @Size(max = 2_000) String question) {
    }

    public record AnswerResponse(String answer, boolean grounded, List<SourceResponse> sources) {
    }

    public record SourceResponse(long articleId, String title) {
    }
}
