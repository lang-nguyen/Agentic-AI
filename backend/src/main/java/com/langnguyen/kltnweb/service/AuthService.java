package com.langnguyen.kltnweb.service;

import com.langnguyen.kltnweb.entity.User;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserService userService;

    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        try {
            Assert.isInstanceOf(UsernamePasswordAuthenticationToken.class, authentication); // not guest
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String subject = userDetails.getUsername();
            return userService
                    .getUserByEmail(subject).orElseGet(() -> userService
                    .getUserById(subject).orElseThrow());
        } catch (Exception e) {
            return null;
        }
    }

}
