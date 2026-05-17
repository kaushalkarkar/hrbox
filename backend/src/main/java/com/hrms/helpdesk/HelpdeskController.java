package com.hrms.helpdesk;

import com.hrms.domain.*;
import com.hrms.notification.NotificationService;
import com.hrms.repo.EmployeeRepository;
import com.hrms.repo.TicketRepository;
import com.hrms.security.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/helpdesk")
@Transactional
public class HelpdeskController {

    private final TicketRepository tickets;
    private final EmployeeRepository employees;
    private final NotificationService notifications;

    public HelpdeskController(TicketRepository tickets,
                              EmployeeRepository employees,
                              NotificationService notifications) {
        this.tickets = tickets;
        this.employees = employees;
        this.notifications = notifications;
    }

    public record TicketView(Long id,
                              Long raisedById, String raisedByCode, String raisedByName,
                              Long assigneeId, String assigneeName,
                              String category, String priority, String subject, String description,
                              String status, String resolution,
                              String createdAt, String updatedAt, String resolvedAt) {}

    public record CreateRequest(@NotBlank String category,
                                 @NotBlank String priority,
                                 @NotBlank @Size(max = 200) String subject,
                                 @NotBlank String description) {}

    public record AssignRequest(Long assigneeId) {}
    public record StatusRequest(@NotBlank String status, @Size(max = 1000) String resolution) {}

    public record StatsView(long openCount, long inProgressCount, long resolvedCount, long closedCount) {}

    private TicketView toView(Ticket t) {
        Employee rb = t.getRaisedBy();
        Employee a = t.getAssignee();
        return new TicketView(
                t.getId(),
                rb.getId(), rb.getEmployeeCode(), rb.getFirstName() + " " + rb.getLastName(),
                a == null ? null : a.getId(),
                a == null ? null : a.getFirstName() + " " + a.getLastName(),
                t.getCategory().name(), t.getPriority().name(),
                t.getSubject(), t.getDescription(),
                t.getStatus().name(), t.getResolution(),
                t.getCreatedAt().toString(),
                t.getUpdatedAt() == null ? null : t.getUpdatedAt().toString(),
                t.getResolvedAt() == null ? null : t.getResolvedAt().toString()
        );
    }

    private Employee currentEmployee() {
        UserAccount u = AuthPrincipal.current();
        if (u.getEmployee() == null)
            throw new ResponseStatusException(BAD_REQUEST, "User not linked to an employee");
        return u.getEmployee();
    }

    /* ===== List ===== */

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public List<TicketView> mine() {
        return tickets.findByRaisedByIdOrderByCreatedAtDesc(currentEmployee().getId())
                .stream().map(this::toView).toList();
    }

    @GetMapping("/assigned-to-me")
    @Transactional(readOnly = true)
    public List<TicketView> assignedToMe() {
        return tickets.findByAssigneeIdOrderByCreatedAtDesc(currentEmployee().getId())
                .stream().map(this::toView).toList();
    }

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public List<TicketView> all(@RequestParam(required = false) String status) {
        if (status == null || status.isBlank()) {
            return tickets.findAllByOrderByCreatedAtDesc().stream().map(this::toView).toList();
        }
        try {
            TicketStatus st = TicketStatus.valueOf(status);
            return tickets.findByStatusOrderByCreatedAtDesc(st).stream().map(this::toView).toList();
        } catch (Exception ex) {
            return tickets.findAllByOrderByCreatedAtDesc().stream().map(this::toView).toList();
        }
    }

