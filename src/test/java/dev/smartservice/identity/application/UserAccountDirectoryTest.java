package dev.smartservice.identity.application;

import dev.smartservice.identity.domain.UserAccount;
import dev.smartservice.identity.domain.UserRole;
import org.junit.jupiter.api.Test;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class UserAccountDirectoryTest {

    private final UserAccountRepository repository = mock(UserAccountRepository.class);
    private final UserAccountDirectory directory = new UserAccountDirectory(repository);

    @Test
    void allowsEnabledAgentToReceiveTickets() {
        UserAccount agent = new UserAccount("agent-one", "password-hash", Set.of(UserRole.AGENT));
        when(repository.findByUsernameIgnoreCase("agent-one")).thenReturn(Optional.of(agent));

        assertThat(directory.canBeAssignedTickets("agent-one")).isTrue();
    }

    @Test
    void rejectsRequesterAsTicketAssignee() {
        UserAccount requester = new UserAccount("requester-one", "password-hash", Set.of(UserRole.REQUESTER));
        when(repository.findByUsernameIgnoreCase("requester-one")).thenReturn(Optional.of(requester));

        assertThat(directory.canBeAssignedTickets("requester-one")).isFalse();
    }
}
