package com.hrms.vibe;

import com.hrms.domain.*;
import com.hrms.notification.NotificationService;
import com.hrms.repo.*;
import com.hrms.security.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/vibe")
@Transactional
public class VibeController {

    private final PostRepository posts;
    private final PostCommentRepository comments;
    private final PostReactionRepository reactions;
    private final EmployeeRepository employees;
    private final NotificationService notifications;

    public VibeController(PostRepository posts,
                          PostCommentRepository comments,
                          PostReactionRepository reactions,
                          EmployeeRepository employees,
                          NotificationService notifications) {
        this.posts = posts;
        this.comments = comments;
        this.reactions = reactions;
        this.employees = employees;
        this.notifications = notifications;
    }

    /* ===== DTOs ===== */

    public record AuthorView(Long id, String name, String employeeCode, String designation,
                              String departmentName, String photoFilename) {}

    public record PostView(Long id, String category, String body, boolean pinned,
                            AuthorView author, AuthorView subject,
                            String createdAt,
                            int commentCount,
                            Map<String, Long> reactionCounts,
                            Set<String> myReactions) {}

    public record CommentView(Long id, AuthorView author, String body, String createdAt) {}

    public record PostDetailView(PostView post, List<CommentView> comments) {}

    public record CreatePostRequest(@NotBlank String category,
                                     @NotBlank @Size(max = 5000) String body,
                                     Long subjectEmployeeId,
                                     Boolean pinned) {}

    public record CommentRequest(@NotBlank @Size(max = 2000) String body) {}

    public record ReactRequest(@NotBlank String type) {}

    /* ===== Mappers ===== */

    private AuthorView toAuthor(Employee e) {
        if (e == null) return null;
        return new AuthorView(
                e.getId(),
                e.getFirstName() + " " + e.getLastName(),
                e.getEmployeeCode(),
                e.getDesignation(),
                e.getDepartment() == null ? null : e.getDepartment().getName(),
                e.getPhotoFilename()
        );
    }

    private PostView toPostView(Post p, Long myEmpId) {
        Map<String, Long> rxnCounts = new LinkedHashMap<>();
        Set<String> mine = new LinkedHashSet<>();
        for (ReactionType rt : ReactionType.values()) {
            rxnCounts.put(rt.name(), reactions.countByPostIdAndType(p.getId(), rt));
            if (myEmpId != null && reactions.findByPostIdAndEmployeeIdAndType(p.getId(), myEmpId, rt).isPresent()) {
                mine.add(rt.name());
            }
        }
        return new PostView(
                p.getId(), p.getCategory().name(), p.getBody(), p.isPinned(),
                toAuthor(p.getAuthor()),
                toAuthor(p.getSubject()),
                p.getCreatedAt().toString(),
                (int) comments.countByPostId(p.getId()),
                rxnCounts, mine
        );
    }

    private CommentView toCommentView(PostComment c) {
        return new CommentView(c.getId(), toAuthor(c.getAuthor()), c.getBody(), c.getCreatedAt().toString());
    }

    private Long currentEmployeeId() {
        UserAccount u = AuthPrincipal.current();
        return u.getEmployee() == null ? null : u.getEmployee().getId();
    }

    private Employee currentEmployeeOrThrow() {
        UserAccount u = AuthPrincipal.current();
        if (u.getEmployee() == null)
            throw new ResponseStatusException(BAD_REQUEST, "User not linked to an employee");
        // Reload via the repo so lazy proxies (department, manager) on the
        // returned Employee stay attached to the current transaction's session.
        return employees.findById(u.getEmployee().getId())
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Employee not found"));
    }

    /* ===== Feed ===== */

    @GetMapping("/posts")
    @Transactional(readOnly = true)
    public List<PostView> feed(@RequestParam(required = false) String category,
                                @RequestParam(defaultValue = "50") int limit) {
        var page = PageRequest.of(0, Math.max(1, Math.min(limit, 200)));
        Long meId = currentEmployeeId();
        List<Post> list;
        if (category != null && !category.isBlank()) {
            try { list = posts.findByCategoryOrderByPinnedDescCreatedAtDesc(PostCategory.valueOf(category), page); }
            catch (Exception ex) { list = posts.findAllByOrderByPinnedDescCreatedAtDesc(page); }
        } else {
            list = posts.findAllByOrderByPinnedDescCreatedAtDesc(page);
        }
        return list.stream().map(p -> toPostView(p, meId)).toList();
    }

    @GetMapping("/posts/{id}")
    @Transactional(readOnly = true)
    public PostDetailView getPost(@PathVariable Long id) {
        Post p = posts.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Post not found"));
        Long meId = currentEmployeeId();
        var cs = comments.findByPostIdOrderByCreatedAtAsc(id).stream().map(this::toCommentView).toList();
        return new PostDetailView(toPostView(p, meId), cs);
    }

