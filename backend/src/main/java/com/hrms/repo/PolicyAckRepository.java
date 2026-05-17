package com.hrms.repo;

import com.hrms.domain.PolicyAck;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PolicyAckRepository extends JpaRepository<PolicyAck, Long> {
    Optional<PolicyAck> findByPolicyIdAndEmployeeId(Long policyId, Long employeeId);
    List<PolicyAck> findByEmployeeId(Long employeeId);
    long countByPolicyId(Long policyId);
}
