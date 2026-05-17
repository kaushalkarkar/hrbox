package com.hrms.repo;

import com.hrms.domain.Employee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    Optional<Employee> findByEmail(String email);
    boolean existsByEmail(String email);
    List<Employee> findByManagerId(Long managerId);
    List<Employee> findByActiveTrue();

    @Query("SELECT e FROM Employee e WHERE e.active = true " +
           "AND (:departmentId IS NULL OR e.department.id = :departmentId) " +
           "AND (:q IS NULL OR LOWER(e.firstName) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "     OR LOWER(e.lastName) LIKE LOWER(CONCAT('%',:q,'%')) " +
           "     OR LOWER(e.employeeCode) LIKE LOWER(CONCAT('%',:q,'%')))")
    List<Employee> search(@Param("departmentId") Long departmentId, @Param("q") String q);
}
