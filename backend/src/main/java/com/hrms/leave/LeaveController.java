package com.hrms.leave;

import com.hrms.domain.*;
import com.hrms.notification.NotificationService;
import com.hrms.repo.*;
import com.hrms.security.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/leaves")
@Transactional
public class LeaveController {

    private final LeaveRequestRepository leaves;
    private final EmployeeRepository employees;
    private final UserAccountRepository users;
    private final NotificationService notifService;

    private static final Map<LeaveType, Integer> ALLOCATIONS = Map.of(
        LeaveType.SICK, 10, LeaveType.CASUAL, 12, LeaveType.PAID, 15
    );

    public LeaveController(LeaveRequestRepository leaves, EmployeeRepository employees,
                            UserAccountRepository users, NotificationService notifService) {
        this.leaves = leaves;
        this.employees = employees;
        this.users = users;
        this.notifService = notifService;
    }

    public record LeaveView(Long id, Long employeeId, String employeeCode, String employeeName,
                             String type, String startDate, String endDate,
                             String reason, String status,
                             String decidedByName, String decisionComment,
                             String createdAt, String decidedAt) {}

    public record ApplyRequest(@NotNull LeaveType type,
                                @NotBlank String startDate, @NotBlank String endDate,
                                String reason) {}

    public record DecideRequest(String comment) {}

    public record BalanceView(int year, String type, int allocated, int used, int remaining) {}

    private LeaveView toView(LeaveRequest r) {
        String decidedByName = r.getDecidedBy() != null
            ? r.getDecidedBy().getFirstName() + " " + r.getDecidedBy().getLastName() : null;
        return new LeaveView(
            r.getId(),
            r.getEmployee().getId(), r.getEmployee().getEmployeeCode(),
            r.getEmployee().getFirstName() + " " + r.getEmployee().getLastName(),
            r.getType().name(), r.getStartDate().toString(), r.getEndDate().toString(),
            r.getReason(), r.getStatus().name(),
            decidedByName, r.getDecisionComment(),
            r.getCreatedAt().toString(),
            r.getDecidedAt() != null ? r.getDecidedAt().toString() : null
        );
    }

