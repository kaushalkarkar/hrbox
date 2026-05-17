package com.hrms.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "job_application",
        uniqueConstraints = @UniqueConstraint(columnNames = {"candidate_id", "job_id"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JobApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "job_id", nullable = false)
    private Job job;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private ApplicationStage stage;

    @Column(length = 1000)
    private String latestNote;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "moved_by_id")
    private Employee lastMovedBy;

    @Column(nullable = false)
    private Instant appliedAt;

    private Instant lastStageChangeAt;

    @PrePersist
    void prePersist() {
        if (appliedAt == null) appliedAt = Instant.now();
        if (stage == null) stage = ApplicationStage.APPLIED;
        if (lastStageChangeAt == null) lastStageChangeAt = appliedAt;
    }
}
