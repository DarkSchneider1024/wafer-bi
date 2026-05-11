package com.k8sdemo.userservice.dto;

import com.k8sdemo.userservice.entity.User;
import com.k8sdemo.userservice.entity.Menu;
import java.util.List;

public record LoginResponse(String token, User user, List<Menu> menus) {}