    @PostMapping
    public ResponseEntity<LeaveView> apply(@Valid @RequestBody ApplyRequest req) {
        UserAccount user = AuthPrincipal.current();
        if (user.getEmployee() == null)
            throw new ResponseStatusException(BAD_REQUEST, "No employee linked");
        Employee emp = employees.findById(user.getEmployee().getId())
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));

        LeaveRequest lr = LeaveRequest.builder()
            .employee(emp)
            .type(req.type())
            .startDate(LocalDate.parse(req.startDate()))
            .endDate(LocalDate.parse(req.endDate()))
            .reason(req.reason())
            .status(LeaveStatus.PENDING)
            .build();
        lr = leaves.save(lr);

        // Notify admin/manager
        notifyManagers(emp, lr);

        return ResponseEntity.status(CREATED).body(toView(lr));
    }

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public List<LeaveView> myLeaves() {
        UserAccount user = AuthPrincipal.current();
        if (user.getEmployee() == null) return List.of();
        return leaves.findByEmployeeIdOrderByCreatedAtDesc(user.getEmployee().getId())
                     .stream().map(this::toView).toList();
    }

    @GetMapping("/balance")
    @Transactional(readOnly = true)
    public List<BalanceView> balance(@RequestParam(required = false) Integer year) {
        UserAccount user = AuthPrincipal.current();
        if (user.getEmployee() == null) return List.of();
        int y = (year != null) ? year : LocalDate.now().getYear();
        Long empId = user.getEmployee().getId();

        return leaves.findByEmployeeIdOrderByCreatedAtDesc(empId).stream()
            .filter(lr -> lr.getStartDate().getYear() == y && lr.getStatus() == LeaveStatus.APPROVED)
            .collect(java.util.stream.Collectors.groupingBy(LeaveRequest::getType,
                     java.util.stream.Collectors.summingInt(lr -> {
                         long days = lr.getStartDate().datesUntil(lr.getEndDate().plusDays(1)).count();
                         return (int) days;
                     })))
            .entrySet().stream()
            .map(e -> {
                int alloc = ALLOCATIONS.getOrDefault(e.getKey(), 0);
                int used = e.getValue();
                return new BalanceView(y, e.getKey().name(), alloc, used, alloc - used);
            })
            .collect(java.util.stream.Collectors.collectingAndThen(
                java.util.stream.Collectors.toList(),
                list -> {
                    // add types not yet used
                    for (LeaveType lt : LeaveType.values()) {
                        if (list.stream().noneMatch(b -> b.type().equals(lt.name()))) {
                            int alloc = ALLOCATIONS.getOrDefault(lt, 0);
                            list.add(new BalanceView(y, lt.name(), alloc, 0, alloc));
                        }
                    }
                    return list;
                }
            ));
    }

    @GetMapping("/pending")
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public List<LeaveView> pending() {
        UserAccount user = AuthPrincipal.current();
        if (user.getRole() == Role.ADMIN) {
            return leaves.findByStatusOrderByCreatedAtDesc(LeaveStatus.PENDING)
                         .stream().map(this::toView).toList();
        }
        if (user.getEmployee() == null) return List.of();
        return leaves.findByEmployee_Manager_IdAndStatusOrderByCreatedAtDesc(
                     user.getEmployee().getId(), LeaveStatus.PENDING)
                     .stream().map(this::toView).toList();
    }

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public List<LeaveView> all() {
        return leaves.findAllByOrderByCreatedAtDesc().stream().map(this::toView).toList();
    }

    @PutMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public LeaveView approve(@PathVariable Long id, @RequestBody DecideRequest req) {
        return decide(id, LeaveStatus.APPROVED, req.comment());
    }

    @PutMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public LeaveView reject(@PathVariable Long id, @RequestBody DecideRequest req) {
        return decide(id, LeaveStatus.REJECTED, req.comment());
    }

    private LeaveView decide(Long id, LeaveStatus newStatus, String comment) {
        LeaveRequest lr = leaves.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Leave request not found"));
        if (lr.getStatus() != LeaveStatus.PENDING)
            throw new ResponseStatusException(BAD_REQUEST, "Leave is already decided");

        UserAccount decider = AuthPrincipal.current();
        Employee decidedBy = decider.getEmployee() != null
            ? employees.findById(decider.getEmployee().getId()).orElse(null) : null;

        lr.setStatus(newStatus);
        lr.setDecidedBy(decidedBy);
        lr.setDecisionComment(comment);
        lr.setDecidedAt(java.time.Instant.now());
        lr = leaves.save(lr);

        // Notify employee
        notifyEmployee(lr, newStatus);

        return toView(lr);
    }

    private void notifyManagers(Employee emp, LeaveRequest lr) {
        NotificationType type = NotificationType.LEAVE_APPLIED;
        String title = "Leave Request";
        String msg = emp.getFirstName() + " " + emp.getLastName() + " applied for " + lr.getType().name() + " leave";
        String link = "/leaves/approvals";
        users.findAll().stream()
            .filter(u -> (u.getRole() == Role.ADMIN || u.getRole() == Role.MANAGER) && u.isEnabled())
            .forEach(u -> notifService.push(u, type, title, msg, link));
    }

    private void notifyEmployee(LeaveRequest lr, LeaveStatus status) {
        users.findAll().stream()
            .filter(u -> u.getEmployee() != null && u.getEmployee().getId().equals(lr.getEmployee().getId()))
            .findFirst()
            .ifPresent(u -> {
                NotificationType type = status == LeaveStatus.APPROVED ? NotificationType.LEAVE_APPROVED : NotificationType.LEAVE_REJECTED;
                String title = "Leave " + (status == LeaveStatus.APPROVED ? "Approved" : "Rejected");
                String msg = "Your " + lr.getType().name() + " leave request has been " + status.name().toLowerCase();
                notifService.push(u, type, title, msg, "/leaves/me");
            });
    }
}
