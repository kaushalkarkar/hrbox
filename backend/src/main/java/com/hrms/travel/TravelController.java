package com.hrms.travel;

import com.hrms.domain.*;
import com.hrms.notification.NotificationService;
import com.hrms.repo.EmployeeRepository;
import com.hrms.repo.TravelRequestRepository;
import com.hrms.security.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/travel")
@Transactional
public class TravelController {

    private final TravelRequestRepository repo;
    private final EmployeeRepository employees;
    private final NotificationService notifications;

    public TravelController(TravelRequestRepository repo,
                            EmployeeRepository employees,
                            NotificationService notifications) {
        this.repo = repo;
        this.employees = employees;
        this.notifications = notifications;
    }

    public record TravelView(
            Long id, Long employeeId, String employeeCode, String employeeName,
            String origin, String destination,
            String departureDate, String returnDate,
            String mode, String purpose,
            BigDecimal estimatedCost, String currency,
            String accommodation,
            String status, String decidedByName, String decisionComment,
            String createdAt, String decidedAt
    ) {}

    public record SubmitRequest(
            @NotBlank @Size(max = 120) String origin,
            @NotBlank @Size(max = 120) String destination,
            @NotNull LocalDate departureDate,
            @NotNull LocalDate returnDate,
            @NotBlank String mode,
            @NotBlank @Size(max = 500) String purpose,
            @DecimalMin(value = "0", inclusive = true) BigDecimal estimatedCost,
            @Size(max = 8) String currency,
            @Size(max = 500) String accommodation
    ) {}

    public record DecisionRequest(@Size(max = 500) String comment) {}

    public record StatsView(long pendingCount, long approvedCount, long bookedCount,
                            long completedCount, BigDecimal totalApprovedCost) {}

