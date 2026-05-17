package com.hrms.repo;

import com.hrms.domain.Expense;
import com.hrms.domain.ExpenseStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    List<Expense> findByEmployeeIdOrderByCreatedAtDesc(Long employeeId);

    List<Expense> findByStatusOrderByCreatedAtDesc(ExpenseStatus status);

    List<Expense> findByEmployee_Manager_IdAndStatusOrderByCreatedAtDesc(Long managerId, ExpenseStatus status);

    List<Expense> findAllByOrderByCreatedAtDesc();

    /** Sum of approved amounts for an employee since a given timestamp. Returns 0 if none. */
    @org.springframework.data.jpa.repository.Query(
            "select coalesce(sum(e.amount), 0) from Expense e " +
            "where e.employee.id = :empId and e.status = com.hrms.domain.ExpenseStatus.APPROVED " +
            "and e.decidedAt >= :since")
    BigDecimal sumApprovedSince(Long empId, Instant since);
}
