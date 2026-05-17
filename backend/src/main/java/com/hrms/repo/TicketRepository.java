package com.hrms.repo;

import com.hrms.domain.Ticket;
import com.hrms.domain.TicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TicketRepository extends JpaRepository<Ticket, Long> {
    List<Ticket> findByRaisedByIdOrderByCreatedAtDesc(Long employeeId);
    List<Ticket> findByAssigneeIdOrderByCreatedAtDesc(Long employeeId);
    List<Ticket> findByStatusOrderByCreatedAtDesc(TicketStatus status);
    List<Ticket> findAllByOrderByCreatedAtDesc();
}
