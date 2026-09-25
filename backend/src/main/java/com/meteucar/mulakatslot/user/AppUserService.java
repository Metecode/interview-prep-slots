package com.meteucar.mulakatslot.user;

import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AppUserService {

    private final AppUserRepository appUserRepository;

    public AppUserService(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    /**
     * GitHub kimliğiyle kullanıcıyı bulur ya da oluşturur. Eşleştirme
     * github_id üzerinden: kullanıcı adı GitHub'da değişebilir, sayısal
     * kimlik değişmez. E-posta ne isteniyor ne saklanıyor.
     */
    @Transactional
    public AppUser upsertFromGithub(String githubId, String username) {
        return appUserRepository.findByGithubId(githubId)
                .map(existing -> {
                    // Kullanıcı adı GitHub'da değişmiş olabilir, her girişte tazelenir.
                    existing.setUsername(username);
                    return existing;
                })
                .orElseGet(() -> appUserRepository.save(new AppUser(githubId, username)));
    }

    /**
     * Hesabı ve ona bağlı her satırı siler. İdempotent: kullanıcı zaten
     * yoksa sessizce biter.
     *
     * <p>DELETE, kullanıcı satırında FOR UPDATE tutan bir senkron varsa onun
     * bitmesini bekler. Silmeden sonra gelen senkron kullanıcıyı bulamaz ve
     * 401 alır; satır yeniden oluşmaz.
     *
     * @return kullanıcı gerçekten silindiyse true
     */
    @Transactional
    public boolean delete(UUID userId) {
        return appUserRepository.deleteByIdReturningCount(userId) > 0;
    }
}
