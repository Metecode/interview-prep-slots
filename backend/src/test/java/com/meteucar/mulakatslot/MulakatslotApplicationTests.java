package com.meteucar.mulakatslot;

import static org.assertj.core.api.Assertions.assertThat;

import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
class MulakatslotApplicationTests {

	@Autowired
	private DataSource dataSource;

	@Test
	void contextLoads() {
		assertThat(dataSource).isNotNull();
	}

	@Test
	void flywayMigrationIsApplied() {
		JdbcTemplate jdbcTemplate = new JdbcTemplate(dataSource);

		Integer migrationCount = jdbcTemplate.queryForObject(
				"SELECT count(*) FROM flyway_schema_history WHERE version = '1' AND success = true",
				Integer.class);
		assertThat(migrationCount).isEqualTo(1);

		Integer tableCount = jdbcTemplate.queryForObject(
				"""
				SELECT count(*) FROM information_schema.tables
				WHERE table_schema = 'public'
				AND table_name IN ('app_user', 'question', 'question_progress')
				""",
				Integer.class);
		assertThat(tableCount).isEqualTo(3);
	}

}
