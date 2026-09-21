package com.meteucar.mulakatslot.question;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.meteucar.mulakatslot.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "app.content.location=classpath:controller-fixtures/*.json")
@AutoConfigureMockMvc
class QuestionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void categoryFilterWorks() throws Exception {
        mockMvc.perform(get("/api/questions").param("category", "sql"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value("controller-sql-question"))
                .andExpect(jsonPath("$[0].category").value("sql"));

        mockMvc.perform(get("/api/questions").param("category", "sql").param("category", "react"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void payloadFieldsAreFlattenedToTopLevel() throws Exception {
        mockMvc.perform(get("/api/questions").param("category", "sql"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].prompt").exists())
                .andExpect(jsonPath("$[0].modelAnswer").exists())
                .andExpect(jsonPath("$[0].keyConcepts", hasSize(3)))
                .andExpect(jsonPath("$[0].followUps", hasSize(1)))
                .andExpect(jsonPath("$[0].source").value("test fixture"))
                .andExpect(jsonPath("$[0].payload").doesNotExist());
    }

    @Test
    void returnsNotModifiedWhenEtagMatches() throws Exception {
        MvcResult first = mockMvc.perform(get("/api/questions"))
                .andExpect(status().isOk())
                .andReturn();
        String etag = first.getResponse().getHeader(HttpHeaders.ETAG);

        mockMvc.perform(get("/api/questions").header(HttpHeaders.IF_NONE_MATCH, etag))
                .andExpect(status().isNotModified())
                .andExpect(content().string(""));
    }
}
