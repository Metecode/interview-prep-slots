package com.meteucar.mulakatslot.user;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppUserRepository extends JpaRepository<AppUser, UUID> {

    Optional<AppUser> findByGithubId(String githubId);

    /**
     * Kullanıcı satırını SELECT ... FOR UPDATE ile okur. Aynı kullanıcının
     * eşzamanlı yazma işleri (ilerleme senkronu) böylece sıraya girer.
     * Kilide ihtiyacı olmayan okumalar {@code findById} kullanmaya devam
     * eder — kilit ücretsiz değil, herkese uygulanmaz.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM AppUser u WHERE u.id = :id")
    Optional<AppUser> findForUpdateById(@Param("id") UUID id);
}
