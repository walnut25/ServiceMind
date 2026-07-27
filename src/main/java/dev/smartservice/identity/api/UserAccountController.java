package dev.smartservice.identity.api;

import dev.smartservice.identity.application.UserAccountService;
import dev.smartservice.identity.domain.UserAccount;
import dev.smartservice.identity.domain.UserRole;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Set;

@Validated
@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "Users", description = "User administration and assignment candidates")
public class UserAccountController {

    private final UserAccountService service;

    public UserAccountController(UserAccountService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Create a user account")
    public UserResponse create(@Valid @RequestBody CreateUserRequest request) {
        return UserResponse.from(service.create(request.username(), request.password(), request.roles()));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "List user accounts")
    public Page<UserResponse> list(@PageableDefault(size = 20) Pageable pageable) {
        return service.list(pageable).map(UserResponse::from);
    }

    @GetMapping("/assignees")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT')")
    @Operation(summary = "List enabled users who can be assigned tickets")
    public Page<AssignableUserResponse> listAssignable(@PageableDefault(size = 100) Pageable pageable) {
        return service.listAssignable(pageable).map(AssignableUserResponse::from);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Get a user account")
    public UserResponse get(@PathVariable long id) {
        return UserResponse.from(service.get(id));
    }

    @PatchMapping("/{id}/enabled")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Enable or disable a user account")
    public UserResponse changeEnabled(@PathVariable long id, @Valid @RequestBody ChangeEnabledRequest request,
                                      Authentication authentication) {
        return UserResponse.from(service.changeEnabled(id, request.enabled(), authentication.getName()));
    }

    public record CreateUserRequest(
            @Schema(example = "agent-one")
            @NotBlank @Size(min = 3, max = 100)
            @Pattern(regexp = "[A-Za-z0-9._-]+") String username,
            @Schema(example = "AgentPass123!")
            @NotBlank @Size(min = 12, max = 72) String password,
            @Schema(example = "[\"AGENT\"]")
            @NotEmpty Set<@NotNull UserRole> roles) {
    }

    public record ChangeEnabledRequest(@NotNull Boolean enabled) {
    }

    public record UserResponse(long id, String username, boolean enabled, Set<UserRole> roles, Instant createdAt) {
        static UserResponse from(UserAccount account) {
            return new UserResponse(account.getId(), account.getUsername(), account.isEnabled(),
                    account.getRoles(), account.getCreatedAt());
        }
    }

    public record AssignableUserResponse(long id, String username, Set<UserRole> roles) {
        static AssignableUserResponse from(UserAccount account) {
            return new AssignableUserResponse(account.getId(), account.getUsername(), account.getRoles());
        }
    }
}
