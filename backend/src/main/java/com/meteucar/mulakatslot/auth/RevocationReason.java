package com.meteucar.mulakatslot.auth;

import jakarta.persistence.AttributeConverter;
import java.util.Arrays;
import java.util.Locale;

/**
 * Bir refresh token'ın neden iptal edildiği. Yeniden kullanım tespiti buna
 * bakar: rotasyon normal akışın parçası, çıkış ve toplu iptal değil.
 */
public enum RevocationReason {

    /** Yenileme sırasında yerini yenisine bıraktı. */
    ROTATED,

    /** Kullanıcı çıkış yaptı. */
    LOGOUT,

    /** Yeniden kullanım tespit edildi, kullanıcının tüm token'ları düştü. */
    REUSE_DETECTED;

    /** Veritabanındaki karşılığı; V3 migration'daki CHECK bu değerleri sayar. */
    public String dbValue() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static RevocationReason fromDbValue(String value) {
        return Arrays.stream(values())
                .filter(reason -> reason.dbValue().equals(value))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("bilinmeyen iptal sebebi: " + value));
    }

    /**
     * Enum adı (REUSE_DETECTED) ile kolon değeri (reuse_detected) farklı
     * olduğu için EnumType.STRING yetmiyor.
     */
    @jakarta.persistence.Converter
    public static class DbConverter implements AttributeConverter<RevocationReason, String> {

        @Override
        public String convertToDatabaseColumn(RevocationReason attribute) {
            return attribute == null ? null : attribute.dbValue();
        }

        @Override
        public RevocationReason convertToEntityAttribute(String dbData) {
            return dbData == null ? null : fromDbValue(dbData);
        }
    }
}
