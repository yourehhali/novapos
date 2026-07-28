package com.novapos.modules.identity;

import com.novapos.common.security.SessionPrincipal;
import com.novapos.common.security.TokenService;
import com.novapos.modules.identity.dto.AuthSessionResponse;
import com.novapos.modules.identity.dto.LoginRequest;
import com.novapos.modules.shared.SampleDataService;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class AuthService {

    private final SampleDataService sampleDataService;
    private final TokenService tokenService;

    public AuthService(SampleDataService sampleDataService, TokenService tokenService) {
        this.sampleDataService = sampleDataService;
        this.tokenService = tokenService;
    }

    public AuthSessionResponse login(LoginRequest request) {
        var user = sampleDataService.findUserByLogin(request.login())
            .filter(candidate -> candidate.password().equals(request.password()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid login credentials"));

        return buildSessionResponse(sampleDataService.sessionContext(user));
    }

    public Optional<AuthSessionResponse> refresh(String refreshToken) {
        return tokenService.parseRefreshToken(refreshToken)
            .flatMap(principal -> sampleDataService.findUserById(principal.userId()))
            .map(sampleDataService::sessionContext)
            .map(this::buildSessionResponse);
    }

    public AuthSessionResponse me(SessionPrincipal principal) {
        var context = sampleDataService.findUserById(principal.userId())
            .map(sampleDataService::sessionContext)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unknown session principal"));

        return buildSessionResponse(context);
    }

    private AuthSessionResponse buildSessionResponse(SampleDataService.SessionContext context) {
        var principal = new SessionPrincipal(
            context.id(),
            context.displayName(),
            context.tenantId(),
            context.roles(),
            context.permissions()
        );

        var branchAssignments = context.branchAssignments().stream()
            .map(assignment -> new AuthSessionResponse.BranchAssignment(
                assignment.branchId(),
                assignment.branchName(),
                assignment.defaultDeviceType()
            ))
            .toList();

        return new AuthSessionResponse(
            tokenService.createAccessToken(principal),
            tokenService.createRefreshToken(principal),
            new AuthSessionResponse.UserSession(
                context.id(),
                context.displayName(),
                context.tenantId(),
                context.businessName(),
                context.roles(),
                context.permissions(),
                branchAssignments
            )
        );
    }
}
