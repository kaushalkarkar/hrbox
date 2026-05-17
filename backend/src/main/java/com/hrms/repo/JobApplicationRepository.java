package com.hrms.repo;

import com.hrms.domain.ApplicationStage;
import com.hrms.domain.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface JobApplicationRepository extends JpaRepository<JobApplication, Long> {
    List<JobApplication> findByJobIdOrderByAppliedAtDesc(Long jobId);
    List<JobApplication> findByCandidateIdOrderByAppliedAtDesc(Long candidateId);
    List<JobApplication> findByStageOrderByLastStageChangeAtDesc(ApplicationStage stage);
    Optional<JobApplication> findByCandidateIdAndJobId(Long candidateId, Long jobId);

    long countByJobId(Long jobId);
    long countByJobIdAndStage(Long jobId, ApplicationStage stage);
}
