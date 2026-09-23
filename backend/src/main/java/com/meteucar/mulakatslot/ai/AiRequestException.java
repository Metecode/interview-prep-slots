package com.meteucar.mulakatslot.ai;

import org.springframework.http.HttpStatus;

/**
 * Kullanıcıya dönecek AI hatası: HTTP durumu ve istemcinin tek kontrolle
 * ayırt edeceği sabit bir kod. Denetleyici bunu {@code { "code": ... }}
 * gövdesine çevirir.
 */
public class AiRequestException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    private AiRequestException(HttpStatus status, String code) {
        super(code);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    static AiRequestException invalidRequest() {
        return new AiRequestException(HttpStatus.BAD_REQUEST, "invalid_request");
    }

    static AiRequestException questionNotFound() {
        return new AiRequestException(HttpStatus.NOT_FOUND, "question_not_found");
    }

    static AiRequestException rateLimited() {
        return new AiRequestException(HttpStatus.TOO_MANY_REQUESTS, "rate_limited");
    }

    static AiRequestException quotaExceeded() {
        return new AiRequestException(HttpStatus.TOO_MANY_REQUESTS, "quota_exceeded");
    }

    /** Sağlayıcı yapılandırılmamış; istemci düğmeyi zaten göstermemeli. */
    static AiRequestException disabled() {
        return new AiRequestException(HttpStatus.SERVICE_UNAVAILABLE, "ai_disabled");
    }

    static AiRequestException unavailable() {
        return new AiRequestException(HttpStatus.SERVICE_UNAVAILABLE, "ai_unavailable");
    }

    static AiRequestException badProviderResponse() {
        return new AiRequestException(HttpStatus.BAD_GATEWAY, "ai_bad_response");
    }
}
