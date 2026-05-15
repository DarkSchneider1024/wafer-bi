package com.k8sdemo.licenseservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.k8sdemo.licenseservice.service.VaultService;
import lombok.Data;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@RestController
public class LicenseController {

    private final VaultService vaultService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public LicenseController(VaultService vaultService) {
        this.vaultService = vaultService;
    }

    @Data
    public static class LicenseRequest {
        private String customer_name;
        private String machine_id;
        private Integer expiry_days;
        private String expiry_date; // Format: YYYY-MM-DD
        private List<String> features = List.of("core");
    }

    @PostMapping("/generate")
    public Map<String, String> generate(@RequestBody LicenseRequest req) throws Exception {
        // 1. Prepare payload
        LocalDateTime expiry;
        if (req.getExpiry_date() != null) {
            expiry = LocalDateTime.parse(req.getExpiry_date() + "T23:59:59");
        } else {
            int days = req.getExpiry_days() != null ? req.getExpiry_days() : 365;
            expiry = LocalDateTime.now().plusDays(days);
        }

        Map<String, Object> payload = Map.of(
                "customer", req.getCustomer_name(),
                "machine_id", req.getMachine_id(),
                "expiry", expiry.toString(),
                "features", req.getFeatures(),
                "issued_at", LocalDateTime.now().toString()
        );
        String payloadStr = objectMapper.writeValueAsString(payload);

        // 2. Sign with Vault
        String signature = vaultService.sign(payloadStr);

        // 3. Combine into License Key
        Map<String, Object> fullLicense = Map.of(
                "payload", payload,
                "signature", signature
        );
        String licenseKey = Base64.getEncoder().encodeToString(objectMapper.writeValueAsString(fullLicense).getBytes());

        return Map.of(
                "license_key", licenseKey,
                "public_key", vaultService.getPublicKey()
        );
    }

    @GetMapping("/public-key")
    public Map<String, String> getPublicKey() {
        return Map.of("public_key", vaultService.getPublicKey());
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }
}
