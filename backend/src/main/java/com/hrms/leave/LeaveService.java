package com.hrms.leave;

import com.hrms.domain.*;
import com.hrms.notification.NotificationService;
import com.hrms.repo.LeaveRequestRepository;
import com.hrms.security.AuthPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static org.springframework.http.HttpStatus.*;

@Service
@Transactional
public class LeaveService {

    private final LeaveRequestRepository leaves;
    private final LeaveBalanceService balances;
    private final NotificationService notifications;

    public LeaveService(LeaveRequestRepository leaves,
                        LeaveBalanceService balances,
                        NotificationService notifications) {
        this.leaves = leaves;
        this.balances = balances;
        this.notifications = notifications;
    }

    public LeaveDto.LeaveView apply(LeaveDto.ApplyRequest req) {
        UserAccount user = AuthPrincipal.current();
        Employee me = user.getEmployee();
        if (me == null) throw new ResponseStatusException(BAD_REQUEST, "Your account is not linked to an employee");
        if (req.endDate().isBefore(req.startDate())) {
            throw new ResponseStatusException(BAD_REQUEST, "End date must be on or after start date");
        }

        int requestedDays = LeaveBalanceService.daysInclusive(req.startDate(), req.endDate());
        int remaining = balances.remaining(me, req.type(), req.startDate().getYear());
        if (requestedDays > remaining) {
            throw new ResponseStatusException(BAD_REQUEST,
                    "Not enough " + req.type() + " leave: requested " + requestedDays + " day(s), remaining " + remaining);
        }

        LeaveRequest lr = LeaveRequest.builder()
                .employee(me)
                .type(req.type())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .reason(req.reason())
                .status(LeaveStatus.PENDING)
                .build();
        LeaveRequest saved = leaves.save(lr);

        // Notify the manager (or HR if no manager) about the new request
        String dateRange = req.startDate().equals(req.endDate())
                ? req.startDate().toString()
                : req.startDate() + " to " + req.endDate();
        if (me.getManager() != null) {
            notifications.notifyByEmail(
                    me.getManager().getEmail(),
                    NotificationType.LEAVE_APPLIED,
                    "New leave request",
                    me.getFirstName() + " " + me.getLastName() + " applied for " + req.type() + " leave (" + dateRange + ").",
                    "/leaves/approvals"
            );
        }
        return toView(saved);
    }

    @Transactional(readOnly = true)
    public List<LeaveDto.LeaveView> myLeaves() {
        UserAccount user = AuthPrincipal.current();
        Employee me = user.getEmployee();
        if (me == null) return List.of();
        return leaves.findByEmployeeIdOrderByCreatedAtDesc(me.getId()).stream().map(this::toView).toList();
    }

    @Transactional(readOnly = true)
    public List<LeaveDto.LeaveView> pendingForApprover() {
        UserAccount user = AuthPrincipal.current();
        if (user.getRole() == Role.ADMIN) {
            return leaves.findByStatusOrderByCreatedAtDesc(LeaveStatus.PENDING).stream().map(this::toView).toList();
        }
        if (user.getRole() == Role.MANAGER && user.getEmployee() != null) {
            return leaves.findByEmployee_Manager_IdAndStatusOrderByCreatedAtDesc(
                    user.getEmployee().getId(), LeaveStatus.PENDING).stream().map(this::toView).toList();
        }
        throw new ResponseStatusException(FORBIDDEN, "Not allowed");
    }

    @Transactional(readOnly = true)
    public List<LeaveDto.LeaveView> all() {
        // ADMIN-only ??? guarded at controller
        return leaves.findAllByOrderByCreatedAtDesc().stream().map(this::toView).toList();
    }

    public LeaveDto.LeaveView approve(Long id, LeaveDto.DecisionRequest req) {
        return decide(id, LeaveStatus.APPROVED, req.comment());
    }

    public LeaveDto.LeaveView reject(Long id, LeaveDto.DecisionRequest req) {
        return decide(id, LeaveStatus.REJECTED, req.comment());
    }

    private LeaveDto.LeaveView decide(Long id, LeaveStatus newStatus, String comment) {
        UserAccount user = AuthPrincipal.current();
        LeaveRequest lr = leaves.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Leave not found"));

        if (lr.getStatus() != LeaveStatus.PENDING) {
            throw new ResponseStatusException(CONFLICT, "Leave is not pending");
        }

        boolean isAdmin = user.getRole() == Role.ADMIN;
        boolean isOwningManager = user.getRole() == Role.MANAGER
                && user.getEmployee() != null
                && lr.getEmployee().getManager() != null
                && user.getEmployee().getId().equals(lr.getEmployee().getManager().getId());

        if (!isAdmin && !isOwningManager) {
            throw new ResponseStatusException(FORBIDDEN, "Not allowed to decide on this leave");
        }

        lr.setStatus(newStatus);
        lr.setDecidedBy(user.getEmployee());
        lr.setDecisionComment(comment);
        lr.setDecidedAt(Instant.now());

        if (newStatus == LeaveStatus.APPROVED) {
            balances.recordApproval(lr.getEmployee(), lr.getType(), lr.getStartDate(), lr.getEndDate());
        }

        // Notify the leave-applicant about the decision
        Employee deciderEmp = user.getEmployee();
        String deciderName = deciderEmp == null ? "HR" : deciderEmp.getFirstName() + " " + deciderEmp.getLastName();
        String dateRange = lr.getStartDate().equals(lr.getEndDate())
                ? lr.getStartDate().toString()
                : lr.getStartDate() + " to " + lr.getEndDate();
        if (newStatus == LeaveStatus.APPROVED) {
            notifications.notifyByEmail(
                    lr.getEmployee().getEmail(),
                    NotificationType.LEAVE_APPROVED,
                    "Leave Approved",
                    "Your " + lr.getType() + " leave (" + dateRange + ") has been approved by " + deciderName + ".",
                    "/leaves/me"
            );
        } else if (newStatus == LeaveStatus.REJECTED) {
            notifications.notifyByEmail(
                    lr.getEmployee().getEmail(),
                    NotificationType.LEAVE_REJECTED,
                    "Leave Rejected",
                    "Your " + lr.getType() + " leave (" + dateRange + ") was rejected by " + deciderName +
                            (comment != null && !comment.isBlank() ? ": " + comment : "."),
                    "/leaves/me"
            );
        }
        return toView(lr);
    }

    LeaveDto.LeaveView toView(LeaveRequest lr) {
        Employee emp = lr.getEmployee();
        Employee dec = lr.getDecidedBy();
        return new LeaveDto.LeaveView(
                lr.getId(),
                emp.getId(),
                emp.getEmployeeCode(),
                emp.getFirstName() + " " + emp.getLastName(),
                lr.getType(),
                lr.getStartDate(),
                lr.getEndDate(),
                lr.getReason(),
                lr.getStatus(),
                dec == null ? null : (dec.getFirstName() + " " + dec.getLastName()),
                lr.getDecisionComment(),
                lr.getCreatedAt(),
                lr.getDecidedAt()
        );
    }
}
