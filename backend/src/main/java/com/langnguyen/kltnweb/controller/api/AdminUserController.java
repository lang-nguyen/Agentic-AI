package com.langnguyen.kltnweb.controller.api;

import com.langnguyen.kltnweb.entity.User;
import com.langnguyen.kltnweb.service.AuthService;
import com.langnguyen.kltnweb.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AuthService authService;
    private final UserService userService;

    @GetMapping()
    public ResponseEntity<?> getAllUsers() {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        List<User> users = userService.getAllUsers();
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{userId}")
    public ResponseEntity<?> getUserById(@PathVariable String userId) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        User user = userService.getUserById(userId).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(user);
    }

    @PostMapping()
    public ResponseEntity<?> createUser(@RequestBody User user) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        User created = userService.saveUser(user);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{userId}")
    public ResponseEntity<?> updateUser(@PathVariable String userId, @RequestBody User user) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        User existing = userService.getUserById(userId).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        user.setId(userId);
        User updated = userService.saveUser(user);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<?> deleteUser(@PathVariable String userId) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        boolean deleted = userService.deleteUser(userId);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok("User deleted successfully");
    }
}
