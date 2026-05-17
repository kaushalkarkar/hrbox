package com.hrms.repo;

import com.hrms.domain.AttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AttendanceRepository extends JpaRepository<AttendanceRecord, Long> {
    Optional<AttendanceRecord> findByEmployeeIdAndDate(Long employeeId, LocalDate date);
    List<AttendanceRecord> findByEmployeeIdAndDateBetweenOrderByDateAsc(Long employeeId, LocalDate from, LocalDate to);
    List<AttendanceRecord> findByDateOrderByEmployee_EmployeeCodeAsc(LocalDate date);
    List<AttendanceRecord> findByEmployee_Manager_IdAndDateOrderByEmployee_EmployeeCodeAsc(Long managerId, LocalDate date);
}
