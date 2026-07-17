package dev.smartservice.knowledge.application;

import dev.smartservice.knowledge.domain.KnowledgeArticle;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class KnowledgeArticleServiceTest {

    @Test
    void hidesDraftFromUsersWithoutManagementRole() {
        KnowledgeArticleRepository repository = mock(KnowledgeArticleRepository.class);
        KnowledgeArticle article = new KnowledgeArticle("Resolve VPN failures", "Common VPN checks",
                "Check the gateway and client logs.", "Network", "admin");
        when(repository.findById(7L)).thenReturn(Optional.of(article));
        KnowledgeArticleService service = new KnowledgeArticleService(repository);

        assertThatThrownBy(() -> service.getVisible(7L, false))
                .isInstanceOf(KnowledgeArticleNotFoundException.class);
    }
}
