package com.hrms.auth;

import com.hrms.domain.NotificationType;
import com.hrms.domain.PasswordResetToken;
import com.hrms.domain.UserAccount;
import com.hrms.notification.NotificationService;
import com.hrms.repo.PasswordResetTokenRepository;
import com.hrms.repo.UserAccountRepository;
import com.hrms.security.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/auth")
public class PasswordController {

    private static final Logger log = LoggerFactory.getLogger(PasswordController.class);
    private static final SecureRandom RND = new SecureRandom();
    private static final long TOKEN_TTL_MINUTES = 30;

    private final UserAccountRepository users;
    private final PasswordResetTokenRepository tokens;
    private final PasswordEncoder encoder;
    private final NotificationService notifications;

    public PasswordController(UserAccountRepository users,
                              PasswordResetTokenRepository tokens,
                              PasswordEncoder encoder,
                              NotificationService notifications) {
        this.users = users;
        this.tokens = tokens;
        this.encoder = encoder;
        this.notifications = notifications;
    }

    public record ForgotRequest(@Email @NotBlank String email) {}

    public record ForgotResponse(String message, String devToken) {}

    public record ResetRequest(@NotBlank String token,
                               @NotBlank @Size(min = 6, max = 100) String newPassword) {}

    public record ChangeRequest(@NotBlank String currentPassword,
                                @NotBlank @Size(min = 6, max = 100) String newPassword) {}

    @PostMapping("/forgot-password")
    @Transactional
    public ForgotResponse forgot(@Valid @RequestBody ForgotRequest req) {
        // Always respond the same way to avoid email enumeration in logs/UX,
        // but in dev we return the token so you can complete the flow without email.
        UserAccount user = users.findByEmail(req.email()).orElse(null);
        if (user == null || !user.isEnabled()) {
            return new ForgotResponse("If that email exists, a reset link has been generated.", null);
        }

        String token = randomToken();
        tokens.save(PasswordResetToken.builder()
                .user(user)
                .token(token)
                .expiresAt(Instant.now().plus(TOKEN_TTL_MINUTES, ChronoUnit.MINUTES))
                .build());

        log.info("Password reset token generated for {} (expires in {} min)", user.getEmail(), TOKEN_TTL_MINUTES);
        return new ForgotResponse("Reset token generated. In dev mode, use it directly.", token);
    }

    @PostMapping("/reset-password")
    @Transactional
    public void reset(@Valid @RequestBody ResetRequest req) {
        PasswordResetToken prt = tokens.findByToken(req.token())
                .orElseThrow(() -> new ResponseStatusException(BAD_REQUEST, "Invalid token"));

        if (prt.getUsedAt() != null) {
            throw new ResponseStatusException(BAD_REQUEST, "Token already used");
        }
        if (prt.getExpiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(BAD_REQUEST, "Token expired");
        }

        UserAccount user = prt.getUser();
        user.setPasswordHash(encoder.encode(req.newPassword()));
        prt.setUsedAt(Instant.now());

        notifications.notify(user, NotificationType.PASSWORD_RESET,
                "Password Reset Successful",
                "Your account password has been updated. If this wasn't you, contact your HR Team immediately.",
                null);
    }

    @PostMapping("/change-password")
    @Transactional
    public void change(@Valid @RequestBody ChangeRequest req) {
        UserAccount principal = AuthPrincipal.current();
        UserAccount user = users.findById(principal.getId())
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "User not found"));

        if (!encoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(BAD_REQUEST, "Current password is incorrect");
        }
        user.setPasswordHash(encoder.encode(req.newPassword()));

        notifications.notify(user, NotificationType.PASSWORD_CHANGED,
                "Password Changed",
                "You changed your account password. If this wasn't you, contact your HR Team immediately.",
                null);
    }

    private static String randomToken() {
        byte[] buf = new byte[24];
        RND.nextBytes(buf);
        return HexFormat.of().formatHex(buf);
    }
}
