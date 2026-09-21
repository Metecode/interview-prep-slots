package com.meteucar.mulakatslot.user;

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
}
