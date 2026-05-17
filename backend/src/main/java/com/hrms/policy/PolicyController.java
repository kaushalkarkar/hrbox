package com.hrms.policy;

import com.hrms.domain.Employee;
import com.hrms.domain.Policy;
import com.hrms.domain.PolicyAck;
import com.hrms.domain.PolicyCategory;
import com.hrms.domain.UserAccount;
import com.hrms.repo.PolicyAckRepository;
import com.hrms.repo.PolicyRepository;
import com.hrms.security.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/policies")
@Transactional
public class PolicyController {

    private final PolicyRepository policies;
    private final PolicyAckRepository acks;

    public PolicyController(PolicyRepository policies, PolicyAckRepository acks) {
        this.policies = policies;
        this.acks = acks;
    }

    public record PolicyView(Long id, String title, String category, String summary,
                              String contentMarkdown, String version,
                              String effectiveFrom, String ownerName,
                              String createdAt, String updatedAt,
                              boolean acknowledged, String acknowledgedAt,
                              long ackCount) {}

    public record PolicySummary(Long id, String title, String category, String summary,
                                 String version, String effectiveFrom,
                                 boolean acknowledged) {}

    public record PolicyRequest(@NotBlank @Size(max = 200) String title,
                                 @NotBlank String category,
                                 @Size(max = 500) String summary,
                                 @NotBlank String contentMarkdown,
                                 @NotBlank @Size(max = 16) String version,
                                 LocalDate effectiveFrom) {}

    /* ===== List ===== */

    @GetMapping
    @Transactional(readOnly = true)
    public List<PolicySummary> list(@RequestParam(required = false) String category) {
        List<Policy> ps;
        if (category != null && !category.isBlank()) {
            try {
                ps = policies.findByCategoryOrderByTitleAsc(PolicyCategory.valueOf(category));
            } catch (Exception ex) {
                ps = policies.findAllByOrderByCategoryAscTitleAsc();
            }
        } else {
            ps = policies.findAllByOrderByCategoryAscTitleAsc();
        }

        Long meId = currentEmployeeId();
        Set<Long> ackedPolicyIds = meId == null
                ? Set.of()
                : acks.findByEmployeeId(meId).stream().map(a -> a.getPolicy().getId()).collect(Collectors.toSet());

        return ps.stream().map(p -> new PolicySummary(
                p.getId(), p.getTitle(), p.getCategory().name(), p.getSummary(),
                p.getVersion(), p.getEffectiveFrom().toString(),
                ackedPolicyIds.contains(p.getId())
        )).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public PolicyView get(@PathVariable Long id) {
        Policy p = policies.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Policy not found"));

        Long meId = currentEmployeeId();
        var ack = meId == null
                ? java.util.Optional.<PolicyAck>empty()
                : acks.findByPolicyIdAndEmployeeId(id, meId);

        long ackCount = acks.countByPolicyId(id);

        return new PolicyView(
                p.getId(), p.getTitle(), p.getCategory().name(), p.getSummary(),
                p.getContentMarkdown(), p.getVersion(),
                p.getEffectiveFrom().toString(),
                p.getOwner() == null ? null : p.getOwner().getFirstName() + " " + p.getOwner().getLastName(),
                p.getCreatedAt().toString(),
                p.getUpdatedAt() == null ? null : p.getUpdatedAt().toString(),
                ack.isPresent(),
                ack.map(a -> a.getAcknowledgedAt().toString()).orElse(null),
                ackCount
        );
    }

    @GetMapping("/categories")
    @Transactional(readOnly = true)
    public Map<String, Long> categoryCounts() {
        var byCategory = policies.findAll().stream()
                .collect(Collectors.groupingBy(p -> p.getCategory().name(), Collectors.counting()));
        // Ensure all categories show up even when empty
        for (PolicyCategory c : PolicyCategory.values()) byCategory.putIfAbsent(c.name(), 0L);
        return byCategory;
    }

    /* ===== Mutate (admin only) ===== */

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public PolicyView create(@Valid @RequestBody PolicyRequest req) {
        PolicyCategory cat;
        try { cat = PolicyCategory.valueOf(req.category()); }
        catch (Exception ex) { throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid category"); }

        UserAccount user = AuthPrincipal.current();
        Employee owner = user.getEmployee();

        Policy p = Policy.builder()
                .title(req.title()).category(cat)
                .summary(req.summary())
                .contentMarkdown(req.contentMarkdown())
                .version(req.version())
                .effectiveFrom(req.effectiveFrom() == null ? LocalDate.now() : req.effectiveFrom())
                .owner(owner)
                .build();
        return get(policies.save(p).getId());
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public PolicyView update(@PathVariable Long id, @Valid @RequestBody PolicyRequest req) {
        Policy p = policies.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Policy not found"));
        PolicyCategory cat;
        try { cat = PolicyCategory.valueOf(req.category()); }
        catch (Exception ex) { throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Invalid category"); }

        p.setTitle(req.title());
        p.setCategory(cat);
        p.setSummary(req.summary());
        p.setContentMarkdown(req.contentMarkdown());
        p.setVersion(req.version());
        if (req.effectiveFrom() != null) p.setEffectiveFrom(req.effectiveFrom());
        return get(id);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!policies.existsById(id)) throw new ResponseStatusException(NOT_FOUND, "Policy not found");
        policies.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    /* ===== Acknowledge ===== */

    @PostMapping("/{id}/ack")
    public PolicyView acknowledge(@PathVariable Long id) {
        Policy p = policies.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Policy not found"));
        Long meId = currentEmployeeId();
        if (meId == null) throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "No employee linked");

        var existing = acks.findByPolicyIdAndEmployeeId(id, meId);
        if (existing.isPresent()) {
            // Update version + timestamp if the version differs (re-ack on revision)
            PolicyAck a = existing.get();
            a.setVersion(p.getVersion());
            a.setAcknowledgedAt(Instant.now());
        } else {
            UserAccount user = AuthPrincipal.current();
            acks.save(PolicyAck.builder()
                    .policy(p)
                    .employee(user.getEmployee())
                    .version(p.getVersion())
                    .acknowledgedAt(Instant.now())
                    .build());
        }
        return get(id);
    }

    private Long currentEmployeeId() {
        UserAccount u = AuthPrincipal.current();
        return u.getEmployee() == null ? null : u.getEmployee().getId();
    }
}
