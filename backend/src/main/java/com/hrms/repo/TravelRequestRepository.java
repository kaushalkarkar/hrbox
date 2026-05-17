package com.hrms.repo;

import com.hrms.domain.TravelRequest;
import com.hrms.domain.TravelStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TravelRequestRepository extends JpaRepository<TravelRequest, Long> {
    List<TravelRequest> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId);
    List<TravelRequest> findByStatusOrderByCreatedAtDesc(TravelStatus status);
    List<TravelRequest> findByEmployee_Manager_IdAndStatusOrderByCreatedAtDesc(Long managerId, TravelStatus status);
    List<TravelRequest> findAllByOrderByCreatedAtDesc();
}
