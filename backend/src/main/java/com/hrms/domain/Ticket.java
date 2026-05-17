package com.hrms.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "ticket", indexes = {
        @Index(name = "idx_ticket_raisedby", columnList = "raised_by_id, created_at"),
        @Index(name = "idx_ticket_status",   columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "raised_by_id", nullable = false)
    private Employee raisedBy;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "assignee_id")
    private Employee assignee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TicketCategory category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private TicketPriority priority;

    @Column(nullable = false, length = 200)
    private String subject;

    @Column(columnDefinition = "text", nullable = false)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private TicketStatus status;

    @Column(length = 1000)
    private String resolution;

    @Column(nullable = false)
    private Instant createdAt;

    private Instant updatedAt;

    private Instant resolvedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = TicketStatus.OPEN;
        if (priority == null) priority = TicketPriority.MEDIUM;
    }

    @PreUpdate
    void preUpdate() { updatedAt = Instant.now(); }
}
