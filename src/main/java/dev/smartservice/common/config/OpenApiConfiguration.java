package dev.smartservice.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfiguration {

    @Bean
    OpenAPI smartServiceOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("Smart Service API")
                        .description("AI-assisted enterprise ticket and knowledge platform API")
                        .version("v1")
                        .contact(new Contact().name("Smart Service Team"))
                        .license(new License().name("Private project")))
                .servers(List.of(new Server().url("/").description("Current environment")));
    }
}
