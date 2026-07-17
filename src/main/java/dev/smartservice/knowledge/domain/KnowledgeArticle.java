package dev.smartservice.knowledge.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.time.Instant;

@Entity
@Table(name = "knowledge_articles")
public class KnowledgeArticle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 500)
    private String summary;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String content;

    @Column(nullable = false, length = 100)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ArticleStatus status;

    @Column(name = "created_by", nullable = false, updatable = false, length = 100)
    private String createdBy;

    @Column(name = "updated_by", nullable = false, length = 100)
    private String updatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Version
    private long version;

    protected KnowledgeArticle() {
    }

    public KnowledgeArticle(String title, String summary, String content, String category, String actorUsername) {
        this.title = title;
        this.summary = summary;
        this.content = content;
        this.category = category;
        this.status = ArticleStatus.DRAFT;
        this.createdBy = actorUsername;
        this.updatedBy = actorUsername;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public void update(String title, String summary, String content, String category, String actorUsername) {
        if (status == ArticleStatus.ARCHIVED) {
            throw new InvalidArticleStateException("Archived articles cannot be edited");
        }
        this.title = title;
        this.summary = summary;
        this.content = content;
        this.category = category;
        this.updatedBy = actorUsername;
        this.updatedAt = Instant.now();
    }

    public void publish(String actorUsername) {
        if (status == ArticleStatus.ARCHIVED) {
            throw new InvalidArticleStateException("Archived articles cannot be published");
        }
        status = ArticleStatus.PUBLISHED;
        publishedAt = Instant.now();
        updatedBy = actorUsername;
        updatedAt = publishedAt;
    }

    public void archive(String actorUsername) {
        if (status == ArticleStatus.ARCHIVED) {
            throw new InvalidArticleStateException("Article is already archived");
        }
        status = ArticleStatus.ARCHIVED;
        updatedBy = actorUsername;
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getSummary() { return summary; }
    public String getContent() { return content; }
    public String getCategory() { return category; }
    public ArticleStatus getStatus() { return status; }
    public String getCreatedBy() { return createdBy; }
    public String getUpdatedBy() { return updatedBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getPublishedAt() { return publishedAt; }
    public long getVersion() { return version; }
}
