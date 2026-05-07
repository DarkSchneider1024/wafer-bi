package com.k8sdemo.userservice.config;

import com.k8sdemo.userservice.entity.User;
import com.k8sdemo.userservice.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Configuration
public class DataSeeder {
    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    @Bean
    CommandLineRunner initDatabase(UserRepository repository) {
        return args -> {
            BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

            // Create Demo01 (Sudo/Admin access for demonstration)
            if (repository.findByEmail("demo01@carrot.com").isEmpty()) {
                User demo = new User();
                demo.setName("Demo Sudo User");
                demo.setEmail("demo01@carrot.com");
                demo.setPasswordHash(encoder.encode("demo01_password_123"));
                demo.setUserGroup("admin");
                repository.save(demo);
                log.info("Seeded demo01 user with 'admin' (sudo) group");
            }
        };
    }
}
