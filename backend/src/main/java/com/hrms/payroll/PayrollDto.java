package com.hrms.payroll;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public class PayrollDto {

    public record StructureView(
            Long id,
            Long employeeId,
            String employeeCode,
            String employeeName,
            LocalDate effectiveFrom,
            BigDecimal basic,
            BigDecimal hra,
            BigDecimal allowances,
            BigDecimal deductions,
            BigDecimal grossMonthly,
            BigDecimal netMonthly
    ) {}

    public record StructureRequest(
            @NotNull LocalDate effectiveFrom,
            @NotNull @DecimalMin("0.0") BigDecimal basic,
            @NotNull @DecimalMin("0.0") BigDecimal hra,
            @NotNull @DecimalMin("0.0") BigDecimal allowances,
            @NotNull @DecimalMin("0.0") BigDecimal deductions
    ) {}

    public record PayslipView(
            Long id,
            Long employeeId,
            String employeeCode,
            String employeeName,
            int year,
            int month,
            BigDecimal basic,
            BigDecimal hra,
            BigDecimal allowances,
            BigDecimal deductions,
            BigDecimal grossSalary,
            BigDecimal netSalary,
            int workingDays,
            int paidDays,
            Instant generatedAt
    ) {}

    public record GenerateRequest(
            @NotNull Integer year,
            @NotNull Integer month,
            Long employeeId    // null = generate for all employees with a structure
    ) {}

    public record GenerateResult(int generated, int skippedNoStructure, int alreadyExisted) {}
}
