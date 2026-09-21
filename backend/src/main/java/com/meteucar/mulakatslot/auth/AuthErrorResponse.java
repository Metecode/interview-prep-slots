package com.meteucar.mulakatslot.auth;

/**
 * 401 gövdesi. Spring'in varsayılan davranışı olan login sayfasına
 * yönlendirme yerine her yerde bu şekil dönülür; frontend tek bir kontrolle
 * anlar.
 */
public record AuthErrorResponse(String error) {

    public static AuthErrorResponse unauthorized() {
        return new AuthErrorResponse("unauthorized");
    }
}
