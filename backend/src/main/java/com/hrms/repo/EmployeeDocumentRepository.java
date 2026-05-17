package com.hrms.repo;

import com.hrms.domain.DocumentCategory;
import com.hrms.domain.EmployeeDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EmployeeDocumentRepository extends JpaRepository<EmployeeDocument, Long> {
    List<EmployeeDocument> findByEmployeeIdOrderByUploadedAtDesc(Long employeeId);
    List<EmployeeDocument> findByEmployeeIdAndCategoryOrderByUploadedAtDesc(Long employeeId, DocumentCategory category);
    long countByEmployeeId(Long employeeId);
}
