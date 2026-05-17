package com.hrms.attendance;

import com.hrms.domain.*;
import com.hrms.repo.AttendanceRecordRepository;
import com.hrms.repo.HolidayRepository;
import com.hrms.repo.LeaveRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

import static org.springframework.http.HttpStatus.*;

@Service
@Transactional
public class AttendanceService {

    /** Cutoff after which an arrival is "late". */
    public static final LocalTime LATE_CUTOFF = LocalTime.of(9, 30);
    /** Less than this many minutes worked ??? half day. */
    public static final int HALF_DAY_THRESHOLD_MIN = 270; // 4h30m
    /** Standard working day in minutes (used for stats/UI only). */
    public static final int STANDARD_DAY_MIN = 540;       // 9h
    /** IST is the operating timezone for status determination. */
    public static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");

    private final AttendanceRecordRepository records;
    private final LeaveRequestRepository leaves;
    private final HolidayRepository holidays;

    public AttendanceService(AttendanceRecordRepository records,
                             LeaveRequestRepository leaves,
                             HolidayRepository holidays) {
        this.records = records;
        this.leaves = leaves;
        this.holidays = holidays;
    }

    public AttendanceRecord checkIn(Employee me) {
        LocalDate today = todayLocal();
        var existing = records.findByEmployeeIdAndDate(me.getId(), today);
        if (existing.isPresent() && existing.get().getCheckIn() != null) {
            throw new ResponseStatusException(CONFLICT, "Already checked in today");
        }

        Instant now = Instant.now();
        boolean late = now.atZone(ZONE).toLocalTime().isAfter(LATE_CUTOFF);

        AttendanceRecord rec = existing.orElseGet(() -> AttendanceRecord.builder()
                .employee(me).date(today).build());
        rec.setCheckIn(now);
        rec.setLate(late);
        rec.setStatus(AttendanceStatus.PRESENT);
        return existing.isPresent() ? rec : records.save(rec);
    }

    public AttendanceRecord checkOut(Employee me) {
        LocalDate today = todayLocal();
        AttendanceRecord rec = records.findByEmployeeIdAndDate(me.getId(), today)
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Not checked in today"));
        if (rec.getCheckIn() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Not checked in today");
        }
        if (rec.getCheckOut() != null) {
            throw new ResponseStatusException(CONFLICT, "Already checked out today");
        }
        Instant now = Instant.now();
        rec.setCheckOut(now);
        int mins = (int) ChronoUnit.MINUTES.between(rec.getCheckIn(), now);
        rec.setWorkingMinutes(mins);
        rec.setStatus(mins < HALF_DAY_THRESHOLD_MIN ? AttendanceStatus.HALF_DAY : AttendanceStatus.PRESENT);
        return rec;
    }

    @Transactional(readOnly = true)
    public Optional<AttendanceRecord> today(Employee me) {
        return records.findByEmployeeIdAndDate(me.getId(), todayLocal());
    }

    /**
     * Daily view of [from, to] for the given employee, filling missing days with
     * computed status (WEEKEND / ON_LEAVE / ABSENT / future = WEEKEND if Sat/Sun, else ABSENT for past).
     */
    @Transactional(readOnly = true)
    public List<AttendanceDto.DayView> daily(Employee employee, LocalDate from, LocalDate to) {
        if (to.isBefore(from)) throw new ResponseStatusException(BAD_REQUEST, "to < from");

        Map<LocalDate, AttendanceRecord> byDate = new HashMap<>();
        records.findByEmployeeIdAndDateBetweenOrderByDateAsc(employee.getId(), from, to)
                .forEach(r -> byDate.put(r.getDate(), r));

        // Pre-compute approved-leave coverage per date in range
        Set<LocalDate> onLeave = new HashSet<>();
        leaves.findByEmployeeIdOrderByCreatedAtDesc(employee.getId()).forEach(l -> {
            if (l.getStatus() != LeaveStatus.APPROVED) return;
            LocalDate s = max(l.getStartDate(), from);
            LocalDate e = min(l.getEndDate(),   to);
            if (s.isAfter(e)) return;
            for (LocalDate d = s; !d.isAfter(e); d = d.plusDays(1)) onLeave.add(d);
        });

        // Pre-compute holiday dates in range
        Map<LocalDate, String> holidayMap = new HashMap<>();
        holidays.findByDateBetweenOrderByDateAsc(from, to)
                .forEach(h -> holidayMap.put(h.getDate(), h.getName()));

        LocalDate today = todayLocal();
        List<AttendanceDto.DayView> out = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            AttendanceRecord r = byDate.get(d);
            if (r != null) {
                out.add(new AttendanceDto.DayView(
                        d, r.getStatus(), r.getCheckIn(), r.getCheckOut(),
                        r.isLate(), r.getWorkingMinutes(), holidayMap.get(d)));
                continue;
            }
            DayOfWeek dow = d.getDayOfWeek();
            if (dow == DayOfWeek.SATURDAY || dow == DayOfWeek.SUNDAY) {
                out.add(empty(d, AttendanceStatus.WEEKEND, null));
            } else if (holidayMap.containsKey(d)) {
                out.add(empty(d, AttendanceStatus.HOLIDAY, holidayMap.get(d)));
            } else if (onLeave.contains(d)) {
                out.add(empty(d, AttendanceStatus.ON_LEAVE, null));
            } else if (d.isAfter(today)) {
                out.add(empty(d, AttendanceStatus.ABSENT, "future"));
            } else {
                out.add(empty(d, AttendanceStatus.ABSENT, null));
            }
        }
        return out;
    }

    @Transactional(readOnly = true)
    public AttendanceDto.MonthSummary monthSummary(Employee employee, int year, int month) {
        LocalDate from = LocalDate.of(year, month, 1);
        LocalDate to = from.withDayOfMonth(from.lengthOfMonth());
        var days = daily(employee, from, to);

        int present = 0, half = 0, absent = 0, leave = 0, holiday = 0, weekend = 0, late = 0;
        for (var d : days) {
            switch (d.status()) {
                case PRESENT  -> { present++; if (d.late()) late++; }
                case HALF_DAY -> { half++;    if (d.late()) late++; }
                case ABSENT   -> { if (d.note() == null) absent++; } // skip future
                case ON_LEAVE -> leave++;
                case HOLIDAY  -> holiday++;
                case WEEKEND  -> weekend++;
            }
        }
        return new AttendanceDto.MonthSummary(year, month, present, half, absent, leave, holiday, weekend, late);
    }

    @Transactional(readOnly = true)
    public List<AttendanceRecord> dayForAll(LocalDate date) {
        return records.findByDateOrderByEmployee_FirstNameAsc(date);
    }

    @Transactional(readOnly = true)
    public List<AttendanceRecord> dayForTeam(Long managerId, LocalDate date) {
        return records.findByEmployee_Manager_IdAndDateOrderByEmployee_FirstNameAsc(managerId, date);
    }

    private static AttendanceDto.DayView empty(LocalDate d, AttendanceStatus s, String note) {
        return new AttendanceDto.DayView(d, s, null, null, false, null, note);
    }

    private static LocalDate max(LocalDate a, LocalDate b) { return a.isAfter(b) ? a : b; }
    private static LocalDate min(LocalDate a, LocalDate b) { return a.isBefore(b) ? a : b; }
    public static LocalDate todayLocal() { return LocalDate.now(ZONE); }
}
