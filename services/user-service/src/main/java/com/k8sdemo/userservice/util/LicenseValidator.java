package com.k8sdemo.userservice.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;

@Component
public class LicenseValidator {

    private final ObjectMapper objectMapper = new ObjectMapper();

    public record ValidationResult(
            boolean isValid,
            boolean isExpired,
            long daysRemaining,
            String expiryDate,
            String message
    ) {}

    public ValidationResult validate(String licenseKeyBase64, String publicKeyPem) {
        try {
            byte[] decodedBytes = Base64.getDecoder().decode(licenseKeyBase64);
            JsonNode root = objectMapper.readTree(decodedBytes);
            
            JsonNode payloadNode = root.get("payload");
            String signatureStr = root.get("signature").asText();
            String payloadJson = objectMapper.writeValueAsString(payloadNode);
            
            String rawSignatureBase64 = signatureStr.split(":")[2];
            byte[] signatureBytes = Base64.getDecoder().decode(rawSignatureBase64);
            
            String cleanKey = publicKeyPem
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s", "");
            byte[] keyBytes = Base64.getDecoder().decode(cleanKey);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
            KeyFactory kf = KeyFactory.getInstance("RSA");
            PublicKey publicKey = kf.generatePublic(spec);
            
            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initVerify(publicKey);
            sig.update(payloadJson.getBytes(StandardCharsets.UTF_8));
            
            if (!sig.verify(signatureBytes)) {
                return new ValidationResult(false, false, 0, null, "Invalid Signature");
            }

            JsonNode expiryNode = payloadNode.get("expiry");
            if (expiryNode != null) {
                LocalDateTime expiry = LocalDateTime.parse(expiryNode.asText());
                LocalDateTime now = LocalDateTime.now();
                long daysRemaining = ChronoUnit.DAYS.between(now, expiry);
                
                if (now.isAfter(expiry)) {
                    return new ValidationResult(false, true, daysRemaining, expiry.toString(), "License Expired");
                }
                
                return new ValidationResult(true, false, daysRemaining, expiry.toString(), "OK");
            }
            
            return new ValidationResult(true, false, 999, null, "OK");
            
        } catch (Exception e) {
            return new ValidationResult(false, false, 0, null, "Error: " + e.getMessage());
        }
    }
}
