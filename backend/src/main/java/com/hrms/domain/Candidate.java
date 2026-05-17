package com.hrms.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "candidate", uniqueConstraints = @UniqueConstraint(columnNames = "email"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Candidate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 80)
    private String firstName;

    @Column(nullable = false, length = 80)
    private String lastName;

    @Column(nullable = false, length = 120)
    private String email;

    @Column(length = 20)
    private String phone;

    @Column(length = 120)
    private String currentCompany;

    private Integer yearsOfExperience;

    /** Where the candidate came from: REFERRAL, LINKEDIN, NAUKRI, AGENCY, WEBSITE, OTHER. */
    @Column(nullable = false, length = 24)
    private String source;

    /** The employee who referred the candidate, if any. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "referrer_id")
    private Employee referrer;

    @Column(length = 200)
    private String resumeFilename;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (source == null || source.isBlank()) source = "OTHER";
    }
}
