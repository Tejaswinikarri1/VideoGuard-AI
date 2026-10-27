package com.videoguard.users;

import com.videoguard.common.Ids;
import com.videoguard.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

/** Creates the first administrator from environment variables when no ADMIN exists. */
@Component
public class BootstrapAdmin implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(BootstrapAdmin.class);
    private final AppProperties props; private final MongoTemplate t; private final PasswordEncoder enc;

    public BootstrapAdmin(AppProperties props, MongoTemplate t, PasswordEncoder enc) { this.props = props; this.t = t; this.enc = enc; }

    @Override
    public void run(ApplicationArguments args) {
        String email = props.bootstrapAdminEmail(), pw = props.bootstrapAdminPassword();
        if (email == null || email.isBlank() || pw == null || pw.isBlank()) return;
        if (t.exists(Query.query(Criteria.where("roles").is("ADMIN")), User.class)) return;
        String bad = Passwords.check(pw);
        if (bad != null) { log.warn("Bootstrap admin skipped: {}", bad); return; }
        User u = new User();
        u.id = Ids.uuid(); u.displayName = "Administrator"; u.email = email.trim().toLowerCase();
        u.passwordHash = enc.encode(pw); u.roles = List.of("USER", "ANALYST", "ADMIN");
        t.save(u);
        log.info("Bootstrap administrator created for {}", u.email);
    }
}
