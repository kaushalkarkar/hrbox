package com.hrms.notification;

import com.hrms.domain.AppNotification;
import com.hrms.repo.NotificationRepository;
import com.hrms.security.AuthPrincipal;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/notifications")
@Transactional
public class NotificationController {

    private final NotificationRepository repo;

    public NotificationController(NotificationRepository repo) {
        this.repo = repo;
    }

    public record NotifView(Long id, String type, String title, String message,
                             String link, String createdAt, String readAt) {}

    private NotifView toView(AppNotification n) {
        return new NotifView(n.getId(), n.getType().name(), n.getTitle(), n.getMessage(),
            n.getLink(), n.getCreatedAt().toString(),
            n.getReadAt() != null ? n.getReadAt().toString() : null);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<NotifView> list(@RequestParam(defaultValue = "20") int limit) {
        Long uid = AuthPrincipal.current().getId();
        return repo.findByUserIdOrderByCreatedAtDesc(uid, PageRequest.of(0, limit))
                   .stream().map(this::toView).toList();
    }

    @GetMapping("/unread-count")
    @Transactional(readOnly = true)
    public Map<String, Long> unreadCount() {
        return Map.of("count", repo.countByUserIdAndReadAtIsNull(AuthPrincipal.current().getId()));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long id) {
        Long uid = AuthPrincipal.current().getId();
        AppNotification n = repo.findById(id)
            .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Notification not found"));
        if (!n.getUser().getId().equals(uid))
            throw new ResponseStatusException(NOT_FOUND, "Notification not found");
        if (n.getReadAt() == null) { n.setReadAt(Instant.now()); repo.save(n); }
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllRead() {
        repo.markAllReadForUser(AuthPrincipal.current().getId());
        return ResponseEntity.noContent().build();
    }
}
