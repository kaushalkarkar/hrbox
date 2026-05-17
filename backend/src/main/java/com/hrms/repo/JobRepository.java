package com.hrms.repo;

import com.hrms.domain.Job;
import com.hrms.domain.JobStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobRepository extends JpaRepository<Job, Long> {
    List<Job> findAllByOrderByCreatedAtDesc();
    List<Job> findByStatusOrderByCreatedAtDesc(JobStatus status);
    List<Job> findByDepartmentIdOrderByCreatedAtDesc(Long departmentId);
}
