package dev.smartservice.identity.application;

import dev.smartservice.identity.domain.UserRole;
import org.springframework.stereotype.Component;

@Component
public class UserAccountDirectory {

    private final UserAccountRepository repository;

    public UserAccountDirectory(UserAccountRepository repository) {
        this.repository = repository;
    }

    public boolean canBeAssignedTickets(String username) {
        return repository.findByUsernameIgnoreCase(username)
                .filter(account -> account.isEnabled())
                .map(account -> account.getRoles().contains(UserRole.ADMIN)
                        || account.getRoles().contains(UserRole.AGENT))
                .orElse(false);
    }
}
