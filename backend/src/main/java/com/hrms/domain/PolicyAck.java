package com.hrms.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "policy_ack",
        uniqueConstraints = @UniqueConstraint(columnNames = {"policy_id", "employee_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PolicyAck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "policy_id", nullable = false)
    private Policy policy;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    /** Version of the policy that was acknowledged. */
    @Column(nullable = false, length = 16)
    private String version;

    @Column(nullable = false)
    private Instant acknowledgedAt;

    @PrePersist
    void prePersist() { if (acknowledgedAt == null) acknowledgedAt = Instant.now(); }
}
