package com.langnguyen.kltnweb.util.property;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "application.admin")
public class AdminProperty {
	private String username;
	private String password;
}
