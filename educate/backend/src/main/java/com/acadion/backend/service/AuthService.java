package com.acadion.backend.service;

import com.acadion.backend.dto.LoginRequest;
import com.acadion.backend.dto.RegisterRequest;
import com.acadion.backend.entity.User;
import com.acadion.backend.mail.EmailSenderService;
import com.acadion.backend.repository.UserRepository;
import com.acadion.backend.security.JwtUtil;
import com.acadion.backend.util.OtpUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;

    private final EmailSenderService emailSenderService;

    private final JwtUtil jwtUtil;

    private final BCryptPasswordEncoder passwordEncoder;

    // REGISTER
    public String register(RegisterRequest request) {

        // Check existing email
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered");
        }

        // Generate OTP
        String otp = OtpUtil.generateOtp();

        // Create User
        User user = User.builder()

                .name(request.getName())
                .email(request.getEmail())

                .password(
                        passwordEncoder.encode(
                                request.getPassword()
                        )
                )

                // Role selected during registration
                .role(request.getRole())

                // Verification & approval
                .verified(false)
                .approved(false)
                .banned(false)

                // OTP
                .otp(otp)
                .otpExpiry(
                        LocalDateTime.now().plusMinutes(10)
                )

                // Student fields
                .usn(request.getUsn())
                .semester(request.getSemester())
                .studentDepartment(
                        request.getStudentDepartment()
                )

                // Teacher fields
                .employeeId(request.getEmployeeId())
                .designation(request.getDesignation())
                .teacherDepartment(
                        request.getTeacherDepartment()
                )

                .createdAt(LocalDateTime.now())

                .build();

        // Save user
        userRepository.save(user);

        // Send OTP Email
        try {
            emailSenderService.sendOtpEmail(
                    request.getEmail(),
                    otp
            );
        } catch (Exception e) {
            System.err.println("[EmailService Warning] Failed to send OTP email: " + e.getMessage());
            System.out.println("==================================================");
            System.out.println("ACADION REGISTRATION OTP FOR " + request.getEmail() + " : " + otp);
            System.out.println("==================================================");
        }

        return "Registration successful. OTP: " + otp;
    }

    // VERIFY OTP
    public String verifyOtp(String email, String otp) {

        User user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new IllegalArgumentException("User not found")
                );

        // Invalid OTP
        if (!user.getOtp().equals(otp)) {
            throw new IllegalArgumentException("Invalid OTP");
        }

        // OTP Expired
        if (user.getOtpExpiry()
                .isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("OTP expired");
        }

        // Verify account
        user.setVerified(true);

        // Clear OTP
        user.setOtp(null);
        user.setOtpExpiry(null);

        // Save updated user
        userRepository.save(user);

        return "Email verified successfully. Wait for admin approval.";
    }

    // LOGIN
    public String login(LoginRequest request) {

        String rawEmail = request.getEmail() != null ? request.getEmail().trim() : "";
        User user = userRepository.findByEmail(rawEmail.toLowerCase())
                .or(() -> userRepository.findByEmail(rawEmail))
                .orElseThrow(() ->
                        new IllegalArgumentException("User not found")
                );

        // Email not verified
        if (!user.isVerified()) {
            throw new IllegalArgumentException("Please verify your email first");
        }

        // User rejected
        if (user.isRejected()) {
            throw new IllegalArgumentException("Your registration was rejected by admin");
        }

        // Approval pending
        if (!user.isApproved()) {
            throw new IllegalArgumentException("Waiting for admin approval");
        }

        // Banned account
        if (user.isBanned()) {
            throw new IllegalArgumentException("Your account is banned");
        }

        // Password check
        boolean passwordMatch =
                passwordEncoder.matches(
                        request.getPassword(),
                        user.getPassword()
                );

        if (!passwordMatch) {
            throw new IllegalArgumentException("Invalid password");
        }

        // Generate JWT Token
        return jwtUtil.generateToken(
                user.getEmail(),
                user.getRole().name(),
                user.getName(),
                user.getUsn()
        );
    }
}