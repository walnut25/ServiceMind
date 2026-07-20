package dev.smartservice.identity.application;

import dev.smartservice.identity.domain.UserAccount;
import dev.smartservice.identity.domain.UserRole;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Service
@Transactional
public class UserAccountService {

    private final UserAccountRepository repository;
    private final PasswordEncoder passwordEncoder;

    public UserAccountService(UserAccountRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    public UserAccount create(String username, String password, Set<UserRole> roles) {
        String normalizedUsername = username.strip();
        if (repository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new DuplicateUsernameException(normalizedUsername);
        }
        try {
            return repository.saveAndFlush(new UserAccount(normalizedUsername, passwordEncoder.encode(password), roles));
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateUsernameException(normalizedUsername);
        }
    }

    @Transactional(readOnly = true)
    public UserAccount get(long id) {
        return repository.findById(id).orElseThrow(() -> new UserAccountNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public Page<UserAccount> list(Pageable pageable) {
        return repository.findAll(pageable);
    }

    public UserAccount changeEnabled(long id, boolean enabled, String actorUsername) {
        UserAccount account = get(id);
        if (!enabled && account.getUsername().equalsIgnoreCase(actorUsername)) {
            throw new CannotDisableOwnAccountException();
        }
        account.changeEnabled(enabled);
        return account;
    }
}
