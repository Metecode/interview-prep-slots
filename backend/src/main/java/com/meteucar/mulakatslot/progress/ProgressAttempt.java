package com.meteucar.mulakatslot.progress;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tek bir deneme, API sınırında. Frontend'in
 * src/domain/progress.ts#attemptSchema tipiyle birebir.
 *
 * <p>Tip yalnızca sınırda: saklama ve birleştirme {@code Map} ile çalışmaya
 * devam ediyor ({@link #toStored()}, {@link #fromStored(Map)}). JSONB'yi
 * doğrudan bu record'a eşleseydik, şemaya uymayan eski bir satır okunurken
 * hata verirdi — migration yapmadan canlı veriyi okunamaz kılmak olurdu.
 *
 * <p>Alanlar sarmalayıcı tip: eksik alan sessizce 0 ya da false olmasın,
 * null kalıp {@link ProgressValidator}'da elensin. Değer ihlali kaydı
 * atlatır; bilinmeyen alan ise şekil ihlalidir ve isteği 400'e düşürür
 * (bkz. {@link #rejectUnknown}).
 */
public record ProgressAttempt(
        String at,
        String answer,
        Integer hitCount,
        Integer totalConcepts,
        Integer selfRating,
        Boolean passed) {

    /**
     * Bilinmeyen her alan için Jackson bunu çağırır; hata isteği 400'e çevirir.
     *
     * <p>Neden sınıf seviyesinde {@code FAIL_ON_UNKNOWN_PROPERTIES} değil:
     * Spring Boot bu özelliği global olarak kapatıyor ve
     * {@code @JsonIgnoreProperties(ignoreUnknown = false)} global ayarı
     * geçersiz kılmıyor, yalnızca ona geri düşüyor. Global olarak açmak da
     * yalnızca bu DTO için istenen katılığı her yere yayardı.
     *
     * <p>Mesajda alanın değeri yok: değer kullanıcının yazdığı metin olabilir
     * ve Spring bu hatayı WARN seviyesinde loglar.
     */
    @JsonAnySetter
    void rejectUnknown(String name, Object ignoredValue) {
        throw new IllegalArgumentException("denemede bilinmeyen alan");
    }

    /** Saklanan biçim: tam olarak altı anahtar, fazlası yok. */
    Map<String, Object> toStored() {
        Map<String, Object> stored = new LinkedHashMap<>();
        stored.put("at", at);
        stored.put("answer", answer);
        stored.put("hitCount", hitCount);
        stored.put("totalConcepts", totalConcepts);
        stored.put("selfRating", selfRating);
        stored.put("passed", passed);
        return stored;
    }

    /**
     * Saklanan denemeyi yanıta çevirir. Hoşgörülü: şemaya uymayan eski bir
     * satır hata vermez, tanınmayan anahtarları yanıta taşınmaz, tipi
     * uymayan alan null olur. Frontend böyle bir kaydı kendi şemasında
     * eler ve yerel kopyayı korur.
     */
    static ProgressAttempt fromStored(Map<String, Object> stored) {
        return new ProgressAttempt(
                stored.get("at") instanceof String value ? value : null,
                stored.get("answer") instanceof String value ? value : null,
                stored.get("hitCount") instanceof Number value ? value.intValue() : null,
                stored.get("totalConcepts") instanceof Number value ? value.intValue() : null,
                stored.get("selfRating") instanceof Number value ? value.intValue() : null,
                stored.get("passed") instanceof Boolean value ? value : null);
    }
}
