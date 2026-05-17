package com.hrms.attendance;

import com.hrms.domain.*;
import com.hrms.repo.AttendanceRepository;
import com.hrms.repo.EmployeeRepository;
import com.hrms.security.AuthPrincipal;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.*;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/attendance")
@Transactional
public class AttendanceController {

    private final AttendanceRepository repo;
    private final EmployeeRepository employees;

    private static final LocalTime SHIFT_START = LocalTime.of(9, 30);
    private static final LocalTime LATE_THRESHOLD = LocalTime.of(9, 45);

    public AttendanceController(AttendanceRepository repo, EmployeeRepository employees) {
        this.repo = repo;
        this.employees = employees;
    }

    public record RecordView(Long id, Long employeeId, String employeeCode, String employeeName,
                              String date, String checkIn, String checkOut,
                              String status, boolean late, Integer workingMinutes) {}

    public record DayView(String date, String status, String checkIn, String checkOut,
                           boolean late, Integer workingMinutes, String note) {}

    public record SummaryView(int year, int month, int present, int halfDay, int absent,
                               int onLeave, int holiday, int weekend, int lateMarks) {}

    private RecordView toRecordView(AttendanceRecord r) {
        return new RecordView(r.getId(),
            r.getEmployee().getId(), r.getEmployee().getEmployeeCode(),
            r.getEmployee().getFirstName() + " " + r.getEmployee().getLastName(),
            r.getDate().toString(),
            r.getCheckIn() != null ? r.getCheckIn().toString() : null,
            r.getCheckOut() != null ? r.getCheckOut().toString() : null,
            r.getStatus().name(), r.isLate(), r.getWorkingMinutes());
    }

    private DayView toDayView(AttendanceRecord r) {
        return new DayView(r.getDate().toString(), r.getStatus().name(),
            r.getCheckIn() != null ? r.getCheckIn().toString() : null,
            r.getCheckOut() != null ? r.getCheckOut().toString() : null,
            r.isLate(), r.getWorkingMinutes(), r.getNote());
    }

    private Employee currentEmployee() {
        UserAccount u = AuthPrincipal.current();
        if (u.getEmployee() == null) throw new ResponseStatusException(BAD_REQUEST, "No employee linked");
        return employees.findById(u.getEmployee().getId())
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
    }

    @GetMapping("/today")
    @Transactional(readOnly = true)
    public ResponseEntity<RecordView> today() {
        Employee emp = currentEmployee();
        return repo.findByEmployeeIdAndDate(emp.getId(), LocalDate.now())
                   .map(r -> ResponseEntity.ok(toRecordView(r)))
                   .orElse(ResponseEntity.ok(null));
    }

    @PostMapping("/check-in")
    public RecordView checkIn() {
        Employee emp = currentEmployee();
        LocalDate today = LocalDate.now();
        AttendanceRecord rec = repo.findByEmployeeIdAndDate(emp.getId(), today)
            .orElse(AttendanceRecord.builder().employee(emp).date(today).build());
        if (rec.getCheckIn() != null) throw new ResponseStatusException(BAD_REQUEST, "Already checked in");
        Instant now = Instant.now();
        LocalTime lt = now.atZone(ZoneId.of("Asia/Kolkata")).toLocalTime();
        rec.setCheckIn(now);
        rec.setStatus(AttendanceStatus.PRESENT);
        rec.setLate(lt.isAfter(LATE_THRESHOLD));
        return toRecordView(repo.save(rec));
    }

    @PostMapping("/check-out")
    public RecordView checkOut() {
        Employee emp = currentEmployee();
        AttendanceRecord rec = repo.findByEmployeeIdAndDate(emp.getId(), LocalDate.now())
            .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Not checked in today"));
        if (rec.getCheckIn() == null) throw new ResponseStatusException(BAD_REQUEST, "Not checked in");
        if (rec.getCheckOut() != null) throw new ResponseStatusException(BAD_REQUEST, "Already checked out");
        Instant now = Instant.now();
        rec.setCheckOut(now);
        int minutes = (int) Duration.between(rec.getCheckIn(), now).toMinutes();
        rec.setWorkingMinutes(minutes);
        if (minutes < 240) rec.setStatus(AttendanceStatus.HALF_DAY);
        return toRecordView(repo.save(rec));
    }

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public List<DayView> myRange(@RequestParam String from, @RequestParam String to) {
        Employee emp = currentEmployee();
        return repo.findByEmployeeIdAndDateBetweenOrderByDateAsc(emp.getId(),
                LocalDate.parse(from), LocalDate.parse(to))
                .stream().map(this::toDayView).toList();
    }

    @GetMapping("/me/summary")
    @Transactional(readOnly = true)
    public SummaryView mySummary(@RequestParam int year, @RequestParam int month) {
        Employee emp = currentEmployee();
        List<AttendanceRecord> recs = repo.findByEmployeeIdAndDateBetweenOrderByDateAsc(
            emp.getId(), LocalDate.of(year, month, 1), LocalDate.of(year, month, 1).withDayOfMonth(
                LocalDate.of(year, month, 1).lengthOfMonth()));
        return buildSummary(year, month, recs);
    }

    @GetMapping("/employee/{id}")
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public List<DayView> employeeRange(@PathVariable Long id,
                                        @RequestParam String from, @RequestParam String to) {
        return repo.findByEmployeeIdAndDateBetweenOrderByDateAsc(id,
                LocalDate.parse(from), LocalDate.parse(to))
                .stream().map(this::toDayView).toList();
    }

    @GetMapping("/team")
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public List<RecordView> team(@RequestParam String date) {
        UserAccount u = AuthPrincipal.current();
        if (u.getRole() == Role.ADMIN)
            return repo.findByDateOrderByEmployee_EmployeeCodeAsc(LocalDate.parse(date))
                       .stream().map(this::toRecordView).toList();
        if (u.getEmployee() == null) return List.of();
        return repo.findByEmployee_Manager_IdAndDateOrderByEmployee_EmployeeCodeAsc(
                u.getEmployee().getId(), LocalDate.parse(date))
                .stream().map(this::toRecordView).toList();
    }

    @GetMapping("/all")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ADMIN')")
    public List<RecordView> all(@RequestParam String date) {
        return repo.findByDateOrderByEmployee_EmployeeCodeAsc(LocalDate.parse(date))
                   .stream().map(this::toRecordView).toList();
    }

    private SummaryView buildSummary(int year, int month, List<AttendanceRecord> recs) {
        Map<AttendanceStatus, Long> counts = recs.stream()
            .collect(java.util.stream.Collectors.groupingBy(AttendanceRecord::getStatus,
                     java.util.stream.Collectors.counting()));
        int late = (int) recs.stream().filter(AttendanceRecord::isLate).count();
        return new SummaryView(year, month,
            counts.getOrDefault(AttendanceStatus.PRESENT, 0L).intValue(),
            counts.getOrDefault(AttendanceStatus.HALF_DAY, 0L).intValue(),
            counts.getOrDefault(AttendanceStatus.ABSENT, 0L).intValue(),
            counts.getOrDefault(AttendanceStatus.ON_LEAVE, 0L).intValue(),
            counts.getOrDefault(AttendanceStatus.HOLIDAY, 0L).intValue(),
            counts.getOrDefault(AttendanceStatus.WEEKEND, 0L).intValue(),
            late);
    }
}
