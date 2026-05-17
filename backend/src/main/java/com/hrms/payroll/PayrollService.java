package com.hrms.payroll;

import com.hrms.attendance.AttendanceService;
import com.hrms.domain.AttendanceStatus;
import com.hrms.domain.Employee;
import com.hrms.domain.NotificationType;
import com.hrms.domain.Payslip;
import com.hrms.domain.SalaryStructure;
import com.hrms.notification.NotificationService;
import com.hrms.repo.EmployeeRepository;
import com.hrms.repo.PayslipRepository;
import com.hrms.repo.SalaryStructureRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Month;
import java.time.format.TextStyle;
import java.util.Locale;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.springframework.http.HttpStatus.*;

@Service
@Transactional
public class PayrollService {

    private final SalaryStructureRepository structures;
    private final PayslipRepository payslips;
    private final EmployeeRepository employees;
    private final AttendanceService attendance;
    private final NotificationService notifications;

    public PayrollService(SalaryStructureRepository structures,
                          PayslipRepository payslips,
                          EmployeeRepository employees,
                          AttendanceService attendance,
                          NotificationService notifications) {
        this.structures = structures;
        this.payslips = payslips;
        this.employees = employees;
        this.attendance = attendance;
        this.notifications = notifications;
    }

    /* === Structures === */

    @Transactional(readOnly = true)
    public List<SalaryStructure> structuresFor(Long employeeId) {
        return structures.findByEmployeeIdOrderByEffectiveFromDesc(employeeId);
    }

    @Transactional(readOnly = true)
    public Optional<SalaryStructure> activeStructure(Long employeeId, LocalDate asOf) {
        return structures.findFirstByEmployeeIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(employeeId, asOf);
    }

    public SalaryStructure addStructure(Long employeeId, PayrollDto.StructureRequest req) {
        Employee e = mustLoadEmployee(employeeId);
        SalaryStructure s = SalaryStructure.builder()
                .employee(e)
                .effectiveFrom(req.effectiveFrom())
                .basic(req.basic())
                .hra(req.hra())
                .allowances(req.allowances())
                .deductions(req.deductions())
                .build();
        return structures.save(s);
    }

    public SalaryStructure updateStructure(Long structureId, PayrollDto.StructureRequest req) {
        SalaryStructure s = structures.findById(structureId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Structure not found"));
        s.setEffectiveFrom(req.effectiveFrom());
        s.setBasic(req.basic());
        s.setHra(req.hra());
        s.setAllowances(req.allowances());
        s.setDeductions(req.deductions());
        return s;
    }

    public void deleteStructure(Long structureId) {
        if (!structures.existsById(structureId))
            throw new ResponseStatusException(NOT_FOUND, "Structure not found");
        structures.deleteById(structureId);
    }

    /* === Payslips === */

    @Transactional(readOnly = true)
    public List<Payslip> payslipsFor(Long employeeId) {
        return payslips.findByEmployeeIdOrderByYearDescMonthDesc(employeeId);
    }

    @Transactional(readOnly = true)
    public List<Payslip> payslipsForMonth(int year, int month) {
        return payslips.findByYearAndMonthOrderByEmployee_FirstNameAsc(year, month);
    }

    @Transactional(readOnly = true)
    public Payslip mustLoadPayslip(Long id) {
        return payslips.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payslip not found"));
    }

    public PayrollDto.GenerateResult generate(int year, int month, Long employeeIdOrNull) {
        if (month < 1 || month > 12) throw new ResponseStatusException(BAD_REQUEST, "month must be 1..12");

        List<Employee> targets;
        if (employeeIdOrNull != null) {
            targets = List.of(mustLoadEmployee(employeeIdOrNull));
        } else {
            targets = employees.findAll();
        }

        int generated = 0, skippedNoStructure = 0, alreadyExisted = 0;
        LocalDate monthEnd = LocalDate.of(year, month, 1).withDayOfMonth(LocalDate.of(year, month, 1).lengthOfMonth());

        for (Employee e : targets) {
            // Skip if payslip already exists for this period
            if (payslips.findByEmployeeIdAndYearAndMonth(e.getId(), year, month).isPresent()) {
                alreadyExisted++;
                continue;
            }
            Optional<SalaryStructure> sOpt = structures.findFirstByEmployeeIdAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(
                    e.getId(), monthEnd);
            if (sOpt.isEmpty()) { skippedNoStructure++; continue; }
            SalaryStructure s = sOpt.get();

            // Compute working days vs paid days from attendance for that month
            LocalDate from = LocalDate.of(year, month, 1);
            LocalDate to = monthEnd;
            var days = attendance.daily(e, from, to);
            int workingDays = 0;     // weekday & not holiday
            int paidDays2x = 0;      // doubled to allow half-day = 1
            for (var d : days) {
                AttendanceStatus st = d.status();
                boolean isWorkingDay = st != AttendanceStatus.WEEKEND && st != AttendanceStatus.HOLIDAY;
                if (isWorkingDay) workingDays++;
                if (st == AttendanceStatus.PRESENT)         paidDays2x += 2;
                else if (st == AttendanceStatus.HALF_DAY)   paidDays2x += 1;
                else if (st == AttendanceStatus.ON_LEAVE)   paidDays2x += 2;  // approved leaves are paid
            }
            int paidDays = paidDays2x / 2;  // floor; half-days handled in pro-rate

            // Skip generating a payslip if the employee has zero paid days that month.
            // (Mirrors real payroll behaviour ??? a no-work month has no payslip.)
            if (paidDays2x == 0) {
                skippedNoStructure++;  // counted under "skipped" ??? UI message stays simple
                continue;
            }

            // Pro-rate based on (paidDays2x / (workingDays * 2))
            BigDecimal proRate = workingDays == 0
                    ? BigDecimal.ZERO
                    : BigDecimal.valueOf(paidDays2x).divide(BigDecimal.valueOf(workingDays * 2L), 6, RoundingMode.HALF_UP);

            BigDecimal basic       = scale(s.getBasic().multiply(proRate));
            BigDecimal hra         = scale(s.getHra().multiply(proRate));
            BigDecimal allowances  = scale(s.getAllowances().multiply(proRate));
            BigDecimal deductions  = scale(s.getDeductions());  // deductions are NOT prorated
            BigDecimal gross       = basic.add(hra).add(allowances);
            BigDecimal net         = gross.subtract(deductions);

            payslips.save(Payslip.builder()
                    .employee(e)
                    .year(year).month(month)
                    .basic(basic).hra(hra).allowances(allowances).deductions(deductions)
                    .grossSalary(gross).netSalary(net)
                    .workingDays(workingDays).paidDays(paidDays)
                    .build());
            String monthName = Month.of(month).getDisplayName(TextStyle.FULL, Locale.ENGLISH);
            notifications.notifyByEmail(
                    e.getEmail(),
                    NotificationType.PAYSLIP_RELEASED,
                    "Payslip released",
                    "Your payslip for " + monthName + " " + year + " has been released.",
                    "/payroll/me"
            );
            generated++;
        }
        return new PayrollDto.GenerateResult(generated, skippedNoStructure, alreadyExisted);
    }

    private Employee mustLoadEmployee(Long id) {
        return employees.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
    }

    private static BigDecimal scale(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v.setScale(2, RoundingMode.HALF_UP);
    }
}
