package dev.smartservice.ai.application;

import dev.smartservice.ai.config.AiChatProperties;
import dev.smartservice.knowledge.application.KnowledgeArticleService;
import dev.smartservice.knowledge.domain.KnowledgeArticle;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class KnowledgeContextRetriever {

    private static final int MAX_ARTICLE_CONTENT_LENGTH = 6_000;

    private final KnowledgeArticleService articleService;
    private final AiChatProperties properties;

    public KnowledgeContextRetriever(KnowledgeArticleService articleService, AiChatProperties properties) {
        this.articleService = articleService;
        this.properties = properties;
    }

    public List<KnowledgeContext> retrieve(String question) {
        int limit = Math.clamp(properties.maxContextArticles(), 1, 10);
        return articleService.searchPublished(question, PageRequest.of(0, limit)).stream()
                .map(this::toContext)
                .toList();
    }

    private KnowledgeContext toContext(KnowledgeArticle article) {
        String content = article.getContent().strip();
        if (content.length() > MAX_ARTICLE_CONTENT_LENGTH) {
            content = content.substring(0, MAX_ARTICLE_CONTENT_LENGTH);
        }
        return new KnowledgeContext(article.getId(), article.getTitle(), article.getSummary(), content);
    }

    public record KnowledgeContext(long articleId, String title, String summary, String content) {
    }
}
