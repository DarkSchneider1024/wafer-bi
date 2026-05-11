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

            // 3. Seed Demo User
            if (userRepo.findByUsername("demo01").isEmpty()) {
                User demo = new User();
                demo.setName("Demo Sudo User");
                demo.setUsername("demo01");
                demo.setEmail("demo01@carrot-atelier.online");
                demo.setPasswordHash(encoder.encode("demo01_password_123"));
                demo.setGroup(adminGroup);
                userRepo.save(demo);
                log.info("Seeded demo01 user in admin group");
            }
            
            // 4. Seed Admin User
            if (userRepo.findByUsername("admin").isEmpty()) {
                User admin = new User();
                admin.setName("System Admin");
                admin.setUsername("admin");
                admin.setEmail("admin@carrot-atelier.online");
                admin.setPasswordHash(encoder.encode("admin@carrot"));
                admin.setGroup(adminGroup);
                userRepo.save(admin);
                log.info("Seeded default admin user");
            }
        };
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
