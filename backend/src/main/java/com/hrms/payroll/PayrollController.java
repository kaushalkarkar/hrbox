package com.hrms.payroll;

import com.hrms.domain.*;
import com.hrms.notification.NotificationService;
import com.hrms.repo.*;
import com.hrms.security.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/payroll")
@Transactional
public class PayrollController {

    private final SalaryStructureRepository structures;
    private final PayslipRepository payslips;
    private final EmployeeRepository employees;
    private final UserAccountRepository users;
    private final NotificationService notifService;

    public PayrollController(SalaryStructureRepository structures, PayslipRepository payslips,
                              EmployeeRepository employees, UserAccountRepository users,
                              NotificationService notifService) {
        this.structures = structures;
        this.payslips = payslips;
        this.employees = employees;
        this.users = users;
        this.notifService = notifService;
    }

    public record StructureView(Long id, Long employeeId, String employeeCode, String employeeName,
                                 String effectiveFrom, double basic, double hra, double allowances,
                                 double deductions, double grossMonthly, double netMonthly) {}

    public record StructureRequest(@NotNull String effectiveFrom, @NotNull BigDecimal basic,
                                    @NotNull BigDecimal hra, @NotNull BigDecimal allowances,
                                    @NotNull BigDecimal deductions) {}

    public record PayslipView(Long id, Long employeeId, String employeeCode, String employeeName,
                               int year, int month, double basic, double hra, double allowances,
                               double deductions, double grossSalary, double netSalary,
                               int workingDays, int paidDays, String generatedAt) {}

    public record GenerateRequest(int year, int month, Long employeeId) {}
    public record GenerateResult(int generated, int skippedNoStructure, int alreadyExisted) {}

    private StructureView toStructureView(SalaryStructure s) {
        BigDecimal gross = s.getBasic().add(s.getHra()).add(s.getAllowances());
        BigDecimal net = gross.subtract(s.getDeductions());
        return new StructureView(s.getId(), s.getEmployee().getId(),
            s.getEmployee().getEmployeeCode(),
            s.getEmployee().getFirstName() + " " + s.getEmployee().getLastName(),
            s.getEffectiveFrom().toString(),
            s.getBasic().doubleValue(), s.getHra().doubleValue(),
            s.getAllowances().doubleValue(), s.getDeductions().doubleValue(),
            gross.doubleValue(), net.doubleValue());
    }

    private PayslipView toPayslipView(Payslip p) {
        return new PayslipView(p.getId(), p.getEmployee().getId(),
            p.getEmployee().getEmployeeCode(),
            p.getEmployee().getFirstName() + " " + p.getEmployee().getLastName(),
            p.getYear(), p.getMonth(),
            p.getBasic().doubleValue(), p.getHra().doubleValue(),
            p.getAllowances().doubleValue(), p.getDeductions().doubleValue(),
            p.getGrossSalary().doubleValue(), p.getNetSalary().doubleValue(),
            p.getWorkingDays(), p.getPaidDays(), p.getGeneratedAt().toString());
    }

    @GetMapping("/structures/{employeeId}")
    @Transactional(readOnly = true)
    public List<StructureView> structuresFor(@PathVariable Long employeeId) {
        return structures.findByEmployeeIdOrderByEffectiveFromDesc(employeeId)
                         .stream().map(this::toStructureView).toList();
    }

