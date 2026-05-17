package com.hrms.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "employee_document", indexes = {
        @Index(name = "idx_doc_employee", columnList = "employee_id, uploaded_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "uploaded_by_id")
    private Employee uploadedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DocumentCategory category;

    /** Original filename as uploaded. */
    @Column(nullable = false, length = 255)
    private String originalFilename;

    /** Stored filename on disk (with random prefix to avoid collisions). */
    @Column(nullable = false, length = 255, unique = true)
    private String storedFilename;

    @Column(nullable = false)
    private long sizeBytes;

    @Column(nullable = false, length = 120)
    private String contentType;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private Instant uploadedAt;

    @PrePersist
    void prePersist() { if (uploadedAt == null) uploadedAt = Instant.now(); }
}
