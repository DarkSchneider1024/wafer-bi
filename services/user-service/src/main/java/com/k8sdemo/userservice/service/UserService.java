package com.k8sdemo.userservice.service;

import com.k8sdemo.userservice.dto.*;
import com.k8sdemo.userservice.entity.User;
import com.k8sdemo.userservice.entity.Group;
import com.k8sdemo.userservice.entity.Menu;
import com.k8sdemo.userservice.repository.UserRepository;
import com.k8sdemo.userservice.repository.GroupRepository;
import com.k8sdemo.userservice.repository.MenuRepository;

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
    private final GroupRepository groupRepository;
    private final MenuRepository menuRepository;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Value("${app.jwt.expiration-ms}")
    private long jwtExpirationMs;

    public UserService(UserRepository userRepository, GroupRepository groupRepository, MenuRepository menuRepository) {
        this.userRepository = userRepository;
        this.groupRepository = groupRepository;
        this.menuRepository = menuRepository;
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

        String token = generateToken(user);
        log.info("User logged in: id={}, email={}", user.getId(), user.getEmail());
        
        List<Menu> menus = List.of();
        if (user.getGroup() != null && user.getGroup().getMenus() != null) {
            menus = List.copyOf(user.getGroup().getMenus());
        }
        
        return new LoginResponse(token, user, menus);
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
        if (request.name() != null) user.setName(request.name());
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
