package com.meteucar.mulakatslot.auth;

/**
 * İstek kimlik doğrulamadan geçemedi. AuthController bunu tek bir yerde
 * 401 + {"error":"unauthorized"} gövdesine çevirir.
 */
public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String message) {
        super(message);
    }
}
