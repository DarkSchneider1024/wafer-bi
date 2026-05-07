package com.k8sdemo.userservice.service;

import com.k8sdemo.userservice.dto.*;
import com.k8sdemo.userservice.entity.User;
import com.k8sdemo.userservice.repository.UserRepository;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private final UserRepository userRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Register a new user.
     * Equivalent to Go's registerHandler.
     */
    public User register(RegisterRequest request) {
        if (request.username() == null || request.username().isBlank()
                || request.password() == null || request.password().isBlank()
                || request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException("Username, password and name are required");
        }

        if (userRepository.existsByUsername(request.username())) {
            throw new IllegalStateException("Username already exists");
        }

        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setName(request.name());
        if (request.userGroup() != null && !request.userGroup().isBlank()) {
            user.setUserGroup(request.userGroup());
        }

        User saved = userRepository.save(user);
        log.info("User registered: id={}, username={}, email={}", saved.getId(), saved.getUsername(), saved.getEmail());
        return saved;
    }

    /**
     * Authenticate user and return JWT token.
     * Equivalent to Go's loginHandler.
     */
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.username())
                .orElseThrow(() -> new SecurityException("Invalid credentials"));

        boolean matches = false;
        String storedHash = user.getPasswordHash();

        if (storedHash != null && storedHash.length() == 32) {
            String inputMd5 = md5(request.password());
            matches = inputMd5.equalsIgnoreCase(storedHash);
        } else {
            matches = passwordEncoder.matches(request.password(), storedHash);
        }

        if (!matches) {
            throw new SecurityException("Invalid credentials");
        }

        String token = generateToken(user);
        log.info("User logged in: id={}, email={}", user.getId(), user.getEmail());
        return new LoginResponse(token, user);
    }

    private String md5(String input) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("MD5");
            byte[] array = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : array) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    /**
     * List all users.
     * Equivalent to Go's listUsersHandler.
     */
    public List<User> listUsers() {
        return userRepository.findAll();
    }

    private String generateToken(User user) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .claim("user_id", user.getId())
                .claim("email", user.getEmail())
                .claim("group", user.getUserGroup())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(key)
                .compact();
    }
}
