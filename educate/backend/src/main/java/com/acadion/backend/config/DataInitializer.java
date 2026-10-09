
package com.acadion.backend.config;

import com.acadion.backend.entity.Role;
import com.acadion.backend.entity.User;
import com.acadion.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;

    private final BCryptPasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {

        // Check admin already exists
        if (userRepository.findByEmail("admin@acadion.com").isPresent()) {

            System.out.println("Admin already exists");
            return;
        }

        // Create Admin
        User admin = User.builder()

                .name("Acadion Admin")

                .email("admin@acadion.com")

                .password(
                        passwordEncoder.encode("Admin@123")
                )

                .role(Role.ADMIN)

                .verified(true)

                .approved(true)

                .banned(false)

                .createdAt(LocalDateTime.now())

                .build();

        // Save Admin
        userRepository.save(admin);

        System.out.println("Default Admin Created Successfully");
    }
}