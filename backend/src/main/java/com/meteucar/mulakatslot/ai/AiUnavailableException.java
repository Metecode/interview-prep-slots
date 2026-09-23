package com.meteucar.mulakatslot.ai;

/**
 * Sağlayıcı şu an cevap veremiyor: kendi kotası doldu (429), zaman aşımı,
 * 5xx ya da ağ hatası. Geçici sayılır; kullanıcıya 503 döner ve kotası
 * geri verilir.
 */
public class AiUnavailableException extends RuntimeException {

    public AiUnavailableException(String message) {
        super(message);
    }

    public AiUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
