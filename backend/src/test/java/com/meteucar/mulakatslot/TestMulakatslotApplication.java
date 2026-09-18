package com.meteucar.mulakatslot;

import org.springframework.boot.SpringApplication;

public class TestMulakatslotApplication {

	public static void main(String[] args) {
		SpringApplication.from(MulakatslotApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
