package com.meteucar.mulakatslot.ai;

/**
 * Sağlayıcı cevap verdi ama cevap okunamadı: JSON ayrıştırılamadı, beklenen
 * alan yok ya da üretim yarıda kesildi. Kullanıcıya 502 döner ve kotası
 * geri verilir.
 *
 * <p>Mesaja sağlayıcının ham çıktısı KONMAZ: çıktı kullanıcının cevabını
 * aktarıyor olabilir ve cevap metni loglanmıyor.
 */
public class AiResponseException extends RuntimeException {

    public AiResponseException(String message) {
        super(message);
    }

    public AiResponseException(String message, Throwable cause) {
        super(message, cause);
    }
}
