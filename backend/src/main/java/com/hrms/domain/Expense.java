package com.hrms.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "expense", indexes = {
        @Index(name = "idx_expense_employee_created", columnList = "employee_id, created_at"),
        @Index(name = "idx_expense_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ExpenseCategory category;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 8)
    private String currency;

    @Column(nullable = false)
    private LocalDate expenseDate;

    @Column(length = 500)
    private String description;

    @Column(length = 255)
    private String receiptFilename;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ExpenseStatus status;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "decided_by_id")
    private Employee decidedBy;

    @Column(length = 500)
    private String decisionComment;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant decidedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = ExpenseStatus.PENDING;
        if (currency == null) currency = "INR";
    }
}
