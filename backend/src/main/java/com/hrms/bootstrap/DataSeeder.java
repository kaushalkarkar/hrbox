package com.hrms.bootstrap;

import com.hrms.domain.*;
import com.hrms.leave.LeaveBalanceService;
import com.hrms.repo.DepartmentRepository;
import com.hrms.repo.EmployeeRepository;
import com.hrms.repo.HolidayRepository;
import com.hrms.repo.LeaveRequestRepository;
import com.hrms.repo.SalaryStructureRepository;
import com.hrms.repo.UserAccountRepository;

import java.math.BigDecimal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserAccountRepository users;
    private final EmployeeRepository employees;
    private final DepartmentRepository departments;
    private final LeaveRequestRepository leaves;
    private final HolidayRepository holidays;
    private final SalaryStructureRepository salaryStructures;
    private final PasswordEncoder encoder;
    private final LeaveBalanceService balances;

    public DataSeeder(UserAccountRepository users,
                      EmployeeRepository employees,
                      DepartmentRepository departments,
                      LeaveRequestRepository leaves,
                      HolidayRepository holidays,
                      SalaryStructureRepository salaryStructures,
                      PasswordEncoder encoder,
                      LeaveBalanceService balances) {
        this.users = users;
        this.employees = employees;
        this.departments = departments;
        this.leaves = leaves;
        this.holidays = holidays;
        this.salaryStructures = salaryStructures;
        this.encoder = encoder;
        this.balances = balances;
    }

    @Override
    @Transactional
    public void run(String... args) {
        seedHolidays();
        seedSalaryStructuresIfMissing();
        if (users.count() > 0) {
            log.info("Skipping user seed: users already present");
            return;
        }

        Department it = departments.save(Department.builder().name("IT").build());
        Department hr = departments.save(Department.builder().name("HR").build());
        departments.save(Department.builder().name("Finance").build());

        Employee adminEmp = employees.save(Employee.builder()
                .employeeCode("EMP-00001")
                .firstName("Aria")
                .lastName("Admin")
                .email("admin@hrms.local")
                .designation("HR Admin")
                .department(hr)
                .joinedOn(LocalDate.of(2022, 1, 10))
                .build());

        Employee mgrEmp = employees.save(Employee.builder()
                .employeeCode("EMP-00002")
                .firstName("Mira")
                .lastName("Manager")
                .email("manager@hrms.local")
                .designation("Engineering Manager")
                .department(it)
                .joinedOn(LocalDate.of(2022, 4, 1))
                .build());

        Employee empEmp = employees.save(Employee.builder()
                .employeeCode("EMP-00003")
                .firstName("Eli")
                .lastName("Employee")
                .email("employee@hrms.local")
                .designation("Software Engineer")
                .department(it)
                .manager(mgrEmp)
                .joinedOn(LocalDate.of(2023, 6, 15))
                .build());

        users.save(UserAccount.builder()
                .email("admin@hrms.local").passwordHash(encoder.encode("admin123"))
                .role(Role.ADMIN).employee(adminEmp).enabled(true).build());
        users.save(UserAccount.builder()
                .email("manager@hrms.local").passwordHash(encoder.encode("manager123"))
                .role(Role.MANAGER).employee(mgrEmp).enabled(true).build());
        users.save(UserAccount.builder()
                .email("employee@hrms.local").passwordHash(encoder.encode("employee123"))
                .role(Role.EMPLOYEE).employee(empEmp).enabled(true).build());

        int currentYear = LocalDate.now().getYear();
        balances.allocateForYear(adminEmp, currentYear);
        balances.allocateForYear(mgrEmp, currentYear);
        balances.allocateForYear(empEmp, currentYear);

        leaves.save(LeaveRequest.builder()
                .employee(empEmp).type(LeaveType.CASUAL)
                .startDate(LocalDate.now().plusDays(7)).endDate(LocalDate.now().plusDays(8))
                .reason("Family event").status(LeaveStatus.PENDING).build());

        // Seed default salary structures
        LocalDate hireDate = LocalDate.of(2023, 1, 1);
        salaryStructures.save(com.hrms.domain.SalaryStructure.builder()
                .employee(adminEmp).effectiveFrom(hireDate)
                .basic(new BigDecimal("60000")).hra(new BigDecimal("24000"))
                .allowances(new BigDecimal("16000")).deductions(new BigDecimal("8000"))
                .build());
        salaryStructures.save(com.hrms.domain.SalaryStructure.builder()
                .employee(mgrEmp).effectiveFrom(hireDate)
                .basic(new BigDecimal("75000")).hra(new BigDecimal("30000"))
                .allowances(new BigDecimal("20000")).deductions(new BigDecimal("11000"))
                .build());
        salaryStructures.save(com.hrms.domain.SalaryStructure.builder()
                .employee(empEmp).effectiveFrom(hireDate)
                .basic(new BigDecimal("40000")).hra(new BigDecimal("16000"))
                .allowances(new BigDecimal("8000")).deductions(new BigDecimal("5000"))
                .build());

        log.info("Seeded HRMS demo data:");
        log.info("  ADMIN    ??? admin@hrms.local    / admin123");
        log.info("  MANAGER  ??? manager@hrms.local  / manager123");
        log.info("  EMPLOYEE ??? employee@hrms.local / employee123");
    }

    private void seedHolidays() {
        if (holidays.count() > 0) return;
        int year = LocalDate.now().getYear();
        // Sample list of Indian public holidays. Customize as needed.
        upsertHoliday(LocalDate.of(year, 1, 26),  "Republic Day",      "National holiday");
        upsertHoliday(LocalDate.of(year, 3, 14),  "Holi",              "Festival of colors");
        upsertHoliday(LocalDate.of(year, 8, 15),  "Independence Day",  "National holiday");
        upsertHoliday(LocalDate.of(year, 10, 2),  "Gandhi Jayanti",    "National holiday");
        upsertHoliday(LocalDate.of(year, 10, 22), "Diwali",            "Festival of lights");
        upsertHoliday(LocalDate.of(year, 12, 25), "Christmas",         "Public holiday");
        log.info("Seeded {} sample holidays for {}", 6, year);
    }

    private void upsertHoliday(LocalDate date, String name, String desc) {
        if (holidays.findByDate(date).isPresent()) return;
        holidays.save(com.hrms.domain.Holiday.builder()
                .date(date).name(name).description(desc).build());
    }

    private void seedSalaryStructuresIfMissing() {
        // Idempotent per-employee: only add a structure for a demo employee
        // if they don't have any structure yet.
        LocalDate hireDate = LocalDate.of(2023, 1, 1);

        seedStructureFor("admin@hrms.local",    hireDate, "60000", "24000", "16000", "8000");
        seedStructureFor("manager@hrms.local",  hireDate, "75000", "30000", "20000", "11000");
        seedStructureFor("employee@hrms.local", hireDate, "40000", "16000", "8000",  "5000");
    }

    private void seedStructureFor(String email, LocalDate hireDate,
                                  String basic, String hra, String allowances, String deductions) {
        employees.findByEmail(email).ifPresent(e -> {
            if (!salaryStructures.findByEmployeeIdOrderByEffectiveFromDesc(e.getId()).isEmpty()) return;
            salaryStructures.save(com.hrms.domain.SalaryStructure.builder()
                    .employee(e).effectiveFrom(hireDate)
                    .basic(new BigDecimal(basic)).hra(new BigDecimal(hra))
                    .allowances(new BigDecimal(allowances)).deductions(new BigDecimal(deductions))
                    .build());
            log.info("Seeded salary structure for {}", email);
        });
    }
}
