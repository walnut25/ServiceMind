package dev.smartservice.knowledge.api;

import dev.smartservice.knowledge.application.KnowledgeArticleService;
import dev.smartservice.knowledge.domain.ArticleStatus;
import dev.smartservice.knowledge.domain.KnowledgeArticle;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@Validated
@RestController
@RequestMapping("/api/v1/knowledge/articles")
@Tag(name = "Knowledge", description = "Manage and search support knowledge articles")
public class KnowledgeArticleController {

    private final KnowledgeArticleService service;

    public KnowledgeArticleController(KnowledgeArticleService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT')")
    @Operation(summary = "Create a draft knowledge article")
    public ArticleResponse create(@Valid @RequestBody ArticleRequest request, Authentication authentication) {
        return ArticleResponse.from(service.create(request.title(), request.summary(), request.content(),
                request.category(), authentication.getName()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT')")
    @Operation(summary = "Update a knowledge article")
    public ArticleResponse update(@PathVariable long id, @Valid @RequestBody ArticleRequest request,
                                  Authentication authentication) {
        return ArticleResponse.from(service.update(id, request.title(), request.summary(), request.content(),
                request.category(), authentication.getName()));
    }

    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT')")
    @Operation(summary = "Publish a knowledge article")
    public ArticleResponse publish(@PathVariable long id, Authentication authentication) {
        return ArticleResponse.from(service.publish(id, authentication.getName()));
    }

    @PostMapping("/{id}/archive")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT')")
    @Operation(summary = "Archive a knowledge article")
    public ArticleResponse archive(@PathVariable long id, Authentication authentication) {
        return ArticleResponse.from(service.archive(id, authentication.getName()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT', 'REQUESTER')")
    @Operation(summary = "Get a visible knowledge article")
    public ArticleResponse get(@PathVariable long id, Authentication authentication) {
        return ArticleResponse.from(service.getVisible(id, canManage(authentication)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT', 'REQUESTER')")
    @Operation(summary = "List published knowledge articles")
    public Page<ArticleResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return service.listPublished(pageable).map(ArticleResponse::from);
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT', 'REQUESTER')")
    @Operation(summary = "Full-text search published knowledge articles")
    public Page<ArticleResponse> search(
            @RequestParam @NotBlank @Size(max = 200) String query,
            @PageableDefault(size = 20) Pageable pageable) {
        return service.searchPublished(query, pageable).map(ArticleResponse::from);
    }

    private boolean canManage(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority -> authority.equals("ROLE_ADMIN") || authority.equals("ROLE_AGENT"));
    }

    public record ArticleRequest(
            @Schema(example = "Resolve VPN connection failures")
            @NotBlank @Size(max = 200) String title,
            @Schema(example = "Checks for common VPN gateway and client failures")
            @NotBlank @Size(max = 500) String summary,
            @Schema(example = "1. Check the gateway status...", description = "Article body in Markdown")
            @NotBlank @Size(max = 100_000) String content,
            @Schema(example = "Network")
            @NotBlank @Size(max = 100) String category) {
    }

    public record ArticleResponse(long id, String title, String summary, String content, String category,
                                  ArticleStatus status, String createdBy, String updatedBy, Instant createdAt,
                                  Instant updatedAt, Instant publishedAt, long version) {
        static ArticleResponse from(KnowledgeArticle article) {
            return new ArticleResponse(article.getId(), article.getTitle(), article.getSummary(),
                    article.getContent(), article.getCategory(), article.getStatus(), article.getCreatedBy(),
                    article.getUpdatedBy(), article.getCreatedAt(), article.getUpdatedAt(),
                    article.getPublishedAt(), article.getVersion());
        }
    }
}
