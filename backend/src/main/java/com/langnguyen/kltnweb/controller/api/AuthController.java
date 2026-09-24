package com.langnguyen.kltnweb.controller.api;

import com.langnguyen.kltnweb.entity.User;
import com.langnguyen.kltnweb.repository.UserRepository;
import com.langnguyen.kltnweb.service.UserService;
import com.langnguyen.kltnweb.util.JwtTokenProvider;
import jakarta.websocket.server.PathParam;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final UserService userService;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        try {
            User user = userService.getAndValidateUserByEmailPassword(request.getEmail(), request.getPassword()).orElseThrow();
            String token = tokenProvider.generateToken(Optional.ofNullable(user.getEmail()).orElse(user.getId()));

            Map<String, Object> response = new HashMap<>();
            response.put("token", token);
            response.put("userId", user.getId());
            response.put("email", user.getEmail());
            response.put("fullName", user.getFullName());

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid username or password");
        }
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody User user) {
        if (user.getEmail() != null && userRepository.findByEmail(user.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body("Email is already registered");
        }
        if (user.getId() != null && userRepository.existsById(user.getId())) {
            return ResponseEntity.badRequest().body("User ID is already registered");
        }

        if (user.getPassword() == null || user.getPassword().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Password is required");
        }

        user.setPassword(passwordEncoder.encode(user.getPassword()));
        User saved = userRepository.save(user);
        return ResponseEntity.ok(saved);
    }

    @Data
    public static class LoginRequest {
        private String email;
        private String password;
    }
}
