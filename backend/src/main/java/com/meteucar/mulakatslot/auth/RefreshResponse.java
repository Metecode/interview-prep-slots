package com.meteucar.mulakatslot.auth;

/**
 * Yenileme yanıtı. Access token yalnızca burada, gövdede döner; cookie'ye
 * yazılmaz, frontend onu bellekte tutar.
 */
public record RefreshResponse(String accessToken, AuthUserResponse user) {
}
