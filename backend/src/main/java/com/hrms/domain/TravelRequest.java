package com.hrms.domain;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "travel_request", indexes = {
        @Index(name = "idx_travel_employee_created", columnList = "employee_id, created_at"),
        @Index(name = "idx_travel_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TravelRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(nullable = false, length = 120)
    private String origin;

    @Column(nullable = false, length = 120)
    private String destination;

    @Column(nullable = false)
    private LocalDate departureDate;

    @Column(nullable = false)
    private LocalDate returnDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TravelMode mode;

    @Column(nullable = false, length = 500)
    private String purpose;

    @Column(precision = 12, scale = 2)
    private BigDecimal estimatedCost;

    @Column(nullable = false, length = 8)
    private String currency;

    @Column(length = 500)
    private String accommodation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TravelStatus status;

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
        if (status == null) status = TravelStatus.PENDING;
        if (currency == null) currency = "INR";
    }
}