    @PostMapping("/structures/{employeeId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StructureView> addStructure(@PathVariable Long employeeId,
                                                        @Valid @RequestBody StructureRequest req) {
        Employee emp = employees.findById(employeeId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
        SalaryStructure s = SalaryStructure.builder()
            .employee(emp).effectiveFrom(LocalDate.parse(req.effectiveFrom()))
            .basic(req.basic()).hra(req.hra()).allowances(req.allowances()).deductions(req.deductions())
            .build();
        return ResponseEntity.status(CREATED).body(toStructureView(structures.save(s)));
    }

    @PutMapping("/structures/id/{structureId}")
    @PreAuthorize("hasRole('ADMIN')")
    public StructureView updateStructure(@PathVariable Long structureId, @Valid @RequestBody StructureRequest req) {
        SalaryStructure s = structures.findById(structureId)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Salary structure not found"));
        s.setEffectiveFrom(LocalDate.parse(req.effectiveFrom()));
        s.setBasic(req.basic()); s.setHra(req.hra());
        s.setAllowances(req.allowances()); s.setDeductions(req.deductions());
        return toStructureView(structures.save(s));
    }

    @DeleteMapping("/structures/id/{structureId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteStructure(@PathVariable Long structureId) {
        if (!structures.existsById(structureId))
            throw new ResponseStatusException(NOT_FOUND, "Salary structure not found");
        structures.deleteById(structureId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/payslips/generate")
    @PreAuthorize("hasRole('ADMIN')")
    public GenerateResult generate(@RequestBody GenerateRequest req) {
        List<Employee> targets = req.employeeId() != null
            ? employees.findById(req.employeeId()).map(List::of).orElse(List.of())
            : employees.findByActiveTrue();

        int generated = 0, skipped = 0, existed = 0;
        int workingDays = workingDaysInMonth(req.year(), req.month());

        for (Employee emp : targets) {
            if (payslips.existsByEmployeeIdAndYearAndMonth(emp.getId(), req.year(), req.month())) {
                existed++; continue;
            }
            SalaryStructure s = structures.findTopByEmployeeIdOrderByEffectiveFromDesc(emp.getId()).orElse(null);
            if (s == null) { skipped++; continue; }

            BigDecimal gross = s.getBasic().add(s.getHra()).add(s.getAllowances());
            BigDecimal net = gross.subtract(s.getDeductions());
            Payslip p = Payslip.builder()
                .employee(emp).year(req.year()).month(req.month())
                .basic(s.getBasic()).hra(s.getHra()).allowances(s.getAllowances()).deductions(s.getDeductions())
                .grossSalary(gross).netSalary(net)
                .workingDays(workingDays).paidDays(workingDays)
                .build();
            payslips.save(p);
            generated++;

            users.findAll().stream()
                .filter(u -> u.getEmployee() != null && u.getEmployee().getId().equals(emp.getId()))
                .findFirst().ifPresent(u ->
                    notifService.push(u, NotificationType.PAYSLIP_RELEASED,
                        "Payslip Released", "Your payslip for " + req.month() + "/" + req.year() + " is ready",
                        "/payroll"));
        }
        return new GenerateResult(generated, skipped, existed);
    }

    @GetMapping("/payslips/me")
    @Transactional(readOnly = true)
    public List<PayslipView> myPayslips() {
        UserAccount u = AuthPrincipal.current();
        if (u.getEmployee() == null) return List.of();
        return payslips.findByEmployeeIdOrderByYearDescMonthDesc(u.getEmployee().getId())
                       .stream().map(this::toPayslipView).toList();
    }

    @GetMapping("/payslips/employee/{id}")
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public List<PayslipView> employeePayslips(@PathVariable Long id) {
        return payslips.findByEmployeeIdOrderByYearDescMonthDesc(id)
                       .stream().map(this::toPayslipView).toList();
    }

    @GetMapping("/payslips/month")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public List<PayslipView> monthPayslips(@RequestParam int year, @RequestParam int month) {
        return payslips.findByYearAndMonthOrderByEmployee_EmployeeCodeAsc(year, month)
                       .stream().map(this::toPayslipView).toList();
    }

    @GetMapping("/payslips/{id}")
    @Transactional(readOnly = true)
    public PayslipView getPayslip(@PathVariable Long id) {
        return toPayslipView(payslips.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payslip not found")));
    }

    @GetMapping("/payslips/{id}/pdf")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> downloadPdf(@PathVariable Long id) {
        Payslip p = payslips.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Payslip not found"));
        String text = buildPayslipText(p);
        byte[] bytes = text.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=payslip-" + p.getYear() + "-" + p.getMonth() + ".txt")
            .contentType(MediaType.TEXT_PLAIN)
            .body(bytes);
    }

    private String buildPayslipText(Payslip p) {
        return "PAYSLIP\n" +
            "Employee: " + p.getEmployee().getFirstName() + " " + p.getEmployee().getLastName() + "\n" +
            "Code: " + p.getEmployee().getEmployeeCode() + "\n" +
            "Period: " + p.getMonth() + "/" + p.getYear() + "\n" +
            "Basic: " + p.getBasic() + "\n" +
            "HRA: " + p.getHra() + "\n" +
            "Allowances: " + p.getAllowances() + "\n" +
            "Deductions: " + p.getDeductions() + "\n" +
            "Gross: " + p.getGrossSalary() + "\n" +
            "Net: " + p.getNetSalary() + "\n";
    }

    private int workingDaysInMonth(int year, int month) {
        LocalDate first = LocalDate.of(year, month, 1);
        LocalDate last = first.withDayOfMonth(first.lengthOfMonth());
        return (int) first.datesUntil(last.plusDays(1))
            .filter(d -> d.getDayOfWeek().getValue() < 6).count();
    }
}
