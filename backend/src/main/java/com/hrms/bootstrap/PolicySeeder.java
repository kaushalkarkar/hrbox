package com.hrms.bootstrap;

import com.hrms.domain.Policy;
import com.hrms.domain.PolicyCategory;
import com.hrms.repo.PolicyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;

/**
 * Seeds a handful of demo HR policies if the table is empty.
 * Runs after the main DataSeeder so the admin employee exists.
 */
@Component
@Order(50)
public class PolicySeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(PolicySeeder.class);

    private final PolicyRepository policies;

    public PolicySeeder(PolicyRepository policies) { this.policies = policies; }

    @Override
    @Transactional
    public void run(String... args) {
        if (policies.count() > 0) return;

        save("Leave Policy", PolicyCategory.LEAVE, "Annual entitlements, accrual rules, and how to apply.",
                """
                # Leave Policy

                ## Overview
                This document covers the company-wide leave types, entitlements and how to request time off.

                ## Annual entitlements
                - **Casual Leave** – 12 days per calendar year
                - **Sick Leave** – 12 days per calendar year
                - **Paid Leave** – 21 days per calendar year

                Entitlements reset on January 1 and unused balance does not carry forward.

                ## How to apply
                1. Open **Apply Leave** from the sidebar.
                2. Pick a leave type, dates and provide a reason.
                3. Your manager will be notified for approval.

                ## Approval SLA
                Managers are expected to act on requests within **2 business days**.
                """,
                "v1.0", LocalDate.of(2026, 1, 1));

        save("Attendance & Working Hours", PolicyCategory.ATTENDANCE,
                "Standard shift, late-mark, half-day and weekly off rules.",
                """
                # Attendance Policy

                ## Working hours
                Standard hours are **09:30 to 18:45 IST**, Monday through Friday.

                ## Late marks
                Arrival after **09:30** is flagged as a late mark. Three late marks in a calendar month
                trigger a manager conversation.

                ## Half day
                Less than **4 hours 30 minutes** logged on a working day is treated as a half day and prorated
                in payroll.

                ## Weekly off
                Saturday and Sunday are weekly offs.
                """,
                "v1.0", LocalDate.of(2026, 1, 1));

        save("Code of Conduct", PolicyCategory.CODE_OF_CONDUCT,
                "Expected workplace behaviour and anti-harassment commitments.",
                """
                # Code of Conduct

                We are committed to a workplace that is **safe, inclusive and respectful**.

                ## Behaviour standards
                - Treat every colleague with respect, regardless of role or background.
                - No tolerance for harassment, discrimination, or intimidation.
                - Speak up when you see something wrong — your HR team is here to help.

                ## Reporting
                Any concerns can be raised directly with HR (admin&#64;hrms.local) or through the Helpdesk module.
                Reports are handled confidentially.
                """,
                "v1.2", LocalDate.of(2026, 2, 1));

        save("Remote Work", PolicyCategory.REMOTE_WORK,
                "When and how to work from home, equipment and security expectations.",
                """
                # Remote Work Policy

                ## Eligibility
                Confirmed full-time employees are eligible for **up to 2 remote days per week** with
                manager approval.

                ## Security
                When working remotely:
                - Always connect through the company VPN.
                - Never share screens that show customer data on public calls.
                - Lock your machine when stepping away.

                ## Equipment
                The company provides a laptop. Personal devices may not be used for production access.
                """,
                "v1.0", LocalDate.of(2026, 3, 1));

        save("Reimbursement Policy", PolicyCategory.EXPENSE,
                "Eligible expenses, limits and how to file a claim.",
                """
                # Reimbursement Policy

                ## Eligible categories
                | Category | Monthly cap | Notes |
                |---|---|---|
                | Travel | as per actuals | Client visits, conferences |
                | Food | ₹3,000 | Client meals only |
                | Internet | ₹1,500 | Remote workers |
                | Training | as approved | Pre-approve with manager |

                ## How to file
                1. Open **Reimbursement** from the sidebar.
                2. Choose category, amount and expense date.
                3. Attach a receipt (coming soon).
                4. Your manager will approve or reject the claim.

                Claims older than **45 days** may be rejected.
                """,
                "v1.1", LocalDate.of(2026, 4, 1));

        save("Information Security", PolicyCategory.SECURITY,
                "Passwords, MFA, data classification, and incident reporting.",
                """
                # Information Security Policy

                ## Password hygiene
                - Use a unique password for your HRMS account, **at least 12 characters**.
                - Enable MFA where available.
                - Never share credentials, even with admins.

                ## Data classification
                Customer data is **Confidential**. Internal documents are **Internal**.
                Don't paste either into public chat tools or AI services.

                ## Incident reporting
                Suspected breach? Report to security&#64;hrms.local within **24 hours**.
                """,
                "v2.0", LocalDate.of(2026, 1, 15));

        log.info("Seeded {} demo policies", policies.count());
    }

    private void save(String title, PolicyCategory cat, String summary, String md,
                       String version, LocalDate effectiveFrom) {
        policies.save(Policy.builder()
                .title(title).category(cat).summary(summary)
                .contentMarkdown(md.stripIndent())
                .version(version).effectiveFrom(effectiveFrom).build());
    }
}
