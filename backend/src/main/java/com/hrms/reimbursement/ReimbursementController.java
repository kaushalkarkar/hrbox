package com.hrms.reimbursement;

import com.hrms.domain.*;
import com.hrms.notification.NotificationService;
import com.hrms.repo.EmployeeRepository;
import com.hrms.repo.ExpenseRepository;
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
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/reimbursements")
@Transactional
public class ReimbursementController {

    private final ExpenseRepository repo;
    private final EmployeeRepository employees;
    private final NotificationService notifications;

    public ReimbursementController(ExpenseRepository repo,
                                   EmployeeRepository employees,
                                   NotificationService notifications) {
        this.repo = repo;
        this.employees = employees;
        this.notifications = notifications;
    }

    public record ExpenseView(
            Long id, Long employeeId, String employeeCode, String employeeName,
            String category, BigDecimal amount, String currency,
            String expenseDate, String description,
            String status, String decidedByName, String decisionComment,
            String createdAt, String decidedAt
    ) {}

    public record SubmitRequest(
            @NotNull String category,
            @NotNull @DecimalMin(value = "0.01") BigDecimal amount,
            @NotBlank @Size(max = 8) String currency,
            @NotNull LocalDate expenseDate,
            @Size(max = 500) String description
    ) {}

    public record DecisionRequest(@Size(max = 500) String comment) {}

    public record StatsView(long pendingCount, long approvedCount, long rejectedCount,
                            BigDecimal approvedThisMonth, String currency) {}

