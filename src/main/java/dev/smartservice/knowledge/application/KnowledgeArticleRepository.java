package dev.smartservice.knowledge.application;

import dev.smartservice.knowledge.domain.ArticleStatus;
import dev.smartservice.knowledge.domain.KnowledgeArticle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface KnowledgeArticleRepository extends JpaRepository<KnowledgeArticle, Long> {

    Page<KnowledgeArticle> findByStatus(ArticleStatus status, Pageable pageable);

    @Query(value = """
            SELECT * FROM knowledge_articles
            WHERE status = 'PUBLISHED'
              AND MATCH(title, summary, content) AGAINST (:query IN NATURAL LANGUAGE MODE)
            ORDER BY MATCH(title, summary, content) AGAINST (:query IN NATURAL LANGUAGE MODE) DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM knowledge_articles
            WHERE status = 'PUBLISHED'
              AND MATCH(title, summary, content) AGAINST (:query IN NATURAL LANGUAGE MODE)
            """,
            nativeQuery = true)
    Page<KnowledgeArticle> searchPublished(@Param("query") String query, Pageable pageable);
}
