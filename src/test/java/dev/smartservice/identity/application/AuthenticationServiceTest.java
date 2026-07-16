package dev.smartservice.identity.application;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class AuthenticationServiceTest {

    @Test
    void issuesHs256TokenWithAuthenticatedUserAndRoles() {
        SecretKey key = new SecretKeySpec(
                "test-jwt-secret-that-is-at-least-32-bytes".getBytes(StandardCharsets.UTF_8),
                "HmacSHA256");
        JwtEncoder encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
        JwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        AuthenticationManager authenticationManager = authentication ->
                UsernamePasswordAuthenticationToken.authenticated(
                        "admin", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        AuthenticationService service = new AuthenticationService(authenticationManager, encoder, Duration.ofMinutes(30));

        AuthenticationService.AccessToken accessToken = service.login("admin", "Admin123!");
        var jwt = decoder.decode(accessToken.token());

        assertThat(jwt.getSubject()).isEqualTo("admin");
        assertThat(jwt.getClaimAsString("scope")).isEqualTo("ADMIN");
        assertThat(jwt.getHeaders().get("alg")).isEqualTo("HS256");
        assertThat(accessToken.expiresAt()).isAfter(jwt.getIssuedAt());
    }
}
