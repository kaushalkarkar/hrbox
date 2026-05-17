package com.hrms.holiday;

import com.hrms.domain.Holiday;
import com.hrms.repo.HolidayRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/holidays")
@Transactional
public class HolidayController {

    private final HolidayRepository repo;

    public HolidayController(HolidayRepository repo) { this.repo = repo; }

    public record HolidayView(Long id, String date, String name, String description) {}
    public record HolidayPayload(@NotBlank String date, @NotBlank String name, String description) {}

    private HolidayView toView(Holiday h) {
        return new HolidayView(h.getId(), h.getDate().toString(), h.getName(), h.getDescription());
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<HolidayView> list(@RequestParam(required = false) Integer year) {
        if (year == null) year = LocalDate.now().getYear();
        return repo.findByDateBetweenOrderByDateAsc(LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31))
                   .stream().map(this::toView).toList();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<HolidayView> create(@Valid @RequestBody HolidayPayload req) {
        LocalDate date = LocalDate.parse(req.date());
        if (repo.existsByDate(date)) throw new ResponseStatusException(CONFLICT, "Holiday already exists for this date");
        return ResponseEntity.status(CREATED).body(toView(repo.save(
            Holiday.builder().date(date).name(req.name()).description(req.description()).build())));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public HolidayView update(@PathVariable Long id, @Valid @RequestBody HolidayPayload req) {
        Holiday h = repo.findById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Holiday not found"));
        h.setDate(LocalDate.parse(req.date()));
        h.setName(req.name());
        h.setDescription(req.description());
        return toView(repo.save(h));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!repo.existsById(id)) throw new ResponseStatusException(NOT_FOUND, "Holiday not found");
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
