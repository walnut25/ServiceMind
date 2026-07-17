CREATE TABLE knowledge_articles (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(500) NOT NULL,
    content LONGTEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_by VARCHAR(100) NOT NULL,
    updated_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    published_at TIMESTAMP(6) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    INDEX idx_knowledge_status_updated (status, updated_at),
    INDEX idx_knowledge_category_status (category, status),
    FULLTEXT INDEX ft_knowledge_content (title, summary, content)
);
