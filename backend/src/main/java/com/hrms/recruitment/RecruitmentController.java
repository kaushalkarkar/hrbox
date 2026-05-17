package com.hrms.recruitment;

import com.hrms.domain.*;
import com.hrms.notification.NotificationService;
import com.hrms.repo.*;
import com.hrms.security.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/recruitment")
@Transactional
public class RecruitmentController {

    private final JobRepository jobs;
    private final CandidateRepository candidates;
    private final JobApplicationRepository apps;
    private final DepartmentRepository departments;
    private final EmployeeRepository employees;
    private final NotificationService notifications;

    public RecruitmentController(JobRepository jobs,
                                 CandidateRepository candidates,
                                 JobApplicationRepository apps,
                                 DepartmentRepository departments,
                                 EmployeeRepository employees,
                                 NotificationService notifications) {
        this.jobs = jobs;
        this.candidates = candidates;
        this.apps = apps;
        this.departments = departments;
        this.employees = employees;
        this.notifications = notifications;
    }

    /* ===== DTOs ===== */

    public record JobView(Long id, String title, Long departmentId, String departmentName,
                          String location, String employmentType, String description,
                          int minExperienceYears, int openings, String status,
                          String postedByName, String postedOn, String closedOn,
                          long applicantCount, Map<String, Long> stageCounts) {}

    public record JobRequest(@NotBlank @Size(max = 200) String title,
                              Long departmentId,
                              @Size(max = 120) String location,
                              @NotBlank String employmentType,
                              String description,
                              @Min(0) Integer minExperienceYears,
                              @Min(1) Integer openings,
                              String status) {}

    public record CandidateView(Long id, String firstName, String lastName,
                                String email, String phone, String currentCompany,
                                Integer yearsOfExperience, String source,
                                String referrerName, String resumeFilename,
                                String notes, String createdAt) {}

    public record CandidateRequest(@NotBlank @Size(max = 80) String firstName,
                                   @NotBlank @Size(max = 80) String lastName,
                                   @NotBlank @Email @Size(max = 120) String email,
                                   @Size(max = 20) String phone,
                                   @Size(max = 120) String currentCompany,
                                   @Min(0) Integer yearsOfExperience,
                                   @Size(max = 24) String source,
                                   Long referrerId,
                                   String notes) {}

    public record ApplicationView(Long id, Long candidateId, String candidateName, String candidateEmail,
                                  Long jobId, String jobTitle,
                                  String stage, String latestNote,
                                  String lastMovedByName,
                                  String appliedAt, String lastStageChangeAt) {}

    public record ApplyRequest(@NotNull Long candidateId, @NotNull Long jobId) {}
    public record StageRequest(@NotBlank String stage, @Size(max = 1000) String note) {}

    /* ===== Views ===== */

    private JobView toJobView(Job j) {
        long total = apps.countByJobId(j.getId());
        Map<String, Long> stages = new LinkedHashMap<>();
        for (ApplicationStage s : ApplicationStage.values()) {
            stages.put(s.name(), apps.countByJobIdAndStage(j.getId(), s));
        }
        return new JobView(
                j.getId(), j.getTitle(),
                j.getDepartment() == null ? null : j.getDepartment().getId(),
                j.getDepartment() == null ? null : j.getDepartment().getName(),
                j.getLocation(), j.getEmploymentType().name(),
                j.getDescription(),
                j.getMinExperienceYears(), j.getOpenings(),
                j.getStatus().name(),
                j.getPostedBy() == null ? null : j.getPostedBy().getFirstName() + " " + j.getPostedBy().getLastName(),
                j.getPostedOn() == null ? null : j.getPostedOn().toString(),
                j.getClosedOn() == null ? null : j.getClosedOn().toString(),
                total, stages
        );
    }

    private CandidateView toCandidateView(Candidate c) {
        return new CandidateView(
                c.getId(), c.getFirstName(), c.getLastName(),
                c.getEmail(), c.getPhone(), c.getCurrentCompany(),
                c.getYearsOfExperience(), c.getSource(),
                c.getReferrer() == null ? null : c.getReferrer().getFirstName() + " " + c.getReferrer().getLastName(),
                c.getResumeFilename(), c.getNotes(),
                c.getCreatedAt().toString()
        );
    }

    private ApplicationView toAppView(JobApplication a) {
        Candidate c = a.getCandidate();
        Job j = a.getJob();
        return new ApplicationView(
                a.getId(),
                c.getId(), c.getFirstName() + " " + c.getLastName(), c.getEmail(),
                j.getId(), j.getTitle(),
                a.getStage().name(), a.getLatestNote(),
                a.getLastMovedBy() == null ? null : a.getLastMovedBy().getFirstName() + " " + a.getLastMovedBy().getLastName(),
                a.getAppliedAt().toString(),
                a.getLastStageChangeAt() == null ? null : a.getLastStageChangeAt().toString()
        );
    }

