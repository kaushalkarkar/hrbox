package com.hrms.documents;

import com.hrms.domain.DocumentCategory;
import com.hrms.domain.Employee;
import com.hrms.domain.EmployeeDocument;
import com.hrms.domain.Role;
import com.hrms.domain.UserAccount;
import com.hrms.repo.EmployeeDocumentRepository;
import com.hrms.repo.EmployeeRepository;
import com.hrms.security.AuthPrincipal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private static final long MAX_BYTES = 15L * 1024 * 1024; // 15 MB per file

    private final EmployeeDocumentRepository repo;
    private final EmployeeRepository employees;
    private final String uploadDir;

    public DocumentController(EmployeeDocumentRepository repo,
                              EmployeeRepository employees,
                              @Value("${hrms.uploads.dir:uploads}") String uploadDir) {
        this.repo = repo;
        this.employees = employees;
        this.uploadDir = uploadDir;
    }

    public record DocumentView(Long id, Long employeeId, String employeeCode, String employeeName,
                               String category, String filename, long sizeBytes, String contentType,
                               String description, String uploadedByName, String uploadedAt) {}

    private DocumentView toView(EmployeeDocument d) {
        Employee e = d.getEmployee();
        Employee by = d.getUploadedBy();
        return new DocumentView(
                d.getId(), e.getId(), e.getEmployeeCode(),
                e.getFirstName() + " " + e.getLastName(),
                d.getCategory().name(),
                d.getOriginalFilename(),
                d.getSizeBytes(),
                d.getContentType(),
                d.getDescription(),
                by == null ? null : by.getFirstName() + " " + by.getLastName(),
                d.getUploadedAt().toString()
        );
    }

    /* ===== List ===== */

    @GetMapping("/me")
    public List<DocumentView> myDocs() {
        return repo.findByEmployeeIdOrderByUploadedAtDesc(currentEmployee().getId())
                .stream().map(this::toView).toList();
    }

    @GetMapping("/employee/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public List<DocumentView> employeeDocs(@PathVariable Long id) {
        return repo.findByEmployeeIdOrderByUploadedAtDesc(id).stream().map(this::toView).toList();
    }

    /* ===== Upload ===== */

    @PostMapping(value = "/me", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentView uploadMine(@RequestParam("file") MultipartFile file,
                                   @RequestParam("category") String category,
                                   @RequestParam(value = "description", required = false) String description) {
        return doUpload(currentEmployee().getId(), file, category, description);
    }

    @PostMapping(value = "/employee/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public DocumentView uploadFor(@PathVariable Long id,
                                  @RequestParam("file") MultipartFile file,
                                  @RequestParam("category") String category,
                                  @RequestParam(value = "description", required = false) String description) {
        return doUpload(id, file, category, description);
    }

    private DocumentView doUpload(Long employeeId, MultipartFile file, String category, String description) {
        if (file == null || file.isEmpty())
            throw new ResponseStatusException(BAD_REQUEST, "Empty file");
        if (file.getSize() > MAX_BYTES)
            throw new ResponseStatusException(PAYLOAD_TOO_LARGE, "File exceeds " + (MAX_BYTES / (1024 * 1024)) + " MB");

        DocumentCategory cat;
        try { cat = DocumentCategory.valueOf(category.toUpperCase()); }
        catch (Exception ex) { throw new ResponseStatusException(BAD_REQUEST, "Invalid category"); }

        Employee emp = employees.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Employee not found"));

        // Persist file to uploads/documents/{employeeId}/
        Path dir = Paths.get(uploadDir, "documents", String.valueOf(employeeId));
        try {
            Files.createDirectories(dir);
        } catch (IOException ex) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Cannot create upload directory");
        }

        String originalName = file.getOriginalFilename() == null ? "upload" : file.getOriginalFilename();
        String safeName = originalName.replaceAll("[^a-zA-Z0-9._-]", "_");
        String storedName = UUID.randomUUID() + "_" + safeName;
        Path target = dir.resolve(storedName);
        try {
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new ResponseStatusException(INTERNAL_SERVER_ERROR, "Failed to store file");
        }

        UserAccount user = AuthPrincipal.current();
        Employee by = user.getEmployee();

        EmployeeDocument doc = EmployeeDocument.builder()
                .employee(emp)
                .uploadedBy(by)
                .category(cat)
                .originalFilename(originalName)
                .storedFilename(storedName)
                .sizeBytes(file.getSize())
                .contentType(file.getContentType() == null ? "application/octet-stream" : file.getContentType())
                .description(description)
                .uploadedAt(Instant.now())
                .build();
        return toView(repo.save(doc));
    }

    /* ===== Download ===== */

    @GetMapping("/{docId}/file")
    public ResponseEntity<FileSystemResource> download(@PathVariable Long docId) {
        EmployeeDocument d = repo.findById(docId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Document not found"));
        ensureCanRead(d);

        Path p = Paths.get(uploadDir, "documents", String.valueOf(d.getEmployee().getId()), d.getStoredFilename());
        if (!Files.exists(p))
            throw new ResponseStatusException(NOT_FOUND, "File missing on disk");

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(d.getContentType()))
                .header("Content-Disposition", "attachment; filename=\"" + d.getOriginalFilename().replace("\"", "") + "\"")
                .body(new FileSystemResource(p.toFile()));
    }

    /* ===== Delete ===== */

    @DeleteMapping("/{docId}")
    public ResponseEntity<Void> delete(@PathVariable Long docId) {
        EmployeeDocument d = repo.findById(docId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Document not found"));
        ensureCanModify(d);

        Path p = Paths.get(uploadDir, "documents", String.valueOf(d.getEmployee().getId()), d.getStoredFilename());
        try { Files.deleteIfExists(p); } catch (IOException ignored) {}
        repo.delete(d);
        return ResponseEntity.noContent().build();
    }

    /* ===== Permissions ===== */

    private void ensureCanRead(EmployeeDocument d) {
        UserAccount user = AuthPrincipal.current();
        if (user.getRole() == Role.ADMIN) return;
        Long me = user.getEmployee() == null ? null : user.getEmployee().getId();
        if (me != null && me.equals(d.getEmployee().getId())) return;
        if (user.getRole() == Role.MANAGER && me != null && d.getEmployee().getManager() != null
                && me.equals(d.getEmployee().getManager().getId())) return;
        throw new ResponseStatusException(FORBIDDEN, "Not allowed");
    }

    private void ensureCanModify(EmployeeDocument d) {
        UserAccount user = AuthPrincipal.current();
        if (user.getRole() == Role.ADMIN) return;
        Long me = user.getEmployee() == null ? null : user.getEmployee().getId();
        // Employee can delete their own uploads; manager can delete docs for their direct reports.
        if (me != null && me.equals(d.getEmployee().getId())) return;
        if (user.getRole() == Role.MANAGER && me != null && d.getEmployee().getManager() != null
                && me.equals(d.getEmployee().getManager().getId())) return;
        throw new ResponseStatusException(FORBIDDEN, "Not allowed");
    }

    private Employee currentEmployee() {
        UserAccount u = AuthPrincipal.current();
        if (u.getEmployee() == null)
            throw new ResponseStatusException(BAD_REQUEST, "User not linked to an employee");
        return u.getEmployee();
    }
}