    @GetMapping("/stats")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public StatsView stats() {
        long open = tickets.findByStatusOrderByCreatedAtDesc(TicketStatus.OPEN).size();
        long ip = tickets.findByStatusOrderByCreatedAtDesc(TicketStatus.IN_PROGRESS).size();
        long resolved = tickets.findByStatusOrderByCreatedAtDesc(TicketStatus.RESOLVED).size();
        long closed = tickets.findByStatusOrderByCreatedAtDesc(TicketStatus.CLOSED).size();
        return new StatsView(open, ip, resolved, closed);
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public TicketView get(@PathVariable Long id) {
        Ticket t = tickets.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Ticket not found"));
        ensureCanRead(t);
        return toView(t);
    }

    /* ===== Create ===== */

    @PostMapping
    public TicketView create(@Valid @RequestBody CreateRequest req) {
        TicketCategory cat;
        TicketPriority pri;
        try { cat = TicketCategory.valueOf(req.category()); pri = TicketPriority.valueOf(req.priority()); }
        catch (Exception ex) { throw new ResponseStatusException(BAD_REQUEST, "Invalid category or priority"); }

        Employee me = currentEmployee();
        Ticket t = Ticket.builder()
                .raisedBy(me)
                .category(cat).priority(pri)
                .subject(req.subject()).description(req.description())
                .status(TicketStatus.OPEN)
                .build();
        Ticket saved = tickets.save(t);

        // Notify admin(s) and HR — for simplicity, send to admin@hrms.local
        notifications.notifyByEmail(
                "admin@hrms.local",
                NotificationType.GENERIC,
                "New helpdesk ticket: " + req.subject(),
                me.getFirstName() + " " + me.getLastName() + " raised a " + pri + " " + cat + " ticket.",
                "/helpdesk"
        );
        return toView(saved);
    }

    /* ===== Assign / Update status ===== */

    @PutMapping("/{id}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public TicketView assign(@PathVariable Long id, @RequestBody AssignRequest req) {
        Ticket t = tickets.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Ticket not found"));
        Employee a = req.assigneeId() == null ? null
                : employees.findById(req.assigneeId())
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Unknown assignee"));
        t.setAssignee(a);
        if (t.getStatus() == TicketStatus.OPEN && a != null) t.setStatus(TicketStatus.IN_PROGRESS);

        // Notify the assignee
        if (a != null) {
            notifications.notifyByEmail(
                    a.getEmail(),
                    NotificationType.GENERIC,
                    "Ticket assigned: " + t.getSubject(),
                    "You have been assigned a " + t.getPriority() + " " + t.getCategory() + " ticket.",
                    "/helpdesk"
            );
        }
        return toView(t);
    }

    @PutMapping("/{id}/status")
    public TicketView updateStatus(@PathVariable Long id, @Valid @RequestBody StatusRequest req) {
        Ticket t = tickets.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Ticket not found"));
        ensureCanModify(t);

        TicketStatus st;
        try { st = TicketStatus.valueOf(req.status()); }
        catch (Exception ex) { throw new ResponseStatusException(BAD_REQUEST, "Invalid status"); }

        TicketStatus prior = t.getStatus();
        t.setStatus(st);
        if (req.resolution() != null && !req.resolution().isBlank()) t.setResolution(req.resolution());
        if (st == TicketStatus.RESOLVED || st == TicketStatus.CLOSED) {
            if (t.getResolvedAt() == null) t.setResolvedAt(Instant.now());
        }

        // Notify the raiser on transitions
        if (prior != st) {
            notifications.notifyByEmail(
                    t.getRaisedBy().getEmail(),
                    NotificationType.GENERIC,
                    "Ticket " + st.name().toLowerCase().replace('_', ' ') + ": " + t.getSubject(),
                    "Your ticket has been moved to " + st.name() +
                            (req.resolution() != null && !req.resolution().isBlank() ? " — " + req.resolution() : ""),
                    "/helpdesk"
            );
        }
        return toView(t);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        UserAccount user = AuthPrincipal.current();
        Ticket t = tickets.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Ticket not found"));
        boolean isAdmin = user.getRole() == Role.ADMIN;
        boolean isOwner = user.getEmployee() != null && user.getEmployee().getId().equals(t.getRaisedBy().getId());
        if (!isAdmin && !(isOwner && t.getStatus() == TicketStatus.OPEN)) {
            throw new ResponseStatusException(FORBIDDEN, "Only the owner (while OPEN) or an admin can delete a ticket");
        }
        tickets.delete(t);
        return ResponseEntity.noContent().build();
    }

    /* ===== Permission helpers ===== */

    private void ensureCanRead(Ticket t) {
        UserAccount user = AuthPrincipal.current();
        if (user.getRole() == Role.ADMIN) return;
        Long me = user.getEmployee() == null ? null : user.getEmployee().getId();
        if (me != null && me.equals(t.getRaisedBy().getId())) return;
        if (me != null && t.getAssignee() != null && me.equals(t.getAssignee().getId())) return;
        throw new ResponseStatusException(FORBIDDEN, "Not allowed");
    }

    private void ensureCanModify(Ticket t) {
        UserAccount user = AuthPrincipal.current();
        if (user.getRole() == Role.ADMIN) return;
        Long me = user.getEmployee() == null ? null : user.getEmployee().getId();
        // The assignee can update status (work on it). The raiser can close their own ticket.
        if (me != null && t.getAssignee() != null && me.equals(t.getAssignee().getId())) return;
        if (me != null && me.equals(t.getRaisedBy().getId())) return;
        throw new ResponseStatusException(FORBIDDEN, "Not allowed");
    }
}
