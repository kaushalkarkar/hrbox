package com.hrms.repo;

import com.hrms.domain.SalaryStructure;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SalaryStructureRepository extends JpaRepository<SalaryStructure, Long> {
    List<SalaryStructure> findByEmployeeIdOrderByEffectiveFromDesc(Long employeeId);
    Optional<SalaryStructure> findTopByEmployeeIdOrderByEffectiveFromDesc(Long employeeId);
    Optional<SalaryStructure> findFirstByEmployeeIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(Long employeeId, java.time.LocalDate asOf);
}
