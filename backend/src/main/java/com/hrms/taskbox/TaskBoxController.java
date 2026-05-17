package com.hrms.taskbox;

import com.hrms.domain.*;
import com.hrms.repo.*;
import com.hrms.security.AuthPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Unified inbox of pending actions for the current user.
 * Aggregates approvals waiting on them, items assigned to them and
 * their own in-flight items.
 */
@RestController
@RequestMapping("/api/taskbox")
@Transactional(readOnly = true)
public class TaskBoxController {

    private final LeaveRequestRepository leaves;
    private final ExpenseRepository expenses;
    private final TravelRequestRepository travel;
    private final TicketRepository tickets;
    private final PolicyRepository policies;
    private final PolicyAckRepository acks;

    public TaskBoxController(LeaveRequestRepository leaves,
                             ExpenseRepository expenses,
                             TravelRequestRepository travel,
                             TicketRepository tickets,
                             PolicyRepository policies,
                             PolicyAckRepository acks) {
        this.leaves = leaves;
        this.expenses = expenses;
        this.travel = travel;
        this.tickets = tickets;
        this.policies = policies;
        this.acks = acks;
    }

    public record TaskItem(
            String type,        // e.g. LEAVE_APPROVAL, EXPENSE_APPROVAL, TRAVEL_APPROVAL,
                                //      TICKET_ASSIGNED, MY_LEAVE, MY_EXPENSE, MY_TRAVEL, POLICY_ACK
            Long id,
            String title,
            String subtitle,
            String status,
            String createdAt,
            String link,
            String pillColor) {}

    public record TaskBoxView(
            int total,
            List<TaskItem> approvals,
            List<TaskItem> assignedToMe,
            List<TaskItem> policyAcks,
            List<TaskItem> myPending) {}

