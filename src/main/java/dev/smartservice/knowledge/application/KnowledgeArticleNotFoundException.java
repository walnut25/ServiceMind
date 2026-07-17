package dev.smartservice.knowledge.application;

public class KnowledgeArticleNotFoundException extends RuntimeException {
    public KnowledgeArticleNotFoundException(long id) {
        super("Knowledge article " + id + " was not found");
    }
}
