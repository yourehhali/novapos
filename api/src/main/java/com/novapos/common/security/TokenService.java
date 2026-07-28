package com.novapos.common.security;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TokenService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final ObjectMapper objectMapper;
    private final String secret;
    private final long accessTokenMinutes;
    private final long refreshTokenMinutes;

    public TokenService(
        ObjectMapper objectMapper,
        @Value("${novapos.security.jwt-secret}") String secret,
        @Value("${novapos.security.access-token-minutes}") long accessTokenMinutes,
        @Value("${novapos.security.refresh-token-minutes}") long refreshTokenMinutes
    ) {
        this.objectMapper = objectMapper;
        this.secret = secret;
        this.accessTokenMinutes = accessTokenMinutes;
        this.refreshTokenMinutes = refreshTokenMinutes;
    }

    public String createAccessToken(SessionPrincipal principal) {
        return createToken(principal, "access", accessTokenMinutes);
    }

    public String createRefreshToken(SessionPrincipal principal) {
        return createToken(principal, "refresh", refreshTokenMinutes);
    }

    public Optional<SessionPrincipal> parseAccessToken(String token) {
        return parseToken(token, "access");
    }

    public Optional<SessionPrincipal> parseRefreshToken(String token) {
        return parseToken(token, "refresh");
    }

    private String createToken(SessionPrincipal principal, String tokenType, long ttlMinutes) {
        try {
            var header = Map.of("alg", "HS256", "typ", "JWT");
            var payload = Map.<String, Object>of(
                "sub", principal.userId(),
                "displayName", principal.displayName(),
                "tenantId", principal.tenantId(),
                "roles", principal.roles(),
                "permissions", principal.permissions(),
                "tokenType", tokenType,
                "exp", Instant.now().plusSeconds(ttlMinutes * 60).getEpochSecond()
            );

            var encodedHeader = base64UrlEncode(objectMapper.writeValueAsBytes(header));
            var encodedPayload = base64UrlEncode(objectMapper.writeValueAsBytes(payload));
            var signature = sign(encodedHeader + "." + encodedPayload);

            return encodedHeader + "." + encodedPayload + "." + signature;
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to create token", exception);
        }
    }

    private Optional<SessionPrincipal> parseToken(String token, String requiredTokenType) {
        try {
            var parts = token.split("\\.");
            if (parts.length != 3) {
                return Optional.empty();
            }

            var signature = sign(parts[0] + "." + parts[1]);
            if (!signature.equals(parts[2])) {
                return Optional.empty();
            }

            var payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            var payload = objectMapper.readValue(payloadJson, MAP_TYPE);

            var exp = ((Number) payload.get("exp")).longValue();
            if (Instant.now().getEpochSecond() > exp) {
                return Optional.empty();
            }

            if (!requiredTokenType.equals(payload.get("tokenType"))) {
                return Optional.empty();
            }

            return Optional.of(
                new SessionPrincipal(
                    String.valueOf(payload.get("sub")),
                    String.valueOf(payload.get("displayName")),
                    String.valueOf(payload.get("tenantId")),
                    castStringList(payload.get("roles")),
                    castStringList(payload.get("permissions"))
                )
            );
        } catch (Exception exception) {
            return Optional.empty();
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> castStringList(Object value) {
        return ((List<Object>) value).stream()
            .map(String::valueOf)
            .toList();
    }

    private String sign(String value) throws Exception {
        var algorithm = "HmacSHA256";
        var mac = Mac.getInstance(algorithm);
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), algorithm));
        return base64UrlEncode(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
    }

    private String base64UrlEncode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
