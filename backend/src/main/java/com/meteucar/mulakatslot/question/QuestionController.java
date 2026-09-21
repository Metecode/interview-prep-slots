package com.meteucar.mulakatslot.question;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/questions")
public class QuestionController {

    private final QuestionRepository questionRepository;
    private final JsonMapper jsonMapper;

    public QuestionController(QuestionRepository questionRepository, JsonMapper jsonMapper) {
        this.questionRepository = questionRepository;
        this.jsonMapper = jsonMapper;
    }

    @GetMapping
    public ResponseEntity<List<QuestionResponse>> list(
            @RequestParam(required = false) List<String> category,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {

        List<Question> questions = (category == null || category.isEmpty())
                ? questionRepository.findAll()
                : questionRepository.findByCategoryIn(category);

        String etag = buildEtag(questions);
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
        }

        List<QuestionResponse> body = questions.stream().map(this::toResponse).toList();
        return ResponseEntity.ok().eTag(etag).body(body);
    }

    /** Tüm soruların en son updated_at'i ve sayısından üretilir. */
    private String buildEtag(List<Question> questions) {
        long latestMillis = questions.stream()
                .map(Question::getUpdatedAt)
                .mapToLong(t -> t.toInstant().toEpochMilli())
                .max()
                .orElse(0L);
        return "\"%d-%d\"".formatted(questions.size(), latestMillis);
    }

    private QuestionResponse toResponse(Question question) {
        Map<String, Object> payload = question.getPayload();
        List<String> followUps = payload.get("followUps") == null
                ? null
                : jsonMapper.convertValue(payload.get("followUps"), new TypeReference<List<String>>() {
                });
        return new QuestionResponse(
                question.getId(),
                question.getCategory(),
                question.getKind(),
                question.getTopic(),
                question.getDifficulty(),
                (String) payload.get("prompt"),
                (String) payload.get("modelAnswer"),
                jsonMapper.convertValue(payload.get("keyConcepts"), new TypeReference<List<KeyConceptResponse>>() {
                }),
                followUps,
                (String) payload.get("source"));
    }
}
