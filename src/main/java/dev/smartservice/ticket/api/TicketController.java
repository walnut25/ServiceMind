package dev.smartservice.ticket.api;

import dev.smartservice.ticket.application.TicketService;
import dev.smartservice.ticket.domain.Ticket;
import dev.smartservice.ticket.domain.TicketAuditEvent;
import dev.smartservice.ticket.domain.TicketAuditEventType;
import dev.smartservice.ticket.domain.TicketComment;
import dev.smartservice.ticket.domain.TicketPriority;
import dev.smartservice.ticket.domain.TicketStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@Validated
@RestController
@RequestMapping("/api/v1/tickets")
@Tag(name = "Tickets", description = "Create, query, and transition support tickets")
public class TicketController {

    private final TicketService service;

    public TicketController(TicketService service) {
        this.service = service;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT', 'REQUESTER')")
    @Operation(summary = "Create a ticket", description = "Creates a ticket in OPEN status")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Ticket created"),
            @ApiResponse(responseCode = "400", description = "Request validation failed")
    })
    public TicketResponse create(@Valid @RequestBody CreateTicketRequest request, Authentication authentication) {
        return TicketResponse.from(service.create(request.title(), request.description(), request.priority(),
                authentication.getName()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT', 'REQUESTER')")
    @Operation(summary = "Get a ticket")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Ticket found"),
            @ApiResponse(responseCode = "404", description = "Ticket not found")
    })
    public TicketResponse get(@PathVariable long id, Authentication authentication) {
        return TicketResponse.from(service.getVisible(id, authentication.getName(), canManage(authentication)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT', 'REQUESTER')")
    @Operation(summary = "List tickets",
            description = "Filters by status, priority, or assignee. Requesters only see their own tickets.")
    public Page<TicketResponse> list(
            @RequestParam(required = false) TicketStatus status,
            @RequestParam(required = false) TicketPriority priority,
            @RequestParam(required = false) @Size(max = 100) String assignee,
            @PageableDefault(size = 20) Pageable pageable,
            Authentication authentication) {
        return service.list(status, priority, assignee, authentication.getName(), canManage(authentication), pageable)
                .map(TicketResponse::from);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT')")
    @Operation(summary = "Transition ticket status",
            description = "Allowed workflow: OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Status changed"),
            @ApiResponse(responseCode = "404", description = "Ticket not found"),
            @ApiResponse(responseCode = "409", description = "Status transition is not allowed")
    })
    public TicketResponse transition(@PathVariable long id, @Valid @RequestBody TransitionTicketRequest request,
                                     Authentication authentication) {
        return TicketResponse.from(service.transition(id, request.status(), authentication.getName()));
    }

    @PatchMapping("/{id}/assignee")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT')")
    @Operation(summary = "Assign a ticket",
            description = "Assigns the ticket to an enabled administrator or agent account")
    public TicketResponse assign(@PathVariable long id, @Valid @RequestBody AssignTicketRequest request,
                                 Authentication authentication) {
        return TicketResponse.from(service.assign(id, request.username(), authentication.getName()));
    }

    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT', 'REQUESTER')")
    @Operation(summary = "Add a ticket comment")
    public CommentResponse addComment(@PathVariable long id, @Valid @RequestBody AddCommentRequest request,
                                      Authentication authentication) {
        return CommentResponse.from(service.addComment(id, request.content(), authentication.getName(),
                canManage(authentication)));
    }

    @GetMapping("/{id}/comments")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT', 'REQUESTER')")
    @Operation(summary = "List ticket comments")
    public Page<CommentResponse> listComments(@PathVariable long id,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.ASC) Pageable pageable,
            Authentication authentication) {
        return service.listComments(id, authentication.getName(), canManage(authentication), pageable)
                .map(CommentResponse::from);
    }

    @GetMapping("/{id}/audit-events")
    @PreAuthorize("hasAnyRole('ADMIN', 'AGENT')")
    @Operation(summary = "List ticket audit events")
    public Page<AuditEventResponse> listAuditEvents(@PathVariable long id,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return service.listAuditEvents(id, pageable).map(AuditEventResponse::from);
    }

    public record CreateTicketRequest(
            @Schema(description = "Short description of the issue", example = "VPN unavailable")
            @NotBlank @Size(max = 200) String title,
            @Schema(description = "Detailed issue description", example = "The whole team cannot connect")
            @NotBlank @Size(max = 10_000) String description,
            @Schema(description = "Priority from urgent P1 to low P4", example = "P1")
            @NotNull TicketPriority priority) {
    }

    public record TransitionTicketRequest(
            @Schema(description = "Target status", example = "IN_PROGRESS")
            @NotNull TicketStatus status) {
    }

    public record AssignTicketRequest(
            @Schema(description = "Username of an enabled administrator or agent", example = "agent-one")
            @NotBlank @Size(max = 100) String username) {
    }

    public record AddCommentRequest(
            @Schema(description = "Comment text", example = "Investigating the VPN gateway logs")
            @NotBlank @Size(max = 10_000) String content) {
    }

    public record CommentResponse(long id, long ticketId, String authorUsername, String content, Instant createdAt) {
        static CommentResponse from(TicketComment comment) {
            return new CommentResponse(comment.getId(), comment.getTicketId(), comment.getAuthorUsername(),
                    comment.getContent(), comment.getCreatedAt());
        }
    }

    public record AuditEventResponse(long id, long ticketId, TicketAuditEventType eventType,
                                     String actorUsername, String details, Instant createdAt) {
        static AuditEventResponse from(TicketAuditEvent event) {
            return new AuditEventResponse(event.getId(), event.getTicketId(), event.getEventType(),
                    event.getActorUsername(), event.getDetails(), event.getCreatedAt());
        }
    }

    public record TicketResponse(long id, String title, String description, TicketPriority priority,
                                 TicketStatus status, String requesterUsername, String assigneeUsername,
                                 Instant createdAt, Instant updatedAt, long version) {
        static TicketResponse from(Ticket ticket) {
            return new TicketResponse(ticket.getId(), ticket.getTitle(), ticket.getDescription(),
                    ticket.getPriority(), ticket.getStatus(), ticket.getRequesterUsername(),
                    ticket.getAssigneeUsername(), ticket.getCreatedAt(), ticket.getUpdatedAt(), ticket.getVersion());
        }
    }

    private boolean canManage(Authentication authentication) {
        return authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .anyMatch(authority -> authority.equals("ROLE_ADMIN") || authority.equals("ROLE_AGENT"));
    }
}
