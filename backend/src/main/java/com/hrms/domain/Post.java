package com.hrms.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "post", indexes = {
        @Index(name = "idx_post_created", columnList = "created_at"),
        @Index(name = "idx_post_category", columnList = "category")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private Employee author;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private PostCategory category;

    @Column(columnDefinition = "text", nullable = false)
    private String body;

    /** Optional: tag another employee (kudos to / question for). */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "subject_id")
    private Employee subject;

    @Column(nullable = false)
    private boolean pinned;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (category == null) category = PostCategory.GENERAL;
    }
}
