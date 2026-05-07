package com.k8sdemo.userservice.dto;

public record RegisterRequest(String username, String email, String password, String name, String userGroup) {}
