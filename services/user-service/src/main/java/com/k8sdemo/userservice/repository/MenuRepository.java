package com.k8sdemo.userservice.repository;

import com.k8sdemo.userservice.entity.Menu;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface MenuRepository extends JpaRepository<Menu, Integer> {
    Optional<Menu> findByCode(String code);
}
