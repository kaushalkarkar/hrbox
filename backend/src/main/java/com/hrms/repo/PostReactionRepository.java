package com.hrms.repo;

import com.hrms.domain.PostReaction;
import com.hrms.domain.ReactionType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PostReactionRepository extends JpaRepository<PostReaction, Long> {
    List<PostReaction> findByPostId(Long postId);
    Optional<PostReaction> findByPostIdAndEmployeeIdAndType(Long postId, Long employeeId, ReactionType type);
    long countByPostIdAndType(Long postId, ReactionType type);
}
