package dev.smartservice.knowledge.application;

import dev.smartservice.knowledge.domain.ArticleStatus;
import dev.smartservice.knowledge.domain.KnowledgeArticle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class KnowledgeArticleService {

    private final KnowledgeArticleRepository repository;

    public KnowledgeArticleService(KnowledgeArticleRepository repository) {
        this.repository = repository;
    }

    public KnowledgeArticle create(String title, String summary, String content, String category, String actor) {
        return repository.save(new KnowledgeArticle(title, summary, content, category, actor));
    }

    @Transactional(readOnly = true)
    public KnowledgeArticle get(long id) {
        return repository.findById(id).orElseThrow(() -> new KnowledgeArticleNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public KnowledgeArticle getVisible(long id, boolean canManage) {
        KnowledgeArticle article = get(id);
        if (!canManage && article.getStatus() != ArticleStatus.PUBLISHED) {
            throw new KnowledgeArticleNotFoundException(id);
        }
        return article;
    }

    @Transactional(readOnly = true)
    public Page<KnowledgeArticle> listPublished(Pageable pageable) {
        return repository.findByStatus(ArticleStatus.PUBLISHED, pageable);
    }

    @Transactional(readOnly = true)
    public Page<KnowledgeArticle> searchPublished(String query, Pageable pageable) {
        return repository.searchPublished(query.trim(), pageable);
    }

    public KnowledgeArticle update(long id, String title, String summary, String content, String category,
                                   String actor) {
        KnowledgeArticle article = get(id);
        article.update(title, summary, content, category, actor);
        return article;
    }

    public KnowledgeArticle publish(long id, String actor) {
        KnowledgeArticle article = get(id);
        article.publish(actor);
        return article;
    }

    public KnowledgeArticle archive(long id, String actor) {
        KnowledgeArticle article = get(id);
        article.archive(actor);
        return article;
    }
}