    private TravelView toView(TravelRequest t) {
        Employee emp = t.getEmployee();
        Employee dec = t.getDecidedBy();
        return new TravelView(
                t.getId(), emp.getId(), emp.getEmployeeCode(),
                emp.getFirstName() + " " + emp.getLastName(),
                t.getOrigin(), t.getDestination(),
                t.getDepartureDate().toString(), t.getReturnDate().toString(),
                t.getMode().name(), t.getPurpose(),
                t.getEstimatedCost(), t.getCurrency(),
                t.getAccommodation(),
                t.getStatus().name(),
                dec == null ? null : dec.getFirstName() + " " + dec.getLastName(),
                t.getDecisionComment(),
                t.getCreatedAt().toString(),
                t.getDecidedAt() == null ? null : t.getDecidedAt().toString()
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
    public List<TravelView> mine() {
        return repo.findByEmployeeIdOrderByCreatedAtDesc(currentEmployee().getId())
                .stream().map(this::toView).toList();
    }

    @GetMapping("/pending")
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public List<TravelView> pending() {
        UserAccount user = AuthPrincipal.current();
        if (user.getRole() == Role.ADMIN) {
            return repo.findByStatusOrderByCreatedAtDesc(TravelStatus.PENDING)
                    .stream().map(this::toView).toList();
        }
        if (user.getEmployee() == null) throw new ResponseStatusException(FORBIDDEN, "Not allowed");
        return repo.findByEmployee_Manager_IdAndStatusOrderByCreatedAtDesc(
                user.getEmployee().getId(), TravelStatus.PENDING)
                .stream().map(this::toView).toList();
    }

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public List<TravelView> all() {
        return repo.findAllByOrderByCreatedAtDesc().stream().map(this::toView).toList();
    }

    @GetMapping("/me/stats")
    @Transactional(readOnly = true)
    public StatsView myStats() {
        Long me = currentEmployee().getId();
        var list = repo.findByEmployeeIdOrderByCreatedAtDesc(me);
        long pending = list.stream().filter(t -> t.getStatus() == TravelStatus.PENDING).count();
        long approved = list.stream().filter(t -> t.getStatus() == TravelStatus.APPROVED).count();
        long booked = list.stream().filter(t -> t.getStatus() == TravelStatus.BOOKED).count();
        long completed = list.stream().filter(t -> t.getStatus() == TravelStatus.COMPLETED).count();
        BigDecimal total = list.stream()
                .filter(t -> t.getStatus() == TravelStatus.APPROVED
                          || t.getStatus() == TravelStatus.BOOKED
                          || t.getStatus() == TravelStatus.COMPLETED)
                .map(t -> t.getEstimatedCost() == null ? BigDecimal.ZERO : t.getEstimatedCost())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new StatsView(pending, approved, booked, completed, total);
    }

    /* ===== Submit ===== */

    @PostMapping
    public TravelView submit(@Valid @RequestBody SubmitRequest req) {
        TravelMode mode;
        try { mode = TravelMode.valueOf(req.mode()); }
        catch (Exception ex) { throw new ResponseStatusException(BAD_REQUEST, "Invalid mode"); }

        if (req.returnDate().isBefore(req.departureDate())) {
            throw new ResponseStatusException(BAD_REQUEST, "Return date must be on or after departure date");
        }

        Long meId = currentEmployee().getId();
        Employee me = employees.findById(meId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));

        TravelRequest t = TravelRequest.builder()
                .employee(me)
                .origin(req.origin()).destination(req.destination())
                .departureDate(req.departureDate()).returnDate(req.returnDate())
                .mode(mode).purpose(req.purpose())
                .estimatedCost(req.estimatedCost() == null ? BigDecimal.ZERO : req.estimatedCost())
                .currency(req.currency() == null || req.currency().isBlank() ? "INR" : req.currency())
                .accommodation(req.accommodation())
                .status(TravelStatus.PENDING)
                .build();
        TravelRequest saved = repo.save(t);

        // Notify manager
        Employee mgr = me.getManager();
        if (mgr != null) {
            notifications.notifyByEmail(
                    mgr.getEmail(),
                    NotificationType.GENERIC,
                    "New travel request",
                    me.getFirstName() + " " + me.getLastName() + " requested travel to " +
                            req.destination() + " (" + req.departureDate() + " to " + req.returnDate() + ").",
                    "/travel"
            );
        }
        return toView(saved);
    }

    /* ===== Approve / Reject / Book / Complete / Cancel ===== */

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public TravelView approve(@PathVariable Long id,
                              @RequestBody(required = false) DecisionRequest req) {
        return decide(id, TravelStatus.APPROVED, req == null ? null : req.comment(), false);
    }

    @PutMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public TravelView reject(@PathVariable Long id,
                             @RequestBody(required = false) DecisionRequest req) {
        return decide(id, TravelStatus.REJECTED, req == null ? null : req.comment(), false);
    }

    @PutMapping("/{id}/mark-booked")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public TravelView markBooked(@PathVariable Long id,
                                 @RequestBody(required = false) DecisionRequest req) {
        return decide(id, TravelStatus.BOOKED, req == null ? null : req.comment(), true);
    }

    @PutMapping("/{id}/mark-completed")
    public TravelView markCompleted(@PathVariable Long id) {
        // Either the employee themselves or admin can mark completed
        UserAccount user = AuthPrincipal.current();
        TravelRequest t = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Travel request not found"));
        boolean isOwner = user.getEmployee() != null && user.getEmployee().getId().equals(t.getEmployee().getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        if (!isOwner && !isAdmin)
            throw new ResponseStatusException(FORBIDDEN, "Only the requester or admin can mark complete");
        if (t.getStatus() != TravelStatus.APPROVED && t.getStatus() != TravelStatus.BOOKED) {
            throw new ResponseStatusException(CONFLICT, "Travel must be APPROVED or BOOKED to complete");
        }
        t.setStatus(TravelStatus.COMPLETED);
        if (t.getDecidedAt() == null) t.setDecidedAt(Instant.now());
        return toView(t);
    }

    @PutMapping("/{id}/cancel")
    public TravelView cancel(@PathVariable Long id) {
        UserAccount user = AuthPrincipal.current();
        TravelRequest t = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Travel request not found"));
        boolean isOwner = user.getEmployee() != null && user.getEmployee().getId().equals(t.getEmployee().getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        if (!isOwner && !isAdmin)
            throw new ResponseStatusException(FORBIDDEN, "Only the requester or admin can cancel");
        if (t.getStatus() == TravelStatus.COMPLETED) {
            throw new ResponseStatusException(CONFLICT, "Cannot cancel a completed trip");
        }
        t.setStatus(TravelStatus.CANCELLED);
        t.setDecidedAt(Instant.now());
        return toView(t);
    }

    private TravelView decide(Long id, TravelStatus newStatus, String comment, boolean allowFromApproved) {
        UserAccount user = AuthPrincipal.current();
        TravelRequest t = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Travel request not found"));

        // Allowed transitions:
        //  APPROVED / REJECTED — only from PENDING
        //  BOOKED — only from APPROVED
        TravelStatus current = t.getStatus();
        if (newStatus == TravelStatus.BOOKED) {
            if (current != TravelStatus.APPROVED)
                throw new ResponseStatusException(CONFLICT, "Travel must be APPROVED before booking");
        } else if (current != TravelStatus.PENDING) {
            throw new ResponseStatusException(CONFLICT, "Travel is not pending");
        }

        boolean isAdmin = user.getRole() == Role.ADMIN;
        boolean isOwningManager = user.getRole() == Role.MANAGER
                && user.getEmployee() != null
                && t.getEmployee().getManager() != null
                && user.getEmployee().getId().equals(t.getEmployee().getManager().getId());
        if (!isAdmin && !isOwningManager) {
            throw new ResponseStatusException(FORBIDDEN, "Not allowed to decide on this travel request");
        }

        t.setStatus(newStatus);
        t.setDecidedBy(user.getEmployee());
        t.setDecisionComment(comment);
        t.setDecidedAt(Instant.now());

        // Notify the requester
        String decider = user.getEmployee() == null ? "HR"
                : user.getEmployee().getFirstName() + " " + user.getEmployee().getLastName();
        String title = switch (newStatus) {
            case APPROVED -> "Travel approved";
            case REJECTED -> "Travel rejected";
            case BOOKED   -> "Travel booked";
            default       -> "Travel update";
        };
        String body = "Your travel to " + t.getDestination() + " was " + newStatus.name().toLowerCase() +
                " by " + decider + (comment == null || comment.isBlank() ? "." : ": " + comment);
        notifications.notifyByEmail(
                t.getEmployee().getEmail(),
                NotificationType.GENERIC,
                title, body, "/travel"
        );
        return toView(t);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        UserAccount user = AuthPrincipal.current();
        TravelRequest t = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Travel request not found"));
        boolean isOwner = user.getEmployee() != null && user.getEmployee().getId().equals(t.getEmployee().getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        if (!isOwner && !isAdmin) throw new ResponseStatusException(FORBIDDEN, "Not allowed");
        if (t.getStatus() != TravelStatus.PENDING && !isAdmin) {
            throw new ResponseStatusException(CONFLICT, "Only pending requests can be deleted");
        }
        repo.delete(t);
        return ResponseEntity.noContent().build();
    }
}
