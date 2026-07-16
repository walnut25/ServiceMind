package dev.smartservice.ticket.application;

import dev.smartservice.ticket.domain.Ticket;
import dev.smartservice.ticket.domain.TicketPriority;
import dev.smartservice.ticket.domain.TicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class TicketService {

    private final TicketRepository repository;

    public TicketService(TicketRepository repository) {
        this.repository = repository;
    }

    public Ticket create(String title, String description, TicketPriority priority) {
        return repository.save(new Ticket(title, description, priority));
    }

    @Transactional(readOnly = true)
    public Ticket get(long id) {
        return repository.findById(id).orElseThrow(() -> new TicketNotFoundException(id));
    }

    @Transactional(readOnly = true)
    public Page<Ticket> list(Pageable pageable) {
        return repository.findAll(pageable);
    }

    public Ticket transition(long id, TicketStatus status) {
        Ticket ticket = get(id);
        ticket.transitionTo(status);
        return ticket;
    }
}
