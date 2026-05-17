package com.hrms.performance;

import com.hrms.domain.GoalStatus;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.time.LocalDate;

public class PerformanceDto {

    public record GoalView(
            Long id,
            Long employeeId,
            String employeeCode,
            String employeeName,
            String title,
            String description,
            LocalDate targetDate,
            int weight,
            int progress,
            GoalStatus status,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record GoalCreateRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 1000) String description,
            LocalDate targetDate,
            @Min(1) @Max(100) Integer weight
    ) {}

    public record GoalUpdateRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 1000) String description,
            LocalDate targetDate,
            @Min(1) @Max(100) Integer weight,
            @Min(0) @Max(100) Integer progress,
            GoalStatus status
    ) {}

    public record ReviewView(
            Long id,
            Long employeeId,
            String employeeCode,
            String employeeName,
            String period,
            int rating,
            String comments,
            String reviewerName,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record ReviewRequest(
            @NotBlank @Size(max = 32) String period,
            @Min(1) @Max(5) int rating,
            @Size(max = 2000) String comments
    ) {}
}
