package com.hrms.performance;

import com.hrms.domain.*;
import com.hrms.repo.*;
import com.hrms.security.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/performance")
@Transactional
public class PerformanceController {

    private final GoalRepository goals;
    private final PerformanceReviewRepository reviews;
    private final EmployeeRepository employees;

    public PerformanceController(GoalRepository goals, PerformanceReviewRepository reviews,
                                  EmployeeRepository employees) {
        this.goals = goals;
        this.reviews = reviews;
        this.employees = employees;
    }

    public record GoalView(Long id, Long employeeId, String employeeCode, String employeeName,
                            String title, String description, String targetDate,
                            double weight, int progress, String status,
                            String createdAt, String updatedAt) {}

    public record GoalCreate(@NotBlank String title, String description,
                              String targetDate, Double weight) {}

    public record GoalUpdate(@NotBlank String title, String description,
                              String targetDate, Double weight, Integer progress, String status) {}

    public record ReviewView(Long id, Long employeeId, String employeeCode, String employeeName,
                              String period, double rating, String comments, String reviewerName,
                              String createdAt, String updatedAt) {}

    public record ReviewRequest(@NotBlank String period, double rating, String comments) {}

    private GoalView toGoalView(Goal g) {
        return new GoalView(g.getId(), g.getEmployee().getId(),
            g.getEmployee().getEmployeeCode(),
            g.getEmployee().getFirstName() + " " + g.getEmployee().getLastName(),
            g.getTitle(), g.getDescription(),
            g.getTargetDate() != null ? g.getTargetDate().toString() : null,
            g.getWeight(), g.getProgress(), g.getStatus().name(),
            g.getCreatedAt().toString(),
            g.getUpdatedAt() != null ? g.getUpdatedAt().toString() : null);
    }

    private ReviewView toReviewView(PerformanceReview r) {
        return new ReviewView(r.getId(), r.getEmployee().getId(),
            r.getEmployee().getEmployeeCode(),
            r.getEmployee().getFirstName() + " " + r.getEmployee().getLastName(),
            r.getPeriod(), r.getRating(), r.getComments(),
            r.getReviewer() != null ? r.getReviewer().getFirstName() + " " + r.getReviewer().getLastName() : null,
            r.getCreatedAt().toString(),
            r.getUpdatedAt() != null ? r.getUpdatedAt().toString() : null);
    }

    private Employee currentEmployee() {
        UserAccount u = AuthPrincipal.current();
        if (u.getEmployee() == null) throw new ResponseStatusException(BAD_REQUEST, "No employee linked");
        return employees.findById(u.getEmployee().getId())
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
    }

    // ===== GOALS =====
    @GetMapping("/goals/me")
    @Transactional(readOnly = true)
    public List<GoalView> myGoals() {
        return goals.findByEmployeeIdOrderByCreatedAtDesc(currentEmployee().getId())
                    .stream().map(this::toGoalView).toList();
    }

    @GetMapping("/goals/employee/{id}")
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public List<GoalView> goalsForEmployee(@PathVariable Long id) {
        return goals.findByEmployeeIdOrderByCreatedAtDesc(id).stream().map(this::toGoalView).toList();
    }

    @GetMapping("/goals/team")
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public List<GoalView> teamGoals() {
        Employee mgr = currentEmployee();
        return goals.findByEmployee_Manager_IdOrderByCreatedAtDesc(mgr.getId())
                    .stream().map(this::toGoalView).toList();
    }

    @PostMapping("/goals/me")
    public ResponseEntity<GoalView> createMyGoal(@Valid @RequestBody GoalCreate req) {
        Goal g = Goal.builder().employee(currentEmployee()).title(req.title())
            .description(req.description())
            .targetDate(req.targetDate() != null ? LocalDate.parse(req.targetDate()) : null)
            .weight(req.weight() != null ? (int) Math.round(req.weight()) : 10)
            .build();
        return ResponseEntity.status(CREATED).body(toGoalView(goals.save(g)));
    }

    @PostMapping("/goals/employee/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<GoalView> createGoalFor(@PathVariable Long id, @Valid @RequestBody GoalCreate req) {
        Employee emp = employees.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
        Goal g = Goal.builder().employee(emp).title(req.title())
            .description(req.description())
            .targetDate(req.targetDate() != null ? LocalDate.parse(req.targetDate()) : null)
            .weight(req.weight() != null ? (int) Math.round(req.weight()) : 10)
            .build();
        return ResponseEntity.status(CREATED).body(toGoalView(goals.save(g)));
    }

    @PutMapping("/goals/{goalId}")
    public GoalView updateGoal(@PathVariable Long goalId, @Valid @RequestBody GoalUpdate req) {
        Goal g = goals.findById(goalId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Goal not found"));
        g.setTitle(req.title());
        g.setDescription(req.description());
        g.setTargetDate(req.targetDate() != null ? LocalDate.parse(req.targetDate()) : null);
        if (req.weight() != null) g.setWeight((int) Math.round(req.weight()));
        if (req.progress() != null) g.setProgress(req.progress());
        if (req.status() != null) g.setStatus(GoalStatus.valueOf(req.status()));
        g.setUpdatedAt(Instant.now());
        return toGoalView(goals.save(g));
    }

    @DeleteMapping("/goals/{goalId}")
    public ResponseEntity<Void> deleteGoal(@PathVariable Long goalId) {
        if (!goals.existsById(goalId)) throw new ResponseStatusException(NOT_FOUND, "Goal not found");
        goals.deleteById(goalId);
        return ResponseEntity.noContent().build();
    }

    // ===== REVIEWS =====
    @GetMapping("/reviews/me")
    @Transactional(readOnly = true)
    public List<ReviewView> myReviews() {
        return reviews.findByEmployeeIdOrderByCreatedAtDesc(currentEmployee().getId())
                      .stream().map(this::toReviewView).toList();
    }

    @GetMapping("/reviews/employee/{id}")
    @Transactional(readOnly = true)
    public List<ReviewView> reviewsForEmployee(@PathVariable Long id) {
        return reviews.findByEmployeeIdOrderByCreatedAtDesc(id).stream().map(this::toReviewView).toList();
    }

    @GetMapping("/reviews/team")
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public List<ReviewView> teamReviews() {
        return reviews.findByEmployee_Manager_IdOrderByCreatedAtDesc(currentEmployee().getId())
                      .stream().map(this::toReviewView).toList();
    }

    @PostMapping("/reviews/employee/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ReviewView upsertReview(@PathVariable Long id, @Valid @RequestBody ReviewRequest req) {
        Employee emp = employees.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
        Employee reviewer = AuthPrincipal.current().getEmployee() != null
            ? employees.findById(AuthPrincipal.current().getEmployee().getId()).orElse(null) : null;

        PerformanceReview r = PerformanceReview.builder()
            .employee(emp).period(req.period())
            .rating(Math.max(1, Math.min(5, (int) Math.round(req.rating()))))
            .comments(req.comments()).reviewer(reviewer).build();
        return toReviewView(reviews.save(r));
    }

    @DeleteMapping("/reviews/{reviewId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteReview(@PathVariable Long reviewId) {
        if (!reviews.existsById(reviewId)) throw new ResponseStatusException(NOT_FOUND, "Review not found");
        reviews.deleteById(reviewId);
        return ResponseEntity.noContent().build();
    }
}
