package com.k8sdemo.userservice.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

@Component
public class LicenseValidator {

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Verifies a license key.
     * @param licenseKeyBase64 The base64 encoded license string from the client.
     * @param publicKeyPem The public key in PEM format (from Vault/OpenBao).
     * @return true if valid, false otherwise.
     */
    public boolean validate(String licenseKeyBase64, String publicKeyPem) {
        try {
            // 1. Decode the full license object
            byte[] decodedBytes = Base64.getDecoder().decode(licenseKeyBase64);
            JsonNode root = objectMapper.readTree(decodedBytes);
            
            JsonNode payloadNode = root.get("payload");
            String signatureStr = root.get("signature").asText(); // format: vault:v1:base64...
            
            // 2. Prepare data for verification (the same string that was signed)
            String payloadJson = objectMapper.writeValueAsString(payloadNode);
            
            // 3. Extract raw signature bytes from Vault format
            String rawSignatureBase64 = signatureStr.split(":")[2];
            byte[] signatureBytes = Base64.getDecoder().decode(rawSignatureBase64);
            
            // 4. Load Public Key
            String cleanKey = publicKeyPem
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s", "");
            byte[] keyBytes = Base64.getDecoder().decode(cleanKey);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
            KeyFactory kf = KeyFactory.getInstance("RSA");
            PublicKey publicKey = kf.generatePublic(spec);
            
            // 5. Verify
            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initVerify(publicKey);
            sig.update(payloadJson.getBytes(StandardCharsets.UTF_8));
            
            return sig.verify(signatureBytes);
            
        } catch (Exception e) {
            System.err.println("License validation failed: " + e.getMessage());
            return false;
        }
    }
}