    private ExpenseView toView(Expense e) {
        Employee emp = e.getEmployee();
        Employee dec = e.getDecidedBy();
        return new ExpenseView(
                e.getId(), emp.getId(), emp.getEmployeeCode(),
                emp.getFirstName() + " " + emp.getLastName(),
                e.getCategory().name(), e.getAmount(), e.getCurrency(),
                e.getExpenseDate().toString(),
                e.getDescription(),
                e.getStatus().name(),
                dec == null ? null : dec.getFirstName() + " " + dec.getLastName(),
                e.getDecisionComment(),
                e.getCreatedAt().toString(),
                e.getDecidedAt() == null ? null : e.getDecidedAt().toString()
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
    public List<ExpenseView> mine() {
        return repo.findByEmployeeIdOrderByCreatedAtDesc(currentEmployee().getId())
                .stream().map(this::toView).toList();
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public List<ExpenseView> pending() {
        UserAccount user = AuthPrincipal.current();
        if (user.getRole() == Role.ADMIN) {
            return repo.findByStatusOrderByCreatedAtDesc(ExpenseStatus.PENDING).stream().map(this::toView).toList();
        }
        if (user.getEmployee() == null) throw new ResponseStatusException(FORBIDDEN, "Not allowed");
        return repo.findByEmployee_Manager_IdAndStatusOrderByCreatedAtDesc(
                user.getEmployee().getId(), ExpenseStatus.PENDING)
                .stream().map(this::toView).toList();
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<ExpenseView> all() {
        return repo.findAllByOrderByCreatedAtDesc().stream().map(this::toView).toList();
    }

    @GetMapping("/me/stats")
    public StatsView myStats() {
        Long me = currentEmployee().getId();
        var all = repo.findByEmployeeIdOrderByCreatedAtDesc(me);
        long pending = all.stream().filter(e -> e.getStatus() == ExpenseStatus.PENDING).count();
        long approved = all.stream().filter(e -> e.getStatus() == ExpenseStatus.APPROVED).count();
        long rejected = all.stream().filter(e -> e.getStatus() == ExpenseStatus.REJECTED).count();
        Instant monthStart = LocalDate.now().withDayOfMonth(1)
                .atStartOfDay(ZoneId.systemDefault()).toInstant();
        BigDecimal approvedSum = repo.sumApprovedSince(me, monthStart);
        if (approvedSum == null) approvedSum = BigDecimal.ZERO;
        return new StatsView(pending, approved, rejected, approvedSum, "INR");
    }

    /* ===== Submit ===== */

    @PostMapping
    public ExpenseView submit(@Valid @RequestBody SubmitRequest req) {
        ExpenseCategory cat;
        try { cat = ExpenseCategory.valueOf(req.category()); }
        catch (Exception ex) { throw new ResponseStatusException(BAD_REQUEST, "Invalid category"); }

        // Reload via repository so manager proxy is attached to current session
        Long meId = currentEmployee().getId();
        Employee me = employees.findById(meId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));

        if (req.expenseDate().isAfter(LocalDate.now().plus(1, ChronoUnit.DAYS))) {
            throw new ResponseStatusException(BAD_REQUEST, "Expense date cannot be in the future");
        }

        Expense e = Expense.builder()
                .employee(me)
                .category(cat)
                .amount(req.amount())
                .currency(req.currency())
                .expenseDate(req.expenseDate())
                .description(req.description())
                .status(ExpenseStatus.PENDING)
                .build();
        Expense saved = repo.save(e);

        // Notify manager
        Employee mgr = me.getManager();
        if (mgr != null) {
            notifications.notifyByEmail(
                    mgr.getEmail(),
                    NotificationType.GENERIC,
                    "New reimbursement request",
                    me.getFirstName() + " " + me.getLastName() + " requested " +
                            req.currency() + " " + req.amount() + " (" + cat + ").",
                    "/reimbursement"
            );
        }
        return toView(saved);
    }

    /* ===== Approve / Reject ===== */

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ExpenseView approve(@PathVariable Long id,
                                @RequestBody(required = false) DecisionRequest req) {
        return decide(id, ExpenseStatus.APPROVED, req == null ? null : req.comment());
    }

    @PutMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ExpenseView reject(@PathVariable Long id,
                              @RequestBody(required = false) DecisionRequest req) {
        return decide(id, ExpenseStatus.REJECTED, req == null ? null : req.comment());
    }

    private ExpenseView decide(Long id, ExpenseStatus newStatus, String comment) {
        UserAccount user = AuthPrincipal.current();
        Expense e = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Expense not found"));
        if (e.getStatus() != ExpenseStatus.PENDING) {
            throw new ResponseStatusException(CONFLICT, "Expense is not pending");
        }

        boolean isAdmin = user.getRole() == Role.ADMIN;
        boolean isOwningManager = user.getRole() == Role.MANAGER
                && user.getEmployee() != null
                && e.getEmployee().getManager() != null
                && user.getEmployee().getId().equals(e.getEmployee().getManager().getId());
        if (!isAdmin && !isOwningManager) {
            throw new ResponseStatusException(FORBIDDEN, "Not allowed to decide on this expense");
        }

        e.setStatus(newStatus);
        e.setDecidedBy(user.getEmployee());
        e.setDecisionComment(comment);
        e.setDecidedAt(Instant.now());

        // Notify the applicant
        String decider = user.getEmployee() == null ? "HR"
                : user.getEmployee().getFirstName() + " " + user.getEmployee().getLastName();
        String body = "Your reimbursement request for " + e.getCurrency() + " " + e.getAmount()
                + " was " + newStatus.name().toLowerCase() + " by " + decider
                + (comment == null || comment.isBlank() ? "." : ": " + comment);
        notifications.notifyByEmail(
                e.getEmployee().getEmail(),
                newStatus == ExpenseStatus.APPROVED ? NotificationType.GENERIC : NotificationType.GENERIC,
                newStatus == ExpenseStatus.APPROVED ? "Reimbursement approved" : "Reimbursement rejected",
                body,
                "/reimbursement"
        );
        return toView(e);
    }

    /* ===== Delete (only by owner while still pending) ===== */

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        UserAccount user = AuthPrincipal.current();
        Expense e = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Expense not found"));
        boolean isOwner = user.getEmployee() != null && user.getEmployee().getId().equals(e.getEmployee().getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        if (!isOwner && !isAdmin) throw new ResponseStatusException(FORBIDDEN, "Not allowed");
        if (e.getStatus() != ExpenseStatus.PENDING && !isAdmin) {
            throw new ResponseStatusException(CONFLICT, "Only pending expenses can be deleted");
        }
        repo.delete(e);
        return ResponseEntity.noContent().build();
    }
}
