package com.meteucar.mulakatslot.progress;

import com.meteucar.mulakatslot.auth.UnauthorizedException;
import com.meteucar.mulakatslot.question.Question;
import com.meteucar.mulakatslot.question.QuestionRepository;
import com.meteucar.mulakatslot.user.AppUser;
import com.meteucar.mulakatslot.user.AppUserRepository;
import jakarta.persistence.EntityManager;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * İlerleme senkronunun veritabanı tarafı: transaction, kilit, okuma ve
 * entity'ye yazma. Hangi kaydın kazanacağına karar vermez — onu saf
 * {@link ProgressMerger} yapar, burası yalnızca kararı uygular.
 *
 * <p>Birincil depo istemcideki IndexedDB; buradaki kayıt ikinci kopya.
 * Kutuyu yine kullanıcı belirliyor: sunucu box'ı hesaplamaz, taşır.
 */
@Service
public class ProgressSyncService {

    private static final Logger log = LoggerFactory.getLogger(ProgressSyncService.class);

    private final QuestionProgressRepository progressRepository;
    private final QuestionRepository questionRepository;
    private final AppUserRepository appUserRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    public ProgressSyncService(QuestionProgressRepository progressRepository, QuestionRepository questionRepository,
            AppUserRepository appUserRepository, EntityManager entityManager, Clock clock) {
        this.progressRepository = progressRepository;
        this.questionRepository = questionRepository;
        this.appUserRepository = appUserRepository;
        this.entityManager = entityManager;
        this.clock = clock;
    }

    /** Kullanıcının tüm ilerlemesi. Başka kullanıcının satırına hiç bakılmaz. */
    @Transactional(readOnly = true)
    public List<ProgressRecord> findAll(UUID userId) {
        return toRecords(progressRepository.findByIdUserId(userId));
    }

    /**
     * Kısmi liste uygular (PUT). Gövde yalnızca değişenleri taşır; burada
     * olmayan bir soru "silinmiş" sayılmaz.
     */
    @Transactional
    public ProgressApplyResult apply(UUID userId, List<ProgressRecord> incoming) {
        return sync(requireUser(userId), incoming).counters();
    }

    /**
     * İki yönlü birleştirme (POST /merge). Gelen kayıtlardan yeni olanlar
     * yazılır, sonuç olarak kullanıcının BİRLEŞMİŞ TAM ilerlemesi döner;
     * istemci dönen listeyi olduğu gibi yereline yazar. Sunucuda daha yeni
     * olan kayıtlar da böylece istemciye geçer.
     */
    @Transactional
    public List<ProgressRecord> mergeAll(UUID userId, List<ProgressRecord> incoming) {
        return toRecords(sync(requireUser(userId), incoming).rows().values());
    }

    /**
     * Tek transaction: oku, {@link ProgressMerger}'a sor, kararı uygula.
     *
     * <p>Kullanıcının senkronları {@link #requireUser} aldığı
     * PESSIMISTIC_WRITE kilidiyle sıraya girer. İdempotentlik tek başına
     * yetmiyordu: o yalnızca AYNI veri için doğru. İki sekme aynı soruyu
     * farklı lastSeenAt ile aynı anda gönderdiğinde ikisi de satırı eski
     * haliyle okuyup üstüne yazıyor, son commit kazanıyordu — eski kayıt
     * yeniyi ezebiliyordu. Kilit alındıktan sonra ikinci istek birincinin
     * yazdığını görüyor.
     */
    private SyncOutcome sync(AppUser user, List<ProgressRecord> incoming) {
        // Kullanıcının satırları ve gelen id'lere karşılık gelen sorular tek
        // seferde okunur; karar döngüsünde sorgu atılmaz.
        Map<String, QuestionProgress> rows = byQuestionId(progressRepository.findByIdUserId(user.getId()));
        Map<String, Question> questions = questionsFor(incoming);

        ProgressMerger.MergePlan plan = ProgressMerger.merge(
                snapshotOf(rows), incoming, questions.keySet(), OffsetDateTime.now(clock));

        for (ProgressState change : plan.changes()) {
            applyChange(user, questions.get(change.questionId()), rows, change);
        }

        // Yalnızca user_id, question_id ve sabit metinli neden. Kaydın
        // içeriği, özellikle cevap metni, hiçbir koşulda loga yazılmaz.
        for (ProgressValidator.Rejected rejected : plan.rejections()) {
            log.info("Senkron kaydı atlandı: {} (user_id={}, question_id={})",
                    rejected.reason(), user.getId(), rejected.questionId());
        }
        if (plan.unknownQuestions() > 0) {
            log.info("Senkronda {} kayıt bilinmeyen soruya ait, atlandı (user_id={})",
                    plan.unknownQuestions(), user.getId());
        }
        return new SyncOutcome(rows, plan.counters());
    }

