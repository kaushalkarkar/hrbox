package com.hrms.repo;

import com.hrms.domain.Policy;
import com.hrms.domain.PolicyCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PolicyRepository extends JpaRepository<Policy, Long> {
    List<Policy> findAllByOrderByCategoryAscTitleAsc();
    List<Policy> findByCategoryOrderByTitleAsc(PolicyCategory category);
}
