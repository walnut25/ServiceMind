package dev.smartservice.identity.api;

import dev.smartservice.identity.application.AuthenticationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "Authenticate users and issue access tokens")
public class AuthenticationController {

    private final AuthenticationService authenticationService;

    public AuthenticationController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @PostMapping("/login")
    @Operation(summary = "Log in")
    @ApiResponse(responseCode = "200", description = "Authentication succeeded")
    @ApiResponse(responseCode = "401", description = "Invalid username or password")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        AuthenticationService.AccessToken accessToken =
                authenticationService.login(request.username(), request.password());
        return new LoginResponse(accessToken.token(), "Bearer", accessToken.expiresAt());
    }

    public record LoginRequest(
            @Schema(example = "admin") @NotBlank String username,
            @Schema(example = "Admin123!") @NotBlank String password) {
    }

    public record LoginResponse(String accessToken, String tokenType, Instant expiresAt) {
    }
}
