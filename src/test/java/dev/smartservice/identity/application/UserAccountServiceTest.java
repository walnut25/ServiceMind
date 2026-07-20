package dev.smartservice.identity.application;

import dev.smartservice.identity.domain.UserAccount;
import dev.smartservice.identity.domain.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UserAccountServiceTest {

    private UserAccountRepository repository;
    private PasswordEncoder passwordEncoder;
    private UserAccountService service;

    @BeforeEach
    void setUp() {
        repository = mock(UserAccountRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        service = new UserAccountService(repository, passwordEncoder);
    }

    @Test
    void createsEnabledUserWithEncodedPasswordAndRoles() {
        when(repository.existsByUsernameIgnoreCase("agent-one")).thenReturn(false);
        when(passwordEncoder.encode("AgentPass123!")).thenReturn("encoded-password");
        when(repository.saveAndFlush(any(UserAccount.class))).thenAnswer(invocation -> {
            UserAccount account = invocation.getArgument(0);
            ReflectionTestUtils.setField(account, "id", 42L);
            return account;
        });

        UserAccount created = service.create(" agent-one ", "AgentPass123!", Set.of(UserRole.AGENT));

        assertThat(created.getId()).isEqualTo(42L);
        assertThat(created.getUsername()).isEqualTo("agent-one");
        assertThat(created.getPasswordHash()).isEqualTo("encoded-password");
        assertThat(created.getRoles()).containsExactly(UserRole.AGENT);
        assertThat(created.isEnabled()).isTrue();
    }

    @Test
    void rejectsExistingUsernameIgnoringCase() {
        when(repository.existsByUsernameIgnoreCase("Agent-One")).thenReturn(true);

        assertThatThrownBy(() -> service.create("Agent-One", "AgentPass123!", Set.of(UserRole.AGENT)))
                .isInstanceOf(DuplicateUsernameException.class);
    }

    @Test
    void translatesConcurrentUniqueConstraintViolation() {
        when(repository.existsByUsernameIgnoreCase("agent-one")).thenReturn(false);
        when(passwordEncoder.encode("AgentPass123!")).thenReturn("encoded-password");
        when(repository.saveAndFlush(any(UserAccount.class))).thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> service.create("agent-one", "AgentPass123!", Set.of(UserRole.AGENT)))
                .isInstanceOf(DuplicateUsernameException.class);
    }

    @Test
    void preventsAdministratorFromDisablingOwnAccount() {
        UserAccount admin = account(1L, "admin", UserRole.ADMIN);
        when(repository.findById(1L)).thenReturn(Optional.of(admin));

        assertThatThrownBy(() -> service.changeEnabled(1L, false, "ADMIN"))
                .isInstanceOf(CannotDisableOwnAccountException.class);
        assertThat(admin.isEnabled()).isTrue();
    }

    @Test
    void disablesAnotherAccount() {
        UserAccount agent = account(2L, "agent-one", UserRole.AGENT);
        when(repository.findById(2L)).thenReturn(Optional.of(agent));

        UserAccount updated = service.changeEnabled(2L, false, "admin");

        assertThat(updated.isEnabled()).isFalse();
        verify(repository).findById(2L);
    }

    private UserAccount account(long id, String username, UserRole role) {
        UserAccount account = new UserAccount(username, "encoded-password", Set.of(role));
        ReflectionTestUtils.setField(account, "id", id);
        return account;
    }
}
