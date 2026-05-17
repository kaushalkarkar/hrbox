package com.hrms.repo;

import com.hrms.domain.Payslip;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PayslipRepository extends JpaRepository<Payslip, Long> {
    List<Payslip> findByEmployeeIdOrderByYearDescMonthDesc(Long employeeId);
    List<Payslip> findByYearAndMonthOrderByEmployee_EmployeeCodeAsc(int year, int month);
    List<Payslip> findByYearAndMonthOrderByEmployee_FirstNameAsc(int year, int month);
    Optional<Payslip> findByEmployeeIdAndYearAndMonth(Long employeeId, int year, int month);
    boolean existsByEmployeeIdAndYearAndMonth(Long employeeId, int year, int month);
}
