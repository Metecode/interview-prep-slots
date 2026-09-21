package com.meteucar.mulakatslot.auth;

import java.util.UUID;

/** Oturum sahibinin dışarı açılan alanları. E-posta hiç alınmıyor. */
public record AuthUserResponse(UUID id, String username) {
}