    @PostMapping("/posts")
    public PostView createPost(@Valid @RequestBody CreatePostRequest req) {
        PostCategory cat;
        try { cat = PostCategory.valueOf(req.category()); }
        catch (Exception ex) { throw new ResponseStatusException(BAD_REQUEST, "Invalid category"); }

        Employee me = currentEmployeeOrThrow();

        // Only admins may pin
        boolean pin = Boolean.TRUE.equals(req.pinned()) &&
                AuthPrincipal.current().getRole() == Role.ADMIN;

        Employee subject = null;
        if (req.subjectEmployeeId() != null) {
            subject = employees.findById(req.subjectEmployeeId())
                    .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Unknown subject employee"));
        }

        Post p = Post.builder()
                .author(me)
                .category(cat)
                .body(req.body())
                .subject(subject)
                .pinned(pin)
                .build();
        Post saved = posts.save(p);

        // Notify the subject of a Kudos / Question
        if (subject != null && !subject.getId().equals(me.getId())) {
            String title = cat == PostCategory.KUDOS ? "You got kudos!"
                          : cat == PostCategory.QUESTION ? "A question for you on Vibe"
                          : "You were mentioned in a Vibe post";
            notifications.notifyByEmail(
                    subject.getEmail(),
                    NotificationType.GENERIC,
                    title,
                    me.getFirstName() + " " + me.getLastName() + ": " + truncate(req.body(), 120),
                    "/vibe"
            );
        }
        return toPostView(saved, me.getId());
    }

    @DeleteMapping("/posts/{id}")
    public ResponseEntity<Void> deletePost(@PathVariable Long id) {
        UserAccount user = AuthPrincipal.current();
        Post p = posts.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Post not found"));
        boolean isAuthor = user.getEmployee() != null && user.getEmployee().getId().equals(p.getAuthor().getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        if (!isAuthor && !isAdmin) throw new ResponseStatusException(FORBIDDEN, "Not allowed");
        // Wipe children first to avoid FK noise
        comments.findByPostIdOrderByCreatedAtAsc(id).forEach(c -> comments.delete(c));
        reactions.findByPostId(id).forEach(r -> reactions.delete(r));
        posts.delete(p);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/posts/{id}/pin")
    @PreAuthorize("hasRole('ADMIN')")
    public PostView togglePin(@PathVariable Long id) {
        Post p = posts.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Post not found"));
        p.setPinned(!p.isPinned());
        return toPostView(p, currentEmployeeId());
    }

    /* ===== Reactions ===== */

    @PostMapping("/posts/{id}/react")
    public PostView react(@PathVariable Long id, @Valid @RequestBody ReactRequest req) {
        Post p = posts.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Post not found"));
        ReactionType rt;
        try { rt = ReactionType.valueOf(req.type()); }
        catch (Exception ex) { throw new ResponseStatusException(BAD_REQUEST, "Invalid reaction type"); }

        Employee me = currentEmployeeOrThrow();
        var existing = reactions.findByPostIdAndEmployeeIdAndType(id, me.getId(), rt);
        if (existing.isPresent()) {
            reactions.delete(existing.get());     // toggle off
        } else {
            reactions.save(PostReaction.builder().post(p).employee(me).type(rt).build());
        }
        return toPostView(p, me.getId());
    }

    /* ===== Comments ===== */

    @PostMapping("/posts/{id}/comments")
    public CommentView addComment(@PathVariable Long id, @Valid @RequestBody CommentRequest req) {
        Post p = posts.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Post not found"));
        Employee me = currentEmployeeOrThrow();
        PostComment c = PostComment.builder().post(p).author(me).body(req.body()).build();
        PostComment saved = comments.save(c);

        // Notify post author when someone else comments
        if (!p.getAuthor().getId().equals(me.getId())) {
            notifications.notifyByEmail(
                    p.getAuthor().getEmail(),
                    NotificationType.GENERIC,
                    "New comment on your Vibe post",
                    me.getFirstName() + " " + me.getLastName() + ": " + truncate(req.body(), 120),
                    "/vibe"
            );
        }
        return toCommentView(saved);
    }

    @DeleteMapping("/comments/{id}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long id) {
        UserAccount user = AuthPrincipal.current();
        PostComment c = comments.findById(id)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Comment not found"));
        boolean isAuthor = user.getEmployee() != null && user.getEmployee().getId().equals(c.getAuthor().getId());
        boolean isAdmin = user.getRole() == Role.ADMIN;
        if (!isAuthor && !isAdmin) throw new ResponseStatusException(FORBIDDEN, "Not allowed");
        comments.delete(c);
        return ResponseEntity.noContent().build();
    }

    private static String truncate(String s, int n) {
        return s == null ? "" : (s.length() <= n ? s : s.substring(0, n) + "…");
    }
}
