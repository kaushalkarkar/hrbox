package com.hrms.employee;

import com.hrms.domain.*;
import com.hrms.notification.NotificationService;
import com.hrms.repo.*;
import com.hrms.security.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.List;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/employees")
@Transactional
public class EmployeeController {

    private final EmployeeRepository employees;
    private final UserAccountRepository users;
    private final DepartmentRepository departments;
    private final PasswordEncoder encoder;
    private final NotificationService notifService;

    @Value("${hrms.upload-dir:./uploads}")
    private String uploadDir;

    public EmployeeController(EmployeeRepository employees,
                               UserAccountRepository users,
                               DepartmentRepository departments,
                               PasswordEncoder encoder,
                               NotificationService notifService) {
        this.employees = employees;
        this.users = users;
        this.departments = departments;
        this.encoder = encoder;
        this.notifService = notifService;
    }

    // ---- DTOs ----
    public record EmployeeView(Long id, String employeeCode, String firstName, String lastName,
                                String email, String phone, String address, String designation,
                                Long departmentId, String departmentName,
                                Long managerId, String managerName,
                                String joinedOn, String photoFilename) {}

    public record CreateRequest(@NotBlank String firstName, @NotBlank String lastName,
                                 @Email @NotBlank String email,
                                 String phone, String address, String designation,
                                 Long departmentId, Long managerId,
                                 @NotBlank String joinedOn,
                                 @NotBlank String initialPassword,
                                 @NotNull Role role) {}

    public record UpdateRequest(@NotBlank String firstName, @NotBlank String lastName,
                                 @Email @NotBlank String email,
                                 String phone, String address, String designation,
                                 Long departmentId, Long managerId,
                                 @NotBlank String joinedOn) {}

    public record OrgNode(Long id, String employeeCode, String firstName, String lastName,
                           String designation, String departmentName, String photoFilename) {}

    public record OrgChart(List<OrgNode> chain, List<OrgNode> reports) {}

    // ---- Helpers ----
    private EmployeeView toView(Employee e) {
        return new EmployeeView(
            e.getId(), e.getEmployeeCode(), e.getFirstName(), e.getLastName(),
            e.getEmail(), e.getPhone(), e.getAddress(), e.getDesignation(),
            e.getDepartment() != null ? e.getDepartment().getId() : null,
            e.getDepartment() != null ? e.getDepartment().getName() : null,
            e.getManager() != null ? e.getManager().getId() : null,
            e.getManager() != null ? e.getManager().getFirstName() + " " + e.getManager().getLastName() : null,
            e.getJoinedOn().toString(),
            e.getPhotoFilename()
        );
    }

    private OrgNode toNode(Employee e) {
        return new OrgNode(e.getId(), e.getEmployeeCode(), e.getFirstName(), e.getLastName(),
            e.getDesignation(),
            e.getDepartment() != null ? e.getDepartment().getName() : null,
            e.getPhotoFilename());
    }

    private String nextEmployeeCode() {
        long count = employees.count();
        return String.format("EMP%03d", count + 1);
    }

    // ---- Endpoints ----

    @GetMapping
    @Transactional(readOnly = true)
    public List<EmployeeView> list(@RequestParam(required = false) Long departmentId,
                                    @RequestParam(required = false) String q) {
        return employees.search(departmentId, q != null && q.isBlank() ? null : q)
                        .stream().map(this::toView).toList();
    }

