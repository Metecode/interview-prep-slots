package com.meteucar.mulakatslot.progress;

import com.meteucar.mulakatslot.auth.AuthErrorResponse;
import com.meteucar.mulakatslot.auth.UnauthorizedException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * İlerleme senkronu. Üç ucun da kimliği yalnızca Bearer access token'dan
 * gelir; kullanıcı ayrımı jwt.sub ile yapılır, gövdedeki hiçbir alan
 * "kimin ilerlemesi" sorusuna karışmaz.
 *
 * <p>Uçlar SecurityConfig'te tek tek sayılmıyor çünkü orada varsayılan
 * kapalı: permitAll listesinde olmayan her yol kimlik ister.
 */
@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private final ProgressSyncService progressSyncService;

    public ProgressController(ProgressSyncService progressSyncService) {
        this.progressSyncService = progressSyncService;
    }

    @GetMapping
    public List<ProgressRecord> list(@AuthenticationPrincipal Jwt jwt) {
        return progressSyncService.findAll(userId(jwt));
    }

    /** Kısmi liste: yalnızca değişenler gelir, tam değişim değil. */
    @PutMapping
    public ProgressApplyResult push(@AuthenticationPrincipal Jwt jwt, @RequestBody List<ProgressRecord> body) {
        return progressSyncService.apply(userId(jwt), body);
    }

    /** İlk girişte bir kez: gövde yereldeki her şey, yanıt birleşmiş tam sonuç. */
    @PostMapping("/merge")
    public List<ProgressRecord> merge(@AuthenticationPrincipal Jwt jwt, @RequestBody List<ProgressRecord> body) {
        return progressSyncService.mergeAll(userId(jwt), body);
    }

    private static UUID userId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<AuthErrorResponse> handleUnauthorized(UnauthorizedException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(AuthErrorResponse.unauthorized());
    }
}
