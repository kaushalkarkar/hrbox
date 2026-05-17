package com.hrms.attendance;

import com.hrms.domain.AttendanceStatus;

import java.time.Instant;
import java.time.LocalDate;

public class AttendanceDto {

    public record AttendanceView(
            Long id,
            Long employeeId,
            String employeeCode,
            String employeeName,
            LocalDate date,
            Instant checkIn,
            Instant checkOut,
            AttendanceStatus status,
            boolean late,
            Integer workingMinutes
    ) {}

    public record DayView(
            LocalDate date,
            AttendanceStatus status,
            Instant checkIn,
            Instant checkOut,
            boolean late,
            Integer workingMinutes,
            String note
    ) {}

    public record MonthSummary(
            int year,
            int month,
            int present,
            int halfDay,
            int absent,
            int onLeave,
            int holiday,
            int weekend,
            int lateMarks
    ) {}
}
