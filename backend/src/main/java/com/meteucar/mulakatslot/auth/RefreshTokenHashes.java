package com.meteucar.mulakatslot.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Refresh token'ın veritabanında saklanan biçimi. Düz değer hiçbir zaman
 * yazılmaz; arama da bu özetle yapılır.
 *
 * <p>SHA-256 yeterli: token 32 bayt rastgele veri, sözlük saldırısına açık
 * bir parola değil. Yavaş bir KDF burada yalnızca her yenilemeyi
 * geciktirirdi.
 */
final class RefreshTokenHashes {

    private RefreshTokenHashes() {
    }

    static String of(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 her JVM'de zorunlu; buraya düşmesi mümkün değil.
            throw new IllegalStateException("SHA-256 bulunamadı", e);
        }
    }
}
