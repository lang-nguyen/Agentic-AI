package com.langnguyen.kltnweb;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class KltnWebApplication {

	public static void main(String[] args) {
		SpringApplication.run(KltnWebApplication.class, args);
	}

}
