package dev.smartservice.identity.application;

import dev.smartservice.identity.domain.UserAccount;
import dev.smartservice.identity.domain.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.Set;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    Optional<UserAccount> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    @Query("""
            select distinct account
            from UserAccount account
            join account.roles role
            where account.enabled = true and role in :roles
            """)
    Page<UserAccount> findAssignableUsers(@Param("roles") Set<UserRole> roles, Pageable pageable);
}
