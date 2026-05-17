package com.hrms.leave;

import com.hrms.domain.Employee;
import com.hrms.domain.LeaveBalance;
import com.hrms.domain.LeaveType;
import com.hrms.repo.LeaveBalanceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.Year;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class LeaveBalanceService {

    public static final Map<LeaveType, Integer> DEFAULT_ALLOCATION = new EnumMap<>(LeaveType.class);
    static {
        DEFAULT_ALLOCATION.put(LeaveType.SICK, 12);
        DEFAULT_ALLOCATION.put(LeaveType.CASUAL, 12);
        DEFAULT_ALLOCATION.put(LeaveType.PAID, 21);
    }

    private final LeaveBalanceRepository repo;

    public LeaveBalanceService(LeaveBalanceRepository repo) {
        this.repo = repo;
    }

    public void allocateForYear(Employee employee, int year) {
        for (LeaveType type : LeaveType.values()) {
            if (repo.findByEmployeeIdAndYearAndType(employee.getId(), year, type).isPresent()) continue;
            repo.save(LeaveBalance.builder()
                    .employee(employee)
                    .year(year)
                    .type(type)
                    .allocated(DEFAULT_ALLOCATION.getOrDefault(type, 0))
                    .used(0)
                    .build());
        }
    }

    @Transactional(readOnly = true)
    public List<LeaveBalance> getForEmployeeAndYear(Long employeeId, int year) {
        // Lazy-allocate if missing ??? convenient for existing employees seeded before this feature.
        List<LeaveBalance> existing = repo.findByEmployeeIdAndYear(employeeId, year);
        if (existing.size() == LeaveType.values().length) return existing;
        return existing;  // caller must ensureAllocated() if needed
    }

    public List<LeaveBalance> ensureAndGet(Employee employee, int year) {
        allocateForYear(employee, year);
        return repo.findByEmployeeIdAndYear(employee.getId(), year);
    }

    public LeaveBalance getOrCreate(Employee employee, int year, LeaveType type) {
        return repo.findByEmployeeIdAndYearAndType(employee.getId(), year, type)
                .orElseGet(() -> repo.save(LeaveBalance.builder()
                        .employee(employee).year(year).type(type)
                        .allocated(DEFAULT_ALLOCATION.getOrDefault(type, 0))
                        .used(0).build()));
    }

    public void recordApproval(Employee employee, LeaveType type, LocalDate start, LocalDate end) {
        int days = daysInclusive(start, end);
        int year = start.getYear();
        LeaveBalance b = getOrCreate(employee, year, type);
        b.setUsed(b.getUsed() + days);
    }

    public int remaining(Employee employee, LeaveType type, int year) {
        LeaveBalance b = getOrCreate(employee, year, type);
        return b.getAllocated() - b.getUsed();
    }

    public static int daysInclusive(LocalDate start, LocalDate end) {
        return (int) ChronoUnit.DAYS.between(start, end) + 1;
    }

    public static int currentYear() {
        return Year.now().getValue();
    }
}
