package com.hrms.repo;

import com.hrms.domain.Holiday;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface HolidayRepository extends JpaRepository<Holiday, Long> {
    List<Holiday> findByDateBetweenOrderByDateAsc(LocalDate from, LocalDate to);
    boolean existsByDate(LocalDate date);
    java.util.Optional<Holiday> findByDate(LocalDate date);
}
