package com.hrms.performance;

import com.hrms.domain.*;
import com.hrms.repo.EmployeeRepository;
import com.hrms.repo.GoalRepository;
import com.hrms.repo.PerformanceReviewRepository;
import com.hrms.security.AuthPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.springframework.http.HttpStatus.*;

@Service
@Transactional
public class PerformanceService {

    private final GoalRepository goals;
    private final PerformanceReviewRepository reviews;
    private final EmployeeRepository employees;

    public PerformanceService(GoalRepository goals,
                              PerformanceReviewRepository reviews,
                              EmployeeRepository employees) {
        this.goals = goals;
        this.reviews = reviews;
        this.employees = employees;
    }

    /* ===== Goals ===== */

    @Transactional(readOnly = true)
    public List<PerformanceDto.GoalView> goalsForEmployee(Long employeeId) {
        ensureEmployeeExists(employeeId);
        return goals.findByEmployeeIdOrderByCreatedAtDesc(employeeId).stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public List<PerformanceDto.GoalView> goalsForTeam(Long managerEmployeeId) {
        return goals.findByEmployee_Manager_IdOrderByCreatedAtDesc(managerEmployeeId).stream().map(this::view).toList();
    }

    public PerformanceDto.GoalView createGoal(Long employeeId, PerformanceDto.GoalCreateRequest req) {
        UserAccount user = AuthPrincipal.current();
        ensureCanModifyGoals(user, employeeId);
        Employee e = ensureEmployeeExists(employeeId);

        Goal g = Goal.builder()
                .employee(e)
                .title(req.title())
                .description(req.description())
                .targetDate(req.targetDate())
                .weight(req.weight() == null ? 10 : req.weight())
                .progress(0)
                .status(GoalStatus.DRAFT)
                .build();
        return view(goals.save(g));
    }

    public PerformanceDto.GoalView updateGoal(Long goalId, PerformanceDto.GoalUpdateRequest req) {
        UserAccount user = AuthPrincipal.current();
        Goal g = goals.findById(goalId).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Goal not found"));
        ensureCanModifyGoals(user, g.getEmployee().getId());

        g.setTitle(req.title());
        g.setDescription(req.description());
        g.setTargetDate(req.targetDate());
        if (req.weight()   != null) g.setWeight(req.weight());
        if (req.progress() != null) g.setProgress(Math.max(0, Math.min(100, req.progress())));
        if (req.status()   != null) g.setStatus(req.status());
        return view(g);
    }

    public void deleteGoal(Long goalId) {
        UserAccount user = AuthPrincipal.current();
        Goal g = goals.findById(goalId).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Goal not found"));
        ensureCanModifyGoals(user, g.getEmployee().getId());
        goals.delete(g);
    }

    /* ===== Reviews ===== */

    @Transactional(readOnly = true)
    public List<PerformanceDto.ReviewView> reviewsForEmployee(Long employeeId) {
        ensureEmployeeExists(employeeId);
        return reviews.findByEmployeeIdOrderByCreatedAtDesc(employeeId).stream().map(this::view).toList();
    }

    @Transactional(readOnly = true)
    public List<PerformanceDto.ReviewView> reviewsForTeam(Long managerEmployeeId) {
        return reviews.findByEmployee_Manager_IdOrderByCreatedAtDesc(managerEmployeeId).stream().map(this::view).toList();
    }

    public PerformanceDto.ReviewView upsertReview(Long employeeId, PerformanceDto.ReviewRequest req) {
        UserAccount user = AuthPrincipal.current();
        ensureCanReview(user, employeeId);
        Employee e = ensureEmployeeExists(employeeId);

        var existing = reviews.findByEmployeeIdAndPeriod(employeeId, req.period());
        PerformanceReview r;
        if (existing.isPresent()) {
            r = existing.get();
            r.setRating(req.rating());
            r.setComments(req.comments());
            r.setReviewer(user.getEmployee());
        } else {
            r = PerformanceReview.builder()
                    .employee(e)
                    .period(req.period())
                    .rating(req.rating())
                    .comments(req.comments())
                    .reviewer(user.getEmployee())
                    .build();
            r = reviews.save(r);
        }
        return view(r);
    }

    public void deleteReview(Long reviewId) {
        UserAccount user = AuthPrincipal.current();
        PerformanceReview r = reviews.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Review not found"));
        ensureCanReview(user, r.getEmployee().getId());
        reviews.delete(r);
    }

    /* ===== Permission helpers ===== */

    private void ensureCanModifyGoals(UserAccount user, Long employeeId) {
        // Admin: can modify anyone. Manager: can modify direct reports' goals.
        // Employee: can only modify their own goals.
        if (user.getRole() == Role.ADMIN) return;
        Long me = user.getEmployee() == null ? null : user.getEmployee().getId();
        if (me != null && me.equals(employeeId)) return;
        if (user.getRole() == Role.MANAGER && me != null) {
            Employee target = employees.findById(employeeId).orElse(null);
            if (target != null && target.getManager() != null && me.equals(target.getManager().getId())) return;
        }
        throw new ResponseStatusException(FORBIDDEN, "Not allowed to modify these goals");
    }

    private void ensureCanReview(UserAccount user, Long employeeId) {
        // Only admin and the employee's manager can write reviews.
        if (user.getRole() == Role.ADMIN) return;
        if (user.getRole() == Role.MANAGER && user.getEmployee() != null) {
            Employee target = employees.findById(employeeId).orElse(null);
            if (target != null && target.getManager() != null
                    && user.getEmployee().getId().equals(target.getManager().getId())) return;
        }
        throw new ResponseStatusException(FORBIDDEN, "Only the employee's manager or admin can review");
    }

    private Employee ensureEmployeeExists(Long employeeId) {
        return employees.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
    }

    /* ===== View mappers ===== */

    private PerformanceDto.GoalView view(Goal g) {
        Employee e = g.getEmployee();
        return new PerformanceDto.GoalView(
                g.getId(), e.getId(), e.getEmployeeCode(),
                e.getFirstName() + " " + e.getLastName(),
                g.getTitle(), g.getDescription(), g.getTargetDate(),
                g.getWeight(), g.getProgress(), g.getStatus(),
                g.getCreatedAt(), g.getUpdatedAt());
    }

    private PerformanceDto.ReviewView view(PerformanceReview r) {
        Employee e = r.getEmployee();
        Employee rev = r.getReviewer();
        return new PerformanceDto.ReviewView(
                r.getId(), e.getId(), e.getEmployeeCode(),
                e.getFirstName() + " " + e.getLastName(),
                r.getPeriod(), r.getRating(), r.getComments(),
                rev == null ? null : (rev.getFirstName() + " " + rev.getLastName()),
                r.getCreatedAt(), r.getUpdatedAt());
    }
}