    @GetMapping
    public TaskBoxView taskBox() {
        UserAccount user = AuthPrincipal.current();
        Long meId  = user.getEmployee() == null ? null : user.getEmployee().getId();
        Role role  = user.getRole();
        boolean isAdmin   = role == Role.ADMIN;
        boolean isManager = role == Role.MANAGER;

        /* ===== Approvals waiting on me ===== */
        List<TaskItem> approvals = new java.util.ArrayList<>();
        if (isAdmin || isManager) {
            // Leave
            List<LeaveRequest> pendingLeaves = isAdmin
                    ? leaves.findByStatusOrderByCreatedAtDesc(LeaveStatus.PENDING)
                    : (meId == null ? List.of()
                        : leaves.findByEmployee_Manager_IdAndStatusOrderByCreatedAtDesc(meId, LeaveStatus.PENDING));
            for (LeaveRequest l : pendingLeaves) {
                approvals.add(new TaskItem("LEAVE_APPROVAL", l.getId(),
                        l.getEmployee().getFirstName() + " " + l.getEmployee().getLastName()
                                + " — " + l.getType() + " leave",
                        l.getStartDate() + " to " + l.getEndDate()
                                + (l.getReason() == null ? "" : " · " + l.getReason()),
                        l.getStatus().name(),
                        l.getCreatedAt().toString(),
                        "/leaves/approvals",
                        "amber"));
            }

            // Reimbursement
            List<Expense> pendingExpenses = isAdmin
                    ? expenses.findByStatusOrderByCreatedAtDesc(ExpenseStatus.PENDING)
                    : (meId == null ? List.of()
                        : expenses.findByEmployee_Manager_IdAndStatusOrderByCreatedAtDesc(meId, ExpenseStatus.PENDING));
            for (Expense e : pendingExpenses) {
                approvals.add(new TaskItem("EXPENSE_APPROVAL", e.getId(),
                        e.getEmployee().getFirstName() + " " + e.getEmployee().getLastName()
                                + " — " + e.getCategory() + " " + e.getCurrency() + " " + e.getAmount(),
                        e.getDescription() == null ? "" : e.getDescription(),
                        e.getStatus().name(),
                        e.getCreatedAt().toString(),
                        "/reimbursement",
                        "amber"));
            }

            // Travel
            List<TravelRequest> pendingTravel = isAdmin
                    ? travel.findByStatusOrderByCreatedAtDesc(TravelStatus.PENDING)
                    : (meId == null ? List.of()
                        : travel.findByEmployee_Manager_IdAndStatusOrderByCreatedAtDesc(meId, TravelStatus.PENDING));
            for (TravelRequest t : pendingTravel) {
                approvals.add(new TaskItem("TRAVEL_APPROVAL", t.getId(),
                        t.getEmployee().getFirstName() + " " + t.getEmployee().getLastName()
                                + " — " + t.getOrigin() + " → " + t.getDestination(),
                        t.getDepartureDate() + " to " + t.getReturnDate() + " · " + t.getMode(),
                        t.getStatus().name(),
                        t.getCreatedAt().toString(),
                        "/travel",
                        "amber"));
            }
        }

        /* ===== Tickets assigned to me (not closed/resolved) ===== */
        List<TaskItem> assigned = new java.util.ArrayList<>();
        if (meId != null) {
            tickets.findByAssigneeIdOrderByCreatedAtDesc(meId).stream()
                    .filter(t -> t.getStatus() == TicketStatus.OPEN || t.getStatus() == TicketStatus.IN_PROGRESS)
                    .forEach(t -> assigned.add(new TaskItem(
                            "TICKET_ASSIGNED", t.getId(),
                            "#" + t.getId() + " · " + t.getSubject(),
                            t.getCategory() + " · " + t.getPriority() + " · raised by "
                                    + t.getRaisedBy().getFirstName() + " " + t.getRaisedBy().getLastName(),
                            t.getStatus().name(),
                            t.getCreatedAt().toString(),
                            "/helpdesk",
                            t.getPriority() == TicketPriority.URGENT ? "red"
                            : t.getPriority() == TicketPriority.HIGH ? "amber" : "blue")));
        }

        /* ===== Policies to acknowledge ===== */
        List<TaskItem> policyAcks = new java.util.ArrayList<>();
        if (meId != null) {
            Set<Long> acked = acks.findByEmployeeId(meId).stream()
                    .map(a -> a.getPolicy().getId()).collect(Collectors.toSet());
            policies.findAllByOrderByCategoryAscTitleAsc().stream()
                    .filter(p -> !acked.contains(p.getId()))
                    .forEach(p -> policyAcks.add(new TaskItem(
                            "POLICY_ACK", p.getId(),
                            p.getTitle(),
                            (p.getSummary() == null ? "" : p.getSummary()) + " · v" + p.getVersion(),
                            "UNACKNOWLEDGED",
                            p.getCreatedAt().toString(),
                            "/policies",
                            "violet")));
        }

        /* ===== My own in-flight ===== */
        List<TaskItem> mine = new java.util.ArrayList<>();
        if (meId != null) {
            leaves.findByEmployeeIdOrderByCreatedAtDesc(meId).stream()
                    .filter(l -> l.getStatus() == LeaveStatus.PENDING)
                    .forEach(l -> mine.add(new TaskItem(
                            "MY_LEAVE", l.getId(),
                            l.getType() + " leave · " + l.getStartDate() + " to " + l.getEndDate(),
                            "Awaiting approval", l.getStatus().name(),
                            l.getCreatedAt().toString(),
                            "/leaves/me", "gray")));

            expenses.findByEmployeeIdOrderByCreatedAtDesc(meId).stream()
                    .filter(e -> e.getStatus() == ExpenseStatus.PENDING)
                    .forEach(e -> mine.add(new TaskItem(
                            "MY_EXPENSE", e.getId(),
                            e.getCategory() + " · " + e.getCurrency() + " " + e.getAmount(),
                            "Awaiting approval", e.getStatus().name(),
                            e.getCreatedAt().toString(),
                            "/reimbursement", "gray")));

            travel.findByEmployeeIdOrderByCreatedAtDesc(meId).stream()
                    .filter(t -> t.getStatus() == TravelStatus.PENDING || t.getStatus() == TravelStatus.APPROVED)
                    .forEach(t -> mine.add(new TaskItem(
                            "MY_TRAVEL", t.getId(),
                            t.getOrigin() + " → " + t.getDestination(),
                            t.getStatus() == TravelStatus.APPROVED ? "Awaiting booking" : "Awaiting approval",
                            t.getStatus().name(),
                            t.getCreatedAt().toString(),
                            "/travel", "gray")));
        }

        int total = approvals.size() + assigned.size() + policyAcks.size() + mine.size();
        return new TaskBoxView(total, approvals, assigned, policyAcks, mine);
    }
}
