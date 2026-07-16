package dev.smartservice.identity.config;

import dev.smartservice.identity.application.UserAccountRepository;
import dev.smartservice.identity.domain.UserAccount;
import dev.smartservice.identity.domain.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;

@Component
public class AdminBootstrap implements ApplicationRunner {

    private final UserAccountRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final String username;
    private final String password;

    public AdminBootstrap(UserAccountRepository repository, PasswordEncoder passwordEncoder,
                          @Value("${bootstrap.admin.username}") String username,
                          @Value("${bootstrap.admin.password}") String password) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.username = username;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!repository.existsByUsernameIgnoreCase(username)) {
            repository.save(new UserAccount(username, passwordEncoder.encode(password),
                    EnumSet.of(UserRole.ADMIN)));
        }
    }
}