    /* ===== Jobs ===== */

    @GetMapping("/jobs")
    @Transactional(readOnly = true)
    public List<JobView> listJobs(@RequestParam(required = false) String status) {
        List<Job> list;
        if (status != null && !status.isBlank()) {
            try {
                list = jobs.findByStatusOrderByCreatedAtDesc(JobStatus.valueOf(status));
            } catch (Exception ex) {
                list = jobs.findAllByOrderByCreatedAtDesc();
            }
        } else {
            list = jobs.findAllByOrderByCreatedAtDesc();
        }
        return list.stream().map(this::toJobView).toList();
    }

    @GetMapping("/jobs/{id}")
    @Transactional(readOnly = true)
    public JobView getJob(@PathVariable Long id) {
        return toJobView(jobs.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Job not found")));
    }

    @PostMapping("/jobs")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public JobView createJob(@Valid @RequestBody JobRequest req) {
        Job j = applyJob(new Job(), req);
        UserAccount user = AuthPrincipal.current();
        j.setPostedBy(user.getEmployee());
        return toJobView(jobs.save(j));
    }

    @PutMapping("/jobs/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public JobView updateJob(@PathVariable Long id, @Valid @RequestBody JobRequest req) {
        Job j = jobs.findById(id).orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Job not found"));
        applyJob(j, req);
        return toJobView(j);
    }

    private Job applyJob(Job j, JobRequest req) {
        j.setTitle(req.title());
        j.setLocation(req.location());
        j.setDescription(req.description());
        j.setMinExperienceYears(req.minExperienceYears() == null ? 0 : req.minExperienceYears());
        j.setOpenings(req.openings() == null ? 1 : req.openings());
        try { j.setEmploymentType(EmploymentType.valueOf(req.employmentType())); }
        catch (Exception ex) { throw new ResponseStatusException(BAD_REQUEST, "Invalid employmentType"); }
        if (req.status() != null && !req.status().isBlank()) {
            try {
                JobStatus s = JobStatus.valueOf(req.status());
                JobStatus prev = j.getStatus();
                j.setStatus(s);
                if (s == JobStatus.CLOSED && prev != JobStatus.CLOSED) j.setClosedOn(LocalDate.now());
                if (s != JobStatus.CLOSED) j.setClosedOn(null);
            } catch (Exception ex) { throw new ResponseStatusException(BAD_REQUEST, "Invalid status"); }
        }
        if (req.departmentId() != null) {
            j.setDepartment(departments.findById(req.departmentId())
                    .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Unknown department")));
        } else j.setDepartment(null);
        return j;
    }

    @DeleteMapping("/jobs/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteJob(@PathVariable Long id) {
        if (!jobs.existsById(id)) throw new ResponseStatusException(NOT_FOUND, "Job not found");
        // Cascading apps would need explicit handling — for the demo we just refuse if any exist
        if (apps.countByJobId(id) > 0)
            throw new ResponseStatusException(CONFLICT, "Cannot delete a job with applications");
        jobs.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /* ===== Candidates ===== */

    @GetMapping("/candidates")
    @Transactional(readOnly = true)
    public List<CandidateView> listCandidates(@RequestParam(required = false) String q) {
        List<Candidate> list = (q == null || q.isBlank())
                ? candidates.findAllByOrderByCreatedAtDesc()
                : candidates.search(q);
        return list.stream().map(this::toCandidateView).toList();
    }

    @GetMapping("/candidates/{id}")
    @Transactional(readOnly = true)
    public CandidateView getCandidate(@PathVariable Long id) {
        return toCandidateView(candidates.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Candidate not found")));
    }

    @PostMapping("/candidates")
    public CandidateView createCandidate(@Valid @RequestBody CandidateRequest req) {
        if (candidates.existsByEmail(req.email()))
            throw new ResponseStatusException(CONFLICT, "A candidate with this email already exists");

        UserAccount user = AuthPrincipal.current();
        Employee referrer = req.referrerId() != null
                ? employees.findById(req.referrerId()).orElse(null)
                : user.getEmployee();

        Candidate c = Candidate.builder()
                .firstName(req.firstName()).lastName(req.lastName())
                .email(req.email()).phone(req.phone())
                .currentCompany(req.currentCompany())
                .yearsOfExperience(req.yearsOfExperience())
                .source(req.source() == null ? "WEBSITE" : req.source())
                .referrer(referrer)
                .notes(req.notes())
                .build();
        return toCandidateView(candidates.save(c));
    }

    @PutMapping("/candidates/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public CandidateView updateCandidate(@PathVariable Long id, @Valid @RequestBody CandidateRequest req) {
        Candidate c = candidates.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Candidate not found"));
        if (!c.getEmail().equalsIgnoreCase(req.email()) && candidates.existsByEmail(req.email()))
            throw new ResponseStatusException(CONFLICT, "Email already in use by another candidate");
        c.setFirstName(req.firstName()); c.setLastName(req.lastName());
        c.setEmail(req.email()); c.setPhone(req.phone());
        c.setCurrentCompany(req.currentCompany());
        c.setYearsOfExperience(req.yearsOfExperience());
        if (req.source() != null) c.setSource(req.source());
        if (req.referrerId() != null) {
            c.setReferrer(employees.findById(req.referrerId()).orElse(null));
        }
        c.setNotes(req.notes());
        return toCandidateView(c);
    }

    @DeleteMapping("/candidates/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteCandidate(@PathVariable Long id) {
        Candidate c = candidates.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Candidate not found"));
        if (!apps.findByCandidateIdOrderByAppliedAtDesc(id).isEmpty())
            throw new ResponseStatusException(CONFLICT, "Cannot delete a candidate with applications");
        candidates.delete(c);
        return ResponseEntity.noContent().build();
    }

    /* ===== Applications ===== */

    @GetMapping("/applications/by-job/{jobId}")
    @Transactional(readOnly = true)
    public List<ApplicationView> applicationsByJob(@PathVariable Long jobId) {
        return apps.findByJobIdOrderByAppliedAtDesc(jobId).stream().map(this::toAppView).toList();
    }

    @GetMapping("/applications/by-candidate/{candidateId}")
    @Transactional(readOnly = true)
    public List<ApplicationView> applicationsByCandidate(@PathVariable Long candidateId) {
        return apps.findByCandidateIdOrderByAppliedAtDesc(candidateId).stream().map(this::toAppView).toList();
    }

    @GetMapping("/pipeline")
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public Map<String, List<ApplicationView>> pipeline() {
        Map<String, List<ApplicationView>> out = new LinkedHashMap<>();
        for (ApplicationStage s : ApplicationStage.values()) {
            out.put(s.name(), apps.findByStageOrderByLastStageChangeAtDesc(s).stream().map(this::toAppView).toList());
        }
        return out;
    }

    @PostMapping("/applications")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApplicationView applyCandidateToJob(@Valid @RequestBody ApplyRequest req) {
        if (apps.findByCandidateIdAndJobId(req.candidateId(), req.jobId()).isPresent())
            throw new ResponseStatusException(CONFLICT, "Candidate already linked to this job");

        Candidate c = candidates.findById(req.candidateId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Candidate not found"));
        Job j = jobs.findById(req.jobId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Job not found"));

        JobApplication a = JobApplication.builder()
                .candidate(c).job(j)
                .stage(ApplicationStage.APPLIED)
                .build();
        return toAppView(apps.save(a));
    }

    @PutMapping("/applications/{id}/stage")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ApplicationView moveStage(@PathVariable Long id, @Valid @RequestBody StageRequest req) {
        JobApplication a = apps.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Application not found"));
        ApplicationStage stage;
        try { stage = ApplicationStage.valueOf(req.stage()); }
        catch (Exception ex) { throw new ResponseStatusException(BAD_REQUEST, "Invalid stage"); }

        ApplicationStage prev = a.getStage();
        if (prev == stage && (req.note() == null || req.note().isBlank())) {
            return toAppView(a); // no-op
        }
        a.setStage(stage);
        if (req.note() != null && !req.note().isBlank()) a.setLatestNote(req.note());
        a.setLastStageChangeAt(Instant.now());
        UserAccount user = AuthPrincipal.current();
        a.setLastMovedBy(user.getEmployee());

        // Notify the candidate's referrer if there is one and it's a milestone stage
        if (a.getCandidate().getReferrer() != null
                && (stage == ApplicationStage.OFFER || stage == ApplicationStage.HIRED || stage == ApplicationStage.REJECTED)) {
            notifications.notifyByEmail(
                    a.getCandidate().getReferrer().getEmail(),
                    NotificationType.GENERIC,
                    "Candidate " + a.getCandidate().getFirstName() + " moved to " + stage.name(),
                    "Job: " + a.getJob().getTitle() +
                            (req.note() == null || req.note().isBlank() ? "" : " · " + req.note()),
                    "/recruitment"
            );
        }
        return toAppView(a);
    }

    @DeleteMapping("/applications/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<Void> deleteApplication(@PathVariable Long id) {
        if (!apps.existsById(id)) throw new ResponseStatusException(NOT_FOUND, "Application not found");
        apps.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
