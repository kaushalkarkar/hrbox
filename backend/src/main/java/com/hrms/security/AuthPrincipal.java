package com.hrms.security;

import com.hrms.domain.UserAccount;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class AuthPrincipal {
    private AuthPrincipal() {}

    public static UserAccount current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserAccount user)) {
            throw new IllegalStateException("No authenticated user");
        }
        return user;
    }
}
