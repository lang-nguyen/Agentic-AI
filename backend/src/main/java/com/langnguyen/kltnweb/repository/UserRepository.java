package com.langnguyen.kltnweb.repository;

import com.langnguyen.kltnweb.entity.User;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
	Optional<User> findByEmail(String email);
}
