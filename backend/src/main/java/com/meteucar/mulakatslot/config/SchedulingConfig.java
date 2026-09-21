package com.meteucar.mulakatslot.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Zamanlanmış işleri açar. Şimdilik tek iş var: süresi dolmuş refresh
 * token'larının temizliği (RefreshTokenCleanupJob).
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
