package com.langnguyen.kltnweb.controller.api;

import com.langnguyen.kltnweb.entity.User;
import com.langnguyen.kltnweb.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;

    @GetMapping()
    public ResponseEntity<?> getUser(){

        User user = authService.getCurrentUser();
        return ResponseEntity.ok(user);

    }

}
