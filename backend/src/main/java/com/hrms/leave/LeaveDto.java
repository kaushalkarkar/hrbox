package com.hrms.leave;

import com.hrms.domain.LeaveStatus;
import com.hrms.domain.LeaveType;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.time.LocalDate;

public class LeaveDto {

    public record LeaveView(
            Long id,
            Long employeeId,
            String employeeCode,
            String employeeName,
            LeaveType type,
            LocalDate startDate,
            LocalDate endDate,
            String reason,
            LeaveStatus status,
            String decidedByName,
            String decisionComment,
            Instant createdAt,
            Instant decidedAt
    ) {}

    public record ApplyRequest(
            @NotNull LeaveType type,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            String reason
    ) {}

    public record DecisionRequest(
            String comment
    ) {}

    public record BalanceView(
            int year,
            LeaveType type,
            int allocated,
            int used,
            int remaining
    ) {}
}
