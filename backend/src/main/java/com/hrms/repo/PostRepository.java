package com.hrms.repo;

import com.hrms.domain.Post;
import com.hrms.domain.PostCategory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findAllByOrderByPinnedDescCreatedAtDesc(Pageable pageable);
    List<Post> findByCategoryOrderByPinnedDescCreatedAtDesc(PostCategory category, Pageable pageable);
}
