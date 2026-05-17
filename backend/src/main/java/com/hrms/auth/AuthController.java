package com.hrms.auth;

import com.hrms.domain.*;
import com.hrms.repo.UserAccountRepository;
import com.hrms.security.AuthPrincipal;
import com.hrms.security.JwtService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import static org.springframework.http.HttpStatus.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserAccountRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthController(UserAccountRepository users, PasswordEncoder encoder, JwtService jwt) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
    }

    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {}
    public record EmployeeSummary(Long id, String employeeCode, String firstName, String lastName) {}
    public record LoginResponse(String token, Long userId, String email, String role, EmployeeSummary employee) {}

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        UserAccount user = users.findByEmail(req.email())
                .orElseThrow(() -> new ResponseStatusException(UNAUTHORIZED, "Invalid credentials"));
        if (!user.isEnabled() || !encoder.matches(req.password(), user.getPasswordHash()))
            throw new ResponseStatusException(UNAUTHORIZED, "Invalid credentials");

        EmployeeSummary emp = user.getEmployee() == null ? null : new EmployeeSummary(
                user.getEmployee().getId(), user.getEmployee().getEmployeeCode(),
                user.getEmployee().getFirstName(), user.getEmployee().getLastName());

        return ResponseEntity.ok(new LoginResponse(jwt.generate(user), user.getId(),
                user.getEmail(), user.getRole().name(), emp));
    }

    public record MeResponse(Long userId, String email, String role, EmployeeSummary employee) {}

    @GetMapping("/me")
    public ResponseEntity<MeResponse> me() {
        UserAccount user = AuthPrincipal.current();
        EmployeeSummary emp = user.getEmployee() == null ? null : new EmployeeSummary(
                user.getEmployee().getId(), user.getEmployee().getEmployeeCode(),
                user.getEmployee().getFirstName(), user.getEmployee().getLastName());
        return ResponseEntity.ok(new MeResponse(user.getId(), user.getEmail(), user.getRole().name(), emp));
    }
}
