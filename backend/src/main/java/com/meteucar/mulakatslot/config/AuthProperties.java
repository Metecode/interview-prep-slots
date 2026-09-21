package com.meteucar.mulakatslot.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Kimlik doğrulama ayarları. Değerler application.yml üzerinden ortam
 * değişkenlerinden gelir (JWT_SECRET, APP_BASE_URL, COOKIE_SECURE);
 * hiçbiri kaynak koda gömülmez.
 *
 * @param jwtSecret    access token'ı imzalayan HS256 anahtarı; en az 32 bayt
 *                     olmalı, kısa anahtarla uygulama açılmaz (bkz. JwtConfig)
 * @param appBaseUrl   GitHub dönüşünden sonra yönlendirilecek frontend kökü
 * @param cookieSecure refresh cookie'sine Secure bayrağı konsun mu; varsayılan
 *                     true, yalnızca HTTPS olmayan yerel geliştirmede kapatılır
 */
@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(String jwtSecret, String appBaseUrl, boolean cookieSecure) {
}
