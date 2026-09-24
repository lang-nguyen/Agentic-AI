package com.langnguyen.kltnweb.service;

import com.langnguyen.kltnweb.entity.User;
import com.langnguyen.kltnweb.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {

	private final UserRepository userRepository;
	private final PasswordEncoder passwordEncoder;

	public Optional<User> getUserById(String userId) {
		return userRepository.findById(userId);
	}

	public Optional<User> getUserByEmail(String email) {
		return userRepository.findByEmail(email);
	}

	public List<User> getAllUsers() {
		return userRepository.findAll();
	}

	public User saveUser(User user) {
		return userRepository.save(user);
	}

	public String getFullName(User user) {
		if (user.getName() == null) return user.getId();
		return user.getName().getFirstName() + " " + user.getName().getLastName();
	}

	public boolean deleteUser(String userId) {
		if (userRepository.existsById(userId)) {
			userRepository.deleteById(userId);
			return true;
		}
		return false;
	}

	public Optional<User> getAndValidateUserByEmailPassword(String email, String password) {
		try {
			User user = userRepository
					.findByEmail(email).orElseGet(()->userRepository
					.findById(email).orElseThrow());
			Assert.notNull(user, "Invalid email or password");
			Assert.isTrue(StringUtils.hasText(user.getPassword()),"Invalid email or password");
			Assert.isTrue(passwordEncoder.matches(password,user.getPassword()),"Invalid email or password");
			return Optional.of(user);
		} catch (Exception e) {
			return Optional.of(null);
		}
	}

}
