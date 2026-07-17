package dev.smartservice.knowledge.domain;

public class InvalidArticleStateException extends RuntimeException {
    public InvalidArticleStateException(String message) {
        super(message);
    }
}
