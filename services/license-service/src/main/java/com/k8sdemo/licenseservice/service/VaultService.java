package com.k8sdemo.licenseservice.service;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import org.springframework.vault.core.VaultOperations;
import org.springframework.vault.core.VaultTransitOperations;
import org.springframework.vault.support.VaultTransitContext;
import org.springframework.vault.support.VaultTransitKeyConfiguration;

import java.util.Base64;
import java.util.Map;

@Service
public class VaultService {

    private final VaultOperations vaultOperations;
    private final String KEY_NAME = "license-key";

    public VaultService(VaultOperations vaultOperations) {
        this.vaultOperations = vaultOperations;
    }

    @PostConstruct
    public void init() {
        try {
            VaultTransitOperations transit = vaultOperations.opsForTransit();
            // Create key if not exists
            if (transit.getKeys().stream().noneMatch(k -> k.equals(KEY_NAME))) {
                transit.createKey(KEY_NAME, VaultTransitKeyConfiguration.builder()
                        .type("rsa-4096")
                        .build());
            }
        } catch (Exception e) {
            System.err.println("Failed to initialize Vault Transit key: " + e.getMessage());
        }
    }

    public String sign(String data) {
        VaultTransitOperations transit = vaultOperations.opsForTransit();
        String plaintextBase64 = Base64.getEncoder().encodeToString(data.getBytes());
        return transit.sign(KEY_NAME, plaintextBase64);
    }

    public String getPublicKey() {
        // Spring Vault's opsForTransit doesn't directly return the raw public key easily in some versions
        // We can use the generic write/read if needed, or opsForTransit().getKey()
        var key = vaultOperations.opsForTransit().getKey(KEY_NAME);
        // The public key is in the keys map of the response
        Map<String, Object> latestKey = (Map<String, Object>) key.getKeys().get(String.valueOf(key.getLatestVersion()));
        return (String) latestKey.get("public_key");
    }
}
