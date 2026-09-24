package com.langnguyen.kltnweb.config;

import com.langnguyen.kltnweb.entity.User;
import com.langnguyen.kltnweb.repository.UserRepository;
import com.langnguyen.kltnweb.util.JwtTokenProvider;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.Assert;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.security.core.GrantedAuthority;


import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);
            Assert.isTrue(tokenProvider.validateToken(jwt), "Invalid JWT token");

            String subject = tokenProvider.getUsernameFromToken(jwt);

            // Find user by email first, then by ID
            User user = userRepository
                    .findByEmail(subject).orElseGet(() -> userRepository
                    .findById(subject).orElseThrow());

            // Get SpringSecurity roles
            List<GrantedAuthority> authorities = Optional
                            .ofNullable(user.getRoles())
                            .orElse(Collections.emptyList())
                            .stream()
                            .map(role -> new SimpleGrantedAuthority("ROLE_"+role.toUpperCase()))
                            .collect(Collectors.toList());

            // Create UserDetails
            String notNullUsername = Optional.ofNullable(user.getEmail()).orElse(user.getId());
            String notNullPassword = Optional.ofNullable(user.getPassword()).orElse(user.getPassword());
            UserDetails userDetails = org.springframework.security.core.userdetails.User.builder()
                    .username(notNullUsername)
                    .password(notNullPassword)
                    .authorities(authorities)
                    .build();

            // Set Authentication to Context
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    userDetails, null, userDetails.getAuthorities());
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (Exception ex) {
            AnonymousAuthenticationToken authentication = new AnonymousAuthenticationToken(
                    "anonymous", "anonymous", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }
        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