    /**
     * Yeni satır da mevcut satırlarla aynı yoldan gider: persist edilip
     * persistence context'e girer, yazma anını transaction sonundaki flush
     * belirler. Repository.save ile karışık bir kurgu olmasın.
     */
    private void applyChange(AppUser user, Question question, Map<String, QuestionProgress> rows,
            ProgressState change) {
        QuestionProgress row = rows.get(change.questionId());
        if (row == null) {
            row = new QuestionProgress(user, question, change.box(), change.lastSeenAt());
            entityManager.persist(row);
            rows.put(change.questionId(), row);
        } else {
            // Yalnızca attempts birleştiği durumda bu ikisi aynı değeri alır;
            // Hibernate değişmeyen kolonu zaten UPDATE'e koymuyor.
            row.setBox(change.box());
            row.setLastSeenAt(change.lastSeenAt());
        }
        row.setAttempts(change.attempts());
    }

    /**
     * Kullanıcıyı PESSIMISTIC_WRITE ile okur; senkronun serileşme noktası
     * burası. Kilit ilerleme satırlarında değil kullanıcı satırında, çünkü
     * senkron yeni satır da ekliyor ve var olmayan satır kilitlenemez —
     * iki sekme aynı soruyu ilk kez aynı anda gönderdiğinde satır kilidi
     * hiçbir şeyi kilitlemez, ikisi de INSERT eder ve biri birincil anahtar
     * çakışmasıyla düşerdi. Kullanıcı satırı hep var.
     *
     * <p>Token imzası geçerli olsa bile kullanıcı silinmiş olabilir; yabancı
     * anahtar hatasıyla 500 vermektense 401 dönmek doğru cevap.
     */
    private AppUser requireUser(UUID userId) {
        return appUserRepository.findForUpdateById(userId)
                .orElseThrow(() -> new UnauthorizedException("token geçerli ama kullanıcı yok: " + userId));
    }

    /**
     * Gelen ham kayıtların soruları. Doğrulama karar katmanında olduğu için
     * burada henüz elenmemiş id'ler de sorulur; fazladan gelen id sorguya
     * eklenmiş bir satırdan ibaret, ayrı bir tur gezmekten ucuz.
     */
    private Map<String, Question> questionsFor(List<ProgressRecord> incoming) {
        List<String> wantedIds = incoming.stream()
                .map(ProgressRecord::questionId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();

        Map<String, Question> questions = new LinkedHashMap<>();
        for (Question question : questionRepository.findAllById(wantedIds)) {
            questions.put(question.getId(), question);
        }
        return questions;
    }

    private static Map<String, ProgressState> snapshotOf(Map<String, QuestionProgress> rows) {
        Map<String, ProgressState> snapshot = new LinkedHashMap<>();
        rows.forEach((questionId, row) -> snapshot.put(questionId,
                new ProgressState(questionId, row.getBox(), row.getLastSeenAt(), row.getAttempts())));
        return snapshot;
    }

    private static Map<String, QuestionProgress> byQuestionId(List<QuestionProgress> rows) {
        Map<String, QuestionProgress> map = new LinkedHashMap<>();
        for (QuestionProgress row : rows) {
            map.put(row.getId().getQuestionId(), row);
        }
        return map;
    }

    private static List<ProgressRecord> toRecords(Iterable<QuestionProgress> rows) {
        List<ProgressRecord> records = new ArrayList<>();
        for (QuestionProgress row : rows) {
            records.add(new ProgressRecord(
                    row.getId().getQuestionId(),
                    (int) row.getBox(),
                    // Zod tarafı .datetime() ile UTC bekliyor; sürücünün
                    // döndürdüğü yerel offset'i olduğu gibi yazarsak
                    // "+03:00" biçimi şemadan geçmez.
                    row.getLastSeenAt().toInstant().toString(),
                    // Saklanan biçim Map; yanıt tipli. Tanınmayan eski
                    // anahtarlar burada düşer, yanıta taşınmaz. Boş eleman
                    // birleştirmede de atlanıyor (ProgressAttempts).
                    row.getAttempts().stream()
                            .filter(Objects::nonNull)
                            .map(ProgressAttempt::fromStored)
                            .toList()));
        }
        return records;
    }

    /** rows; senkrondan SONRAKİ tüm satırlar — mergeAll bunu döner. */
    private record SyncOutcome(Map<String, QuestionProgress> rows, ProgressApplyResult counters) {
    }
}
