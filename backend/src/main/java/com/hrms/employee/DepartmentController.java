package com.hrms.employee;

import com.hrms.domain.Department;
import com.hrms.repo.DepartmentRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.springframework.http.HttpStatus.CONFLICT;

@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    private final DepartmentRepository repo;

    public DepartmentController(DepartmentRepository repo) {
        this.repo = repo;
    }

    public record DepartmentView(Long id, String name) {}

    public record CreateDepartmentRequest(@NotBlank String name) {}

    @GetMapping
    public List<DepartmentView> list() {
        return repo.findAll().stream()
                .map(d -> new DepartmentView(d.getId(), d.getName()))
                .toList();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DepartmentView> create(@Valid @RequestBody CreateDepartmentRequest req) {
        if (repo.findByName(req.name()).isPresent()) {
            throw new ResponseStatusException(CONFLICT, "Department already exists");
        }
        Department saved = repo.save(Department.builder().name(req.name()).build());
        return ResponseEntity.ok(new DepartmentView(saved.getId(), saved.getName()));
    }
}
