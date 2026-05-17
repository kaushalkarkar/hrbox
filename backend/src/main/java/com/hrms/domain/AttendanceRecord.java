package com.hrms.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "attendance_record",
       uniqueConstraints = @UniqueConstraint(columnNames = {"employee_id", "date"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AttendanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @Column(nullable = false)
    private LocalDate date;

    private Instant checkIn;
    private Instant checkOut;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private AttendanceStatus status;

    @Column(nullable = false)
    private boolean late = false;

    private Integer workingMinutes;

    @Column(length = 200)
    private String note;

    @PrePersist
    void prePersist() {
        if (date == null) date = LocalDate.now();
        if (status == null) status = AttendanceStatus.ABSENT;
    }
}
