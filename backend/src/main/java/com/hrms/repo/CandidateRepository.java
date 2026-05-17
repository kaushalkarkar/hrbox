package com.hrms.repo;

import com.hrms.domain.Candidate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CandidateRepository extends JpaRepository<Candidate, Long> {
    Optional<Candidate> findByEmail(String email);
    boolean existsByEmail(String email);

    @Query("""
            select c from Candidate c
            where lower(c.firstName)    like lower(concat('%', :q, '%'))
               or lower(c.lastName)     like lower(concat('%', :q, '%'))
               or lower(c.email)        like lower(concat('%', :q, '%'))
               or lower(coalesce(c.currentCompany,'')) like lower(concat('%', :q, '%'))
            order by c.createdAt desc
            """)
    List<Candidate> search(@Param("q") String q);

    List<Candidate> findAllByOrderByCreatedAtDesc();
}
