package com.k8sdemo.userservice.dto;

import com.k8sdemo.userservice.entity.User;

public record LoginResponse(String token, User user) {}
