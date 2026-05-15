package com.k8sdemo.userservice.controller;

import com.k8sdemo.userservice.util.LicenseValidator;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@RestController
@RequestMapping("/auth/license")
public class LicenseController {

    private final LicenseValidator licenseValidator;
    private final RestTemplate restTemplate = new RestTemplate();
    
    // In k8s, this would be the service name
    private final String LICENSE_SERVICE_URL = "http://license-service:8005";

    public LicenseController(LicenseValidator licenseValidator) {
        this.licenseValidator = licenseValidator;
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyLicense(@RequestBody Map<String, String> body) {
        String licenseKey = body.get("license_key");
        if (licenseKey == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "license_key is required"));
        }

        try {
            // 1. Get Public Key from License Service
            Map<String, Object> response = restTemplate.getForObject(LICENSE_SERVICE_URL + "/public-key", Map.class);
            String publicKey = (String) response.get("public_key");

            // 2. Validate
            boolean isValid = licenseValidator.validate(licenseKey, publicKey);

            if (isValid) {
                return ResponseEntity.ok(Map.of("status", "valid", "message", "License is authentic"));
            } else {
                return ResponseEntity.status(403).body(Map.of("status", "invalid", "message", "License verification failed"));
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }
}
