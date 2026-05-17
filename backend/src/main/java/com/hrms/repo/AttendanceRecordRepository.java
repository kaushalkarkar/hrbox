package com.hrms.repo;

import com.hrms.domain.AttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Long> {

    Optional<AttendanceRecord> findByEmployeeIdAndDate(Long employeeId, LocalDate date);

    List<AttendanceRecord> findByEmployeeIdAndDateBetweenOrderByDateAsc(Long employeeId,
                                                                       LocalDate from,
                                                                       LocalDate to);

    List<AttendanceRecord> findByDateOrderByEmployee_FirstNameAsc(LocalDate date);

    List<AttendanceRecord> findByEmployee_Manager_IdAndDateOrderByEmployee_FirstNameAsc(Long managerId,
                                                                                       LocalDate date);
}
