package dev.smartservice.common.api;

import dev.smartservice.ticket.application.TicketNotFoundException;
import dev.smartservice.ticket.domain.InvalidTicketTransitionException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.security.core.AuthenticationException;

import java.net.URI;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(AuthenticationException.class)
    ProblemDetail handleAuthentication(HttpServletRequest request) {
        return problem(HttpStatus.UNAUTHORIZED, "Authentication failed", "Invalid username or password", request);
    }

    @ExceptionHandler(TicketNotFoundException.class)
    ProblemDetail handleNotFound(TicketNotFoundException exception, HttpServletRequest request) {
        return problem(HttpStatus.NOT_FOUND, "Ticket not found", exception.getMessage(), request);
    }

    @ExceptionHandler(InvalidTicketTransitionException.class)
    ProblemDetail handleInvalidTransition(InvalidTicketTransitionException exception, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "Invalid ticket transition", exception.getMessage(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        String detail = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .findFirst()
                .orElse("Request validation failed");
        return problem(HttpStatus.BAD_REQUEST, "Invalid request", detail, request);
    }

    private ProblemDetail problem(HttpStatus status, String title, String detail, HttpServletRequest request) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        problem.setInstance(URI.create(request.getRequestURI()));
        return problem;
    }
}
