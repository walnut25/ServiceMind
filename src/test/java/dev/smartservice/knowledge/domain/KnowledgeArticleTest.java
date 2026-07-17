package dev.smartservice.knowledge.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class KnowledgeArticleTest {

    @Test
    void publishesAndTracksTheActor() {
        KnowledgeArticle article = article();

        article.publish("agent-two");

        assertThat(article.getStatus()).isEqualTo(ArticleStatus.PUBLISHED);
        assertThat(article.getUpdatedBy()).isEqualTo("agent-two");
        assertThat(article.getPublishedAt()).isNotNull();
    }

    @Test
    void archivedArticleCannotBeEditedOrPublished() {
        KnowledgeArticle article = article();
        article.archive("admin");

        assertThatThrownBy(() -> article.update("New title", "Summary", "Content", "Network", "agent"))
                .isInstanceOf(InvalidArticleStateException.class)
                .hasMessage("Archived articles cannot be edited");
        assertThatThrownBy(() -> article.publish("agent"))
                .isInstanceOf(InvalidArticleStateException.class)
                .hasMessage("Archived articles cannot be published");
    }

    private KnowledgeArticle article() {
        return new KnowledgeArticle("Resolve VPN failures", "Common VPN checks",
                "Check the gateway and client logs.", "Network", "admin");
    }
}
