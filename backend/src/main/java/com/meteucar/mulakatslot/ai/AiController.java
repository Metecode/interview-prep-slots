package com.meteucar.mulakatslot.ai;

import com.meteucar.mulakatslot.ai.AiDtos.ErrorResponse;
import com.meteucar.mulakatslot.ai.AiDtos.EvaluateRequest;
import com.meteucar.mulakatslot.ai.AiDtos.EvaluateResponse;
import com.meteucar.mulakatslot.ai.AiDtos.StatusResponse;
import com.meteucar.mulakatslot.auth.AuthErrorResponse;
import com.meteucar.mulakatslot.auth.UnauthorizedException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Yapay zekâ uçları. İkisi de Bearer ister; SecurityConfig'te ayrıca
 * sayılmıyor çünkü orada varsayılan kapalı. Kullanıcı ayrımı jwt.sub ile.
 *
 * <p>Hata gövdesi {@code { "code": "..." }}: istemci 429'un kota mı hız
 * sınırı mı olduğunu buradan ayırt eder.
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    /** Üst çubuktaki sayaç ve düğmenin açık olup olmadığı buradan. */
    @GetMapping("/status")
    public StatusResponse status(@AuthenticationPrincipal Jwt jwt) {
        return aiService.status(userId(jwt));
    }

    @PostMapping("/evaluate")
    public EvaluateResponse evaluate(@AuthenticationPrincipal Jwt jwt, @RequestBody EvaluateRequest body) {
        return aiService.evaluate(userId(jwt), body.questionId(), body.answer());
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    @ExceptionHandler(AiRequestException.class)
    public ResponseEntity<ErrorResponse> handleAiRequest(AiRequestException e) {
        return ResponseEntity.status(e.status()).body(new ErrorResponse(e.code()));
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<AuthErrorResponse> handleUnauthorized(UnauthorizedException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(AuthErrorResponse.unauthorized());
    }
}
