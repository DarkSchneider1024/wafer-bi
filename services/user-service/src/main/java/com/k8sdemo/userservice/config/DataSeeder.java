package com.k8sdemo.userservice.config;

import com.k8sdemo.userservice.entity.Group;
import com.k8sdemo.userservice.entity.Menu;
import com.k8sdemo.userservice.entity.User;
import com.k8sdemo.userservice.repository.GroupRepository;
import com.k8sdemo.userservice.repository.MenuRepository;
import com.k8sdemo.userservice.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.HashSet;
import java.util.Set;

@Configuration
public class DataSeeder {
    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    @Bean
    CommandLineRunner initDatabase(UserRepository userRepo, GroupRepository groupRepo, MenuRepository menuRepo) {
        return args -> {
            BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

            // 1. Initialize Menus
            log.info("Checking for initial menus...");
            Menu lotOverview = getOrCreateMenu(menuRepo, "批次概覽", "lot-overview", "/lot-overview", "LayoutGrid");
            Menu waferDetail = getOrCreateMenu(menuRepo, "晶圓細節", "wafer-detail", "/wafer-detail", "Cpu");
            Menu statsAnalysis = getOrCreateMenu(menuRepo, "統計分析", "statistical-analysis", "/statistical-analysis", "BarChart3");
            Menu userMgmt = getOrCreateMenu(menuRepo, "用戶管理", "user-management", "/user-management", "ShieldCheck");
            Menu sysStatus = getOrCreateMenu(menuRepo, "系統狀態", "system-status", "/system-status", "Activity");

            // 2. Initialize Groups
            log.info("Checking for initial groups...");
            Group adminGroup = groupRepo.findByName("admin").orElseGet(() -> {
                Group g = new Group();
                g.setName("admin");
                Set<Menu> menus = new HashSet<>();
                menus.add(lotOverview);
                menus.add(waferDetail);
                menus.add(statsAnalysis);
                menus.add(userMgmt);
                menus.add(sysStatus);
                g.setMenus(menus);
                return groupRepo.save(g);
            });

            Group userGroup = groupRepo.findByName("user").orElseGet(() -> {
                Group g = new Group();
                g.setName("user");
                Set<Menu> menus = new HashSet<>();
                menus.add(lotOverview);
                menus.add(waferDetail);
                g.setMenus(menus);
                return groupRepo.save(g);
            });

            // 3. Seed Demo User —— 密碼一律由環境變數提供，沒設就不建立。
            //    種子帳號的密碼寫死在原始碼裡，等於把可用憑證publish到公開 repo。
            seedUser(userRepo, encoder, adminGroup, "demo01", "Demo Sudo User",
                     "demo01@example.com", System.getenv("SEED_DEMO_PASSWORD"));

            // 4. Seed Admin User
            seedUser(userRepo, encoder, adminGroup, "admin", "System Admin",
                     "admin@example.com", System.getenv("SEED_ADMIN_PASSWORD"));
        };
    }

    private void seedUser(UserRepository userRepo, BCryptPasswordEncoder encoder, Group group,
                          String username, String displayName, String email, String rawPassword) {
        if (!userRepo.findByUsername(username).isEmpty()) {
            return;
        }
        if (rawPassword == null || rawPassword.isBlank()) {
            log.warn("Skipping seed for '{}': password env var is not set. "
                   + "Set SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD to enable seeding.", username);
            return;
        }
        User user = new User();
        user.setName(displayName);
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(encoder.encode(rawPassword));
        user.setGroup(group);
        userRepo.save(user);
        log.info("Seeded '{}' user", username);
    }

    private Menu getOrCreateMenu(MenuRepository repo, String name, String code, String path, String icon) {
        return repo.findByCode(code).orElseGet(() -> {
            Menu m = new Menu();
            m.setName(name);
            m.setCode(code);
            m.setPath(path);
            m.setIcon(icon);
            return repo.save(m);
        });
    }
}
