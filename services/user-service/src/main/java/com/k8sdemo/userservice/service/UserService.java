package com.k8sdemo.userservice.service;

import com.k8sdemo.userservice.dto.*;
import com.k8sdemo.userservice.entity.User;
import com.k8sdemo.userservice.entity.Group;
import com.k8sdemo.userservice.entity.Menu;
import com.k8sdemo.userservice.repository.UserRepository;
import com.k8sdemo.userservice.repository.GroupRepository;
import com.k8sdemo.userservice.repository.MenuRepository;

import com.k8sdemo.userservice.util.LicenseValidator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import jakarta.annotation.PostConstruct;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Service
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final MenuRepository menuRepository;
    private final LicenseValidator licenseValidator;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    @Value("${app.license.key:}")
    private String licenseKey;

    @Value("${app.license.file-path:license.json}")
    private String licenseFilePath;

    @Value("${app.license.service-url:http://license-service:8005}")
    private String licenseServiceUrl;

    @PostConstruct
    public void init() {
        try {
            Path path = Path.of(licenseFilePath);
            if (Files.exists(path)) {
                String content = Files.readString(path);
                JsonNode node = objectMapper.readTree(content);
                if (node.has("license_key")) {
                    this.licenseKey = node.get("license_key").asText();
                    log.info("License key loaded from file: {}", licenseFilePath);
                }
            } else {
                log.info("No license file found at {}, using environment variable if present.", licenseFilePath);
            }
        } catch (Exception e) {
            log.error("Failed to load license from file: {}", licenseFilePath, e);
        }
    }

    public UserService(UserRepository userRepository, GroupRepository groupRepository, MenuRepository menuRepository, LicenseValidator licenseValidator) {
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.menuRepository = menuRepository;
        this.licenseValidator = licenseValidator;
    }

    /**
     * Register a new user.
     * Equivalent to Go's registerHandler.
     */
    public User register(RegisterRequest request) {
        if (request.username() == null || request.username().isBlank()
                || request.password() == null || request.password().isBlank()) {
            throw new IllegalArgumentException("Username and password are required");
        }

        if (userRepository.existsByUsername(request.username())) {
            throw new IllegalStateException("Username already exists");
        }

        User user = new User();
        user.setUsername(request.username());
        user.setEmail(request.email());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setName(request.username());
        
        // Find group by name
        String groupName = (request.userGroup() != null && !request.userGroup().isBlank()) ? request.userGroup() : "user";
        Group group = groupRepository.findByName(groupName)
                .orElseGet(() -> {
                    Group newGroup = new Group();
                    newGroup.setName(groupName);
                    return groupRepository.save(newGroup);
                });
        user.setGroup(group);

        User saved = userRepository.save(user);
        log.info("User registered: id={}, username={}, email={}, group={}", saved.getId(), saved.getUsername(), saved.getEmail(), groupName);
        return saved;
    }

    /**
     * Authenticate user and return JWT token.
     * Equivalent to Go's loginHandler.
     */
    public LoginResponse login(LoginRequest request) {
        log.info("Login attempt for username: {}", request.username());
        User user = userRepository.findByUsername(request.username())
                .orElseGet(() -> {
                    log.warn("User not found in DB: {}", request.username());
                    return null;
                });

        if (user == null) {
            throw new SecurityException("Invalid credentials");
        }

        String storedHash = user.getPasswordHash();
        boolean matches = passwordEncoder.matches(request.password(), storedHash);
        
        log.info("Password match attempt: identifier={}, matches={}", request.username(), matches);
        log.debug("DEBUG - Input pass: {}, Stored hash: {}", request.password(), storedHash);

        if (!matches) {
            throw new SecurityException("Invalid credentials");
        }

        // --- License Check ---
        String licenseWarning = null;
        if (licenseKey != null && !licenseKey.isBlank()) {
            try {
                Map<String, Object> response = restTemplate.getForObject(licenseServiceUrl + "/public-key", Map.class);
                String publicKey = (String) response.get("public_key");
                LicenseValidator.ValidationResult result = licenseValidator.validate(licenseKey, publicKey);
                
                if (result.isExpired()) {
                    throw new SecurityException("license 過期 expri day 5/20 請通知管理員確認");
                }
                
                if (!result.isValid()) {
                    throw new SecurityException("License 驗證失敗，請聯繫管理員");
                }
                
                if (result.daysRemaining() <= 7) {
                    licenseWarning = "License 即將於 " + result.expiryDate().substring(0, 10) + " 過期，請及時更新。";
                }
            } catch (SecurityException se) {
                throw se;
            } catch (Exception e) {
                log.error("License validation failed during login", e);
            }
        }

        String token = generateToken(user);
        log.info("User logged in: id={}, email={}", user.getId(), user.getEmail());
        
        List<Menu> menus = List.of();
        if (user.getGroup() != null && user.getGroup().getMenus() != null) {
            menus = List.copyOf(user.getGroup().getMenus());
        }
        
        return new LoginResponse(token, user, menus, licenseWarning);
    }

    /**
     * List all users.
     * Equivalent to Go's listUsersHandler.
     */
    public List<User> listUsers() {
        return userRepository.findAll();
    }

    /**
     * Update user details (name, email, userGroup).
     */
    public User updateUser(Integer id, RegisterRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (request.email() != null) user.setEmail(request.email());

        if (request.userGroup() != null) {
            String groupName = request.userGroup();
            Group group = groupRepository.findByName(groupName)
                    .orElseGet(() -> {
                        Group newGroup = new Group();
                        newGroup.setName(groupName);
                        return groupRepository.save(newGroup);
                    });
            user.setGroup(group);
        }

        return userRepository.save(user);
    }

    /**
     * Reset a user's password.
     */
    public void resetPassword(Integer id, String newPassword) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("Password reset for user id: {}", id);
    }

    /**
     * Delete a user.
     */
    public void deleteUser(Integer id) {
        if (!userRepository.existsById(id)) {
            throw new IllegalArgumentException("User not found");
        }
        userRepository.deleteById(id);
        log.info("User deleted: id={}", id);
    }

    private String generateToken(User user) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        return Jwts.builder()
                .claim("user_id", user.getId())
                .claim("email", user.getEmail())
                .claim("group", user.getUserGroupName())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + jwtExpirationMs))
                .signWith(key)
                .compact();
    }
}
