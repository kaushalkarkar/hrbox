package com.hrms.repo;

import com.hrms.domain.PerformanceReview;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PerformanceReviewRepository extends JpaRepository<PerformanceReview, Long> {
    List<PerformanceReview> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId);
    List<PerformanceReview> findByEmployee_Manager_IdOrderByCreatedAtDesc(Long managerId);
    java.util.Optional<PerformanceReview> findByEmployeeIdAndPeriod(Long employeeId, String period);
}