    @GetMapping("/me")
    @Transactional(readOnly = true)
    public EmployeeView me() {
        UserAccount u = AuthPrincipal.current();
        if (u.getEmployee() == null)
            throw new ResponseStatusException(NOT_FOUND, "No employee linked to this account");
        return toView(employees.findById(u.getEmployee().getId())
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found")));
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public EmployeeView getById(@PathVariable Long id) {
        return toView(employees.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found")));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EmployeeView> create(@Valid @RequestBody CreateRequest req) {
        if (employees.existsByEmail(req.email()))
            throw new ResponseStatusException(CONFLICT, "Email already in use");

        Department dept = req.departmentId() != null
            ? departments.findById(req.departmentId()).orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Department not found"))
            : null;
        Employee mgr = req.managerId() != null
            ? employees.findById(req.managerId()).orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Manager not found"))
            : null;

        Employee emp = Employee.builder()
            .employeeCode(nextEmployeeCode())
            .firstName(req.firstName())
            .lastName(req.lastName())
            .email(req.email())
            .phone(req.phone())
            .address(req.address())
            .designation(req.designation())
            .department(dept)
            .manager(mgr)
            .joinedOn(LocalDate.parse(req.joinedOn()))
            .active(true)
            .build();
        emp = employees.save(emp);

        // fix code after save to use actual ID
        emp.setEmployeeCode(String.format("EMP%03d", emp.getId()));
        emp = employees.save(emp);

        UserAccount account = UserAccount.builder()
            .email(req.email())
            .passwordHash(encoder.encode(req.initialPassword()))
            .role(req.role())
            .employee(emp)
            .enabled(true)
            .build();
        users.save(account);

        return ResponseEntity.status(CREATED).body(toView(emp));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public EmployeeView update(@PathVariable Long id, @Valid @RequestBody UpdateRequest req) {
        Employee emp = employees.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));

        Department dept = req.departmentId() != null
            ? departments.findById(req.departmentId()).orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Department not found"))
            : null;
        Employee mgr = req.managerId() != null
            ? employees.findById(req.managerId()).orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Manager not found"))
            : null;

        emp.setFirstName(req.firstName());
        emp.setLastName(req.lastName());
        emp.setEmail(req.email());
        emp.setPhone(req.phone());
        emp.setAddress(req.address());
        emp.setDesignation(req.designation());
        emp.setDepartment(dept);
        emp.setManager(mgr);
        emp.setJoinedOn(LocalDate.parse(req.joinedOn()));

        return toView(employees.save(emp));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        Employee emp = employees.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
        emp.setActive(false);
        employees.save(emp);
        users.findAll().stream()
            .filter(u -> u.getEmployee() != null && u.getEmployee().getId().equals(id))
            .forEach(u -> { u.setEnabled(false); users.save(u); });
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/photo")
    public ResponseEntity<?> uploadPhoto(@PathVariable Long id,
                                          @RequestParam("file") MultipartFile file) throws IOException {
        Employee emp = employees.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
        String ext = "";
        String orig = file.getOriginalFilename();
        if (orig != null && orig.contains(".")) ext = orig.substring(orig.lastIndexOf('.'));
        String filename = id + ext;
        Path dir = Paths.get(uploadDir, "photos");
        Files.createDirectories(dir);
        file.transferTo(dir.resolve(filename).toFile());
        emp.setPhotoFilename(filename);
        employees.save(emp);
        return ResponseEntity.ok(java.util.Map.of("filename", filename));
    }

    @DeleteMapping("/{id}/photo")
    public ResponseEntity<Void> deletePhoto(@PathVariable Long id) {
        Employee emp = employees.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
        if (emp.getPhotoFilename() != null) {
            new File(uploadDir + "/photos/" + emp.getPhotoFilename()).delete();
            emp.setPhotoFilename(null);
            employees.save(emp);
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/photo")
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> getPhoto(@PathVariable Long id) throws IOException {
        Employee emp = employees.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
        if (emp.getPhotoFilename() == null)
            throw new ResponseStatusException(NOT_FOUND, "No photo");
        Path path = Paths.get(uploadDir, "photos", emp.getPhotoFilename());
        if (!Files.exists(path)) throw new ResponseStatusException(NOT_FOUND, "Photo file missing");
        byte[] bytes = Files.readAllBytes(path);
        String ct = Files.probeContentType(path);
        if (ct == null) ct = "image/jpeg";
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(ct)).body(bytes);
    }

    @PostMapping("/{id}/reset-password")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> resetPassword(@PathVariable Long id,
                                               @RequestBody java.util.Map<String, String> body) {
        String newPassword = body.get("newPassword");
        if (newPassword == null || newPassword.isBlank())
            throw new ResponseStatusException(BAD_REQUEST, "newPassword required");
        Employee emp = employees.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));
        users.findAll().stream()
            .filter(u -> u.getEmployee() != null && u.getEmployee().getId().equals(emp.getId()))
            .forEach(u -> { u.setPasswordHash(encoder.encode(newPassword)); users.save(u); });
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/org-chart")
    @Transactional(readOnly = true)
    public OrgChart orgChart(@PathVariable Long id) {
        Employee emp = employees.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));

        // Build manager chain (up to root)
        java.util.List<OrgNode> chain = new java.util.ArrayList<>();
        Employee current = emp.getManager();
        int depth = 0;
        while (current != null && depth < 10) {
            chain.add(0, toNode(current));
            current = current.getManager();
            depth++;
        }

        // Direct reports
        List<OrgNode> reports = employees.findByManagerId(id)
            .stream().filter(Employee::isActive).map(this::toNode).toList();

        return new OrgChart(chain, reports);
    }
}
