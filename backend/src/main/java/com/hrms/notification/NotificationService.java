package com.hrms.notification;

import com.hrms.domain.AppNotification;
import com.hrms.domain.NotificationType;
import com.hrms.domain.UserAccount;
import com.hrms.repo.NotificationRepository;
import com.hrms.repo.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationService {

    private final NotificationRepository repo;
    private final UserAccountRepository users;

    public NotificationService(NotificationRepository repo, UserAccountRepository users) {
        this.repo = repo;
        this.users = users;
    }

    @Transactional
    public void push(UserAccount user, NotificationType type, String title, String message, String link) {
        repo.save(AppNotification.builder()
            .user(user).type(type).title(title).message(message).link(link)
            .build());
    }

    @Transactional
    public void notify(UserAccount user, NotificationType type, String title, String message, String link) {
        push(user, type, title, message, link);
    }

    @Transactional
    public void notifyByEmail(String email, NotificationType type, String title, String message, String link) {
        users.findByEmail(email).ifPresent(user -> push(user, type, title, message, link));
    }
}
