package com.hrms.repo;

import com.hrms.domain.LeaveRequest;
import com.hrms.domain.LeaveStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, Long> {

    List<LeaveRequest> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId);

    List<LeaveRequest> findByStatusOrderByCreatedAtDesc(LeaveStatus status);

    List<LeaveRequest> findByEmployee_Manager_IdAndStatusOrderByCreatedAtDesc(Long managerId, LeaveStatus status);

    List<LeaveRequest> findAllByOrderByCreatedAtDesc();
}
